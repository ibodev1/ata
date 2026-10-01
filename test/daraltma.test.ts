import { expect, test } from "bun:test";
import { kaynakOluştur, ayrıştır, analizEt, yorumla } from "../src/index.ts";

function programıAl(metin: string) {
  const sonuç = ayrıştır(kaynakOluştur("daraltma.ata", metin));
  expect(sonuç.tanılar).toEqual([]);
  if (!sonuç.program) throw new Error("Program bekleniyordu.");
  return sonuç.program;
}

function çalıştır(metin: string) {
  const program = programıAl(metin);
  expect(analizEt(program).tanılar).toEqual([]);
  const çıktı: string[] = [];
  const sonuç = yorumla(program, { çıktıYaz: (satır) => çıktı.push(satır) });
  expect(sonuç.tanılar).toEqual([]);
  return çıktı;
}

function kodlar(metin: string): string[] {
  return analizEt(programıAl(metin)).tanılar.map((tanı) => tanı.kod);
}

test.each(["yok", '"Yeni"'])("atama akış tipini temel tipe sıfırlar: %s", (değer) => {
  expect(
    kodlar(
      `değişken ad: yazı? = "Ata"; eğer ad != yok ise { ad = ${değer}; büyük_harf(ad) yazdır }`,
    ),
  ).toEqual(["ATA4005"]);
});

test("iç bloktaki atama dış daraltmayı da bozar", () => {
  expect(
    kodlar(
      'değişken ad: yazı? = "Ata"; eğer ad != yok ise { { ad = yok }; büyük_harf(ad) yazdır }',
    ),
  ).toEqual(["ATA4005"]);
});

test("kullanıcı çağrısı global mutable daraltmayı bozar", () => {
  expect(
    kodlar(
      'değişken ad: yazı? = "Ata"; işlev temizle(): hiç { ad = yok }; eğer ad != yok ise { temizle(); büyük_harf(ad) yazdır }',
    ),
  ).toEqual(["ATA4005"]);
});

test("iken koşulu her yinelemede gövdeyi daraltır", () => {
  expect(
    çalıştır('değişken ad: yazı? = "Ata"; ad != yok iken { büyük_harf(ad) yazdır; ad = yok }'),
  ).toEqual(["ATA"]);
});

test("önceki yinelemenin ataması koşulsuz döngüde eski dış fact'i kullanamaz", () => {
  expect(
    kodlar(
      'değişken ad: yazı? = "Ata"; eğer ad != yok ise { doğru iken { büyük_harf(ad) yazdır; ad = yok } }',
    ),
  ).toEqual(["ATA4005"]);
});

test("kullanıcı işlevi global mutable bağlamayı gerçekten değiştirir", () => {
  expect(
    çalıştır('değişken ad: yazı? = "Ata"; işlev temizle(): hiç { ad = yok }; temizle(); ad yazdır'),
  ).toEqual(["yok"]);
});

test("değil facts'i tersler; ve/veya sağ operandı ve ilgili kolu güvenli akışta denetlenir", () => {
  expect(
    çalıştır(
      'yapı K { ad: yazı, aktif: mantık }; değişken k: K? = K { ad: "Ata", aktif: doğru }; eğer (k == yok) değil ise { k.ad yazdır }; eğer k != yok ve k.aktif ise { k.ad yazdır }; eğer k == yok veya k.aktif değil ise { "yok/kapalı" yazdır } değilse { k.ad yazdır }',
    ),
  ).toEqual(["Ata", "Ata", "Ata"]);
});

test("!= yok koşulu içinde akış tipi daralır, bildirilmiş tip ve blok dışı tip korunur", () => {
  const program = programıAl(
    'değişken ad: yazı? = "Ata"; eğer ad != yok ise { büyük_harf(ad) yazdır }; ad yazdır',
  );
  const analiz = analizEt(program);
  expect(analiz.tanılar).toEqual([]);
  expect([...analiz.sembolTipleri.values()]).toContainEqual({
    tür: "isteğe-bağlı",
    temel: { tür: "yazı" },
  });
  expect(
    [...analiz.ifadeTipleri.values()].filter((tip) => tip.tür === "yazı").length,
  ).toBeGreaterThan(1);
  const son = program.bildirimler[2];
  if (son?.tür !== "yazdır") throw new Error("Yazdır bekleniyordu.");
  expect(analiz.ifadeTipleri.get(son.ifade)).toEqual({
    tür: "isteğe-bağlı",
    temel: { tür: "yazı" },
  });
  expect(
    çalıştır('değişken ad: yazı? = "Ata"; eğer ad != yok ise { büyük_harf(ad) yazdır }'),
  ).toEqual(["ATA"]);
});

const yapı =
  'yapı K { ad: yazı, yaş: sayı, aktif: mantık }; değişken k: K? = K { ad: "İbrahim", yaş: 20, aktif: doğru };';

test.each([
  "k != yok",
  "yok != k",
  "(k == yok) değil",
  "(yok == k) değil",
  "((k != yok) değil) değil",
])("doğru kolda yapı daraltma: %s", (koşul) => {
  expect(çalıştır(`${yapı} eğer ${koşul} ise { "Merhaba {k.ad}!" yazdır }`)).toEqual([
    "Merhaba İbrahim!",
  ]);
});

test.each(["k == yok", "yok == k", "(k != yok) değil", "(yok != k) değil"])(
  "yanlış kolda yapı daraltma: %s",
  (koşul) => {
    expect(çalıştır(`${yapı} eğer ${koşul} ise { "Yok" yazdır } değilse { k.ad yazdır }`)).toEqual([
      "İbrahim",
    ]);
  },
);

test.each(["ad != yok", "yok != ad", "ad == yok", "yok == ad"])(
  "iki kolun akış tipleri ayrı ve doğru: %s",
  (koşul) => {
    const program = programıAl(
      `sabit ad: yazı? = yok; eğer ${koşul} ise { ad yazdır } değilse { ad yazdır }; ad yazdır`,
    );
    const analiz = analizEt(program);
    expect(analiz.tanılar).toEqual([]);
    const koşulDüğümü = program.bildirimler[1];
    if (koşulDüğümü?.tür !== "koşul" || koşulDüğümü.değilse?.tür !== "blok")
      throw new Error("Koşul bekleniyordu.");
    const doğru = koşulDüğümü.doğruysa.bildirimler[0];
    const yanlış = koşulDüğümü.değilse.bildirimler[0];
    const dış = program.bildirimler[2];
    if (doğru?.tür !== "yazdır" || yanlış?.tür !== "yazdır" || dış?.tür !== "yazdır")
      throw new Error("Yazdır bekleniyordu.");
    expect(analiz.ifadeTipleri.get(doğru.ifade)).toEqual({
      tür: koşul.includes("!=") ? "yazı" : "yok",
    });
    expect(analiz.ifadeTipleri.get(yanlış.ifade)).toEqual({
      tür: koşul.includes("!=") ? "yok" : "yazı",
    });
    expect(analiz.ifadeTipleri.get(dış.ifade)).toEqual({
      tür: "isteğe-bağlı",
      temel: { tür: "yazı" },
    });
  },
);

test.each([
  "k != yok ve k.yaş >= 18",
  "k != yok ve k.aktif",
  "k != yok ve (k.aktif ve k.yaş >= 18)",
  "k != yok ve (k.aktif veya k.yaş >= 18)",
  "k != yok ve k != yok",
])("ve sağ tarafı ve doğru kol daralır: %s", (koşul) => {
  expect(çalıştır(`${yapı} eğer ${koşul} ise { k.ad yazdır }`)).toEqual(["İbrahim"]);
});

test.each([
  "k == yok veya k.yaş < 18",
  "k == yok veya k.aktif değil",
  "k == yok veya (k.aktif değil ve k.yaş < 18)",
])("veya sağ tarafı ve yanlış kol daralır: %s", (koşul) => {
  expect(
    çalıştır(`${yapı} eğer ${koşul} ise { "Yok/küçük" yazdır } değilse { k.ad yazdır }`),
  ).toEqual(["İbrahim"]);
});

test.each([
  ["k != yok ve k.aktif", "eğer k != yok ve k.aktif ise {} değilse { k.ad yazdır }"],
  ["k == yok veya k.aktif", "eğer k == yok veya k.aktif ise { k.ad yazdır }"],
  ["çelişen ve", "eğer k != yok ve k == yok ise { k.ad yazdır }"],
  ["çelişen nested", "eğer k != yok ise { eğer k == yok ise { k.ad yazdır } }"],
])("güvensiz kol daraltılmaz: %s", (_ad, kod) => {
  expect(kodlar(yapı + kod)).toContain("ATA4020");
});

test.each([
  [
    "nested koşul",
    "eğer k != yok ise { eğer k.aktif ise { k.ad yazdır }; k.ad yazdır }",
    ["İbrahim", "İbrahim"],
  ],
  ["iç blok", "eğer k != yok ise { { k.ad yazdır }; k.ad yazdır }", ["İbrahim", "İbrahim"]],
  ["daraltılmış çıkarım", "eğer k != yok ise { sabit başka = k; başka.ad yazdır }", ["İbrahim"]],
  ["else-if", "eğer k == yok ise {} değilse eğer k.aktif ise { k.ad yazdır }", ["İbrahim"]],
  ["while yapı", "k != yok iken { k.ad yazdır; k = yok }", ["İbrahim"]],
])("kapsam ve yapı bütünleşmesi: %s", (_ad, kod, çıktı) => {
  expect(çalıştır(yapı + kod)).toEqual(çıktı);
});

test.each([
  [
    "sabit yazı",
    'sabit ad: yazı? = "Ata"; eğer ad != yok ise { büyük_harf(ad) yazdır; uzunluk(ad) yazdır }',
    ["ATA", "3"],
  ],
  [
    "isteğe bağlı liste",
    "değişken l: liste<sayı>? = [1,2,3]; eğer l != yok ise { l[0] yazdır; uzunluk(l) yazdır; l içindeki her n için { n yazdır } }",
    ["1", "3", "1", "2", "3"],
  ],
  [
    "parametre",
    'işlev selamla(ad: yazı?): hiç { eğer ad != yok ise { büyük_harf(ad) yazdır } }; selamla("Ata"); selamla(yok)',
    ["ATA"],
  ],
  [
    "döngü elemanı",
    'sabit l: liste<yazı?> = ["Ata", yok]; l içindeki her ad için { eğer ad != yok ise { büyük_harf(ad) yazdır } }',
    ["ATA"],
  ],
  ["sayı", "sabit n: sayı? = 3; eğer n != yok ise { n + 2 yazdır }", ["5"]],
  ["mantık", 'sabit b: mantık? = doğru; eğer b != yok ve b ise { "evet" yazdır }', ["evet"]],
  [
    "gölgeleme",
    'değişken ad: yazı? = "Ata"; eğer ad != yok ise { { sabit ad = 42; ad + 1 yazdır }; büyük_harf(ad) yazdır }',
    ["43", "ATA"],
  ],
  [
    "yerel mutable çağrıdan korunur",
    'işlev boş(): hiç {}; { değişken ad: yazı? = "Ata"; eğer ad != yok ise { boş(); büyük_harf(ad) yazdır } }',
    ["ATA"],
  ],
  [
    "global sabit çağrıdan korunur",
    'sabit ad: yazı? = "Ata"; işlev boş(): hiç {}; eğer ad != yok ise { boş(); büyük_harf(ad) yazdır }',
    ["ATA"],
  ],
  [
    "yerleşik global fact korur",
    'değişken ad: yazı? = "Ata"; eğer ad != yok ise { uzunluk(ad) yazdır; büyük_harf(ad) yazdır }',
    ["3", "ATA"],
  ],
  [
    "yerleşik globalde yeniden tanımlanamaz",
    'değişken ad: yazı? = "Ata"; işlev büyük_harf(): hiç {}',
    null,
  ],
  [
    "atama sonrasında tekrar koşul",
    'değişken ad: yazı? = "Ata"; eğer ad != yok ise { ad = "Yeni"; eğer ad != yok ise { büyük_harf(ad) yazdır } }',
    ["YENİ"],
  ],
  [
    "başka ada atama fact korur",
    'değişken ad: yazı? = "Ata"; değişken n = 0; eğer ad != yok ise { n = 1; büyük_harf(ad) yazdır }',
    ["ATA"],
  ],
  [
    "yazılmayan dış fact döngüde korunur",
    'sabit l = [1,2]; değişken ad: yazı? = "Ata"; eğer ad != yok ise { l içindeki her n için { büyük_harf(ad) yazdır } }',
    ["ATA", "ATA"],
  ],
])("farklı sembol ve tipler: %s", (_ad, kod, çıktı) => {
  if (çıktı === null) expect(kodlar(kod)).toContain("ATA3002");
  else expect(çalıştır(kod)).toEqual(çıktı);
});

test.each([
  ["ve", 'k != yok ve k.ad == "Ata"', "hayır"],
  ["veya", 'k == yok veya k.ad == "Ata"', "evet"],
])("yok yapı alanına runtime kısa devreyle erişilmez: %s", (_ad, koşul, çıktı) => {
  expect(
    çalıştır(
      `yapı K { ad: yazı }; sabit k: K? = yok; eğer ${koşul} ise { "evet" yazdır } değilse { "hayır" yazdır }`,
    ),
  ).toEqual([çıktı]);
});

test.each([
  ["korumasız yapı", yapı + "k.ad yazdır", "ATA4020"],
  ["koşul sonrası", yapı + "eğer k != yok ise { k.ad yazdır }; k.ad yazdır", "ATA4020"],
  ["döngü sonrası", yapı + "k != yok iken { k = yok }; k.ad yazdır", "ATA4020"],
  [
    "guard",
    "işlev selamla(ad: yazı?): hiç { eğer ad == yok ise { döndür }; büyük_harf(ad) yazdır }",
    "ATA4005",
  ],
  [
    "branch atamasından çıkarım yok",
    'değişken ad: yazı? = yok; eğer doğru ise { ad = "Ata" } değilse { ad = "Dil" }; büyük_harf(ad) yazdır',
    "ATA4005",
  ],
  [
    "alan yolu",
    'yapı A { şehir: yazı }; yapı K { adres: A? }; sabit k = K { adres: A { şehir: "Konya" } }; eğer k.adres != yok ise { k.adres.şehir yazdır }',
    "ATA4020",
  ],
  [
    "liste indeksi yolu",
    'sabit l: liste<yazı?> = ["Ata"]; eğer l[0] != yok ise { büyük_harf(l[0]) yazdır }',
    "ATA4005",
  ],
  ["nonoptional karşılaştırma", "sabit n = 10; eğer n != yok ise {}", "ATA4011"],
  [
    "iki optional eşitlik fact üretmez",
    'sabit a: yazı? = "Ata"; sabit b: yazı? = "Ata"; eğer a == b ise { büyük_harf(a) yazdır }',
    "ATA4005",
  ],
  [
    "koşul dışı karşılaştırma fact taşımaz",
    'sabit ad: yazı? = "Ata"; ad != yok; büyük_harf(ad) yazdır',
    "ATA4005",
  ],
  [
    "mantıksal ifade dışarı fact taşımaz",
    'sabit ad: yazı? = "Ata"; sabit b = ad != yok ve uzunluk(ad) > 0; büyük_harf(ad) yazdır',
    "ATA4005",
  ],
])("kapsam dışı çıkarım korunur: %s", (_ad, kod, hata) => {
  expect(kodlar(kod)).toContain(hata);
});

test.each(["+=", "-=", "*=", "/=", "%="])(
  "bileşik atama temel optional kurallarını korur ve fact'i bozar: %s",
  (işleç) => {
    expect(
      kodlar(`değişken n: sayı? = 3; eğer n != yok ise { n ${işleç} 1; n + 1 yazdır }`),
    ).toEqual(["ATA4011", "ATA4011"]);
  },
);

test.each([
  ["true nested", "eğer doğru ise { ad = yok }"],
  ["false nested", "eğer yanlış ise {} değilse { ad = yok }"],
  ["koşulsuz blok", "{ ad = yok }"],
  ["user call nested", "{ boş() }"],
])("iç kapsamın değişimi dış fact'i diriltemez: %s", (_ad, iç) => {
  expect(
    kodlar(
      `değişken ad: yazı? = "Ata"; işlev boş(): hiç {}; eğer ad != yok ise { ${iç}; büyük_harf(ad) yazdır }`,
    ),
  ).toEqual(["ATA4005"]);
});

test.each([
  ["ve çağrı", "eğer ad != yok ve temizle() ise { büyük_harf(ad) yazdır }"],
  ["veya çağrı", "eğer ad == yok veya temizle() ise {} değilse { büyük_harf(ad) yazdır }"],
  [
    "ve kısa devre sonrası",
    "eğer ad != yok ise { sabit b = yanlış ve temizle(); büyük_harf(ad) yazdır }",
  ],
  [
    "veya kısa devre sonrası",
    "eğer ad != yok ise { sabit b = doğru veya temizle(); büyük_harf(ad) yazdır }",
  ],
  [
    "while çağrı sonraki yineleme",
    "eğer ad != yok ise { doğru iken { büyük_harf(ad) yazdır; temizle() } }",
  ],
  [
    "liste döngüsü sonraki yineleme",
    "eğer ad != yok ise { [1,2] içindeki her n için { büyük_harf(ad) yazdır; ad = yok } }",
  ],
])("yan etkiler eski daraltmayla güvenli sayılmaz: %s", (_ad, kod) => {
  expect(
    kodlar(
      `değişken ad: yazı? = "Ata"; işlev temizle(): mantık { ad = yok; doğru döndür }; ${kod}`,
    ),
  ).toEqual(["ATA4005"]);
});

test("alanı sabit ada bağlamak desteklenen doğrudan daraltmayı sağlar", () => {
  expect(
    çalıştır(
      'yapı A { şehir: yazı }; yapı K { adres: A? }; sabit k = K { adres: A { şehir: "Konya" } }; sabit adres = k.adres; eğer adres != yok ise { adres.şehir yazdır }',
    ),
  ).toEqual(["Konya"]);
});

test("tanımsız koşul bilinmeyen tip için sahte hata zinciri üretmez", () => {
  expect(kodlar("eğer bilinmeyen != yok ve bilinmeyen.ad ise {}")).toEqual(["ATA3001", "ATA3001"]);
});

test("yanlış postfix değil tanısı mevcut işleci belirtir", () => {
  const analiz = analizEt(programıAl("1 değil yazdır"));
  expect(analiz.tanılar.map((tanı) => tanı.kod)).toEqual(["ATA4011"]);
  expect(analiz.tanılar[0]?.mesaj).toContain("'değil'");
});

test("çağrı argümanları soldan sağa denetlenir ve sonraki argüman değişimi görülür", () => {
  expect(
    kodlar(
      'değişken ad: yazı? = "Ata"; işlev temizle(): yazı { ad = yok; "" döndür }; eğer ad != yok ise { içerir(temizle(), ad) yazdır }',
    ),
  ).toEqual(["ATA4005"]);
  expect(
    çalıştır(
      'değişken ad: yazı? = "Ata"; işlev temizle(): yazı { ad = yok; "" döndür }; eğer ad != yok ise { içerir(ad, temizle()) yazdır }',
    ),
  ).toEqual(["doğru"]);
});

test("daraltmalı analiz AST'yi değiştirmez ve her çalıştırmada bağımsız tablolar kurar", () => {
  const program = programıAl(yapı + "eğer k != yok ise { sabit başka = k; başka.ad yazdır }");
  const önce = JSON.stringify(program);
  const ilk = analizEt(program);
  const ikinci = analizEt(program);
  expect(ilk.tanılar).toEqual([]);
  expect(ikinci.tanılar).toEqual([]);
  expect(JSON.stringify(program)).toBe(önce);
  expect(ilk.sembolTipleri).not.toBe(ikinci.sembolTipleri);
  expect([...ilk.sembolTipleri.values()]).toEqual([...ikinci.sembolTipleri.values()]);
  expect([...ilk.sembolTipleri.values()]).toContainEqual(
    expect.objectContaining({
      tür: "isteğe-bağlı",
      temel: expect.objectContaining({ tür: "yapı", ad: "K" }),
    }),
  );
});

test("atama daraltılmış RHS'i kullanır, hedefi temel optional tip olarak denetler", () => {
  expect(
    kodlar(
      'değişken ad: yazı? = "Ata"; eğer ad != yok ise { ad = büyük_harf(ad); ad = yok; büyük_harf(ad) yazdır }',
    ),
  ).toEqual(["ATA4005"]);
});

test("bir kolun ataması kardeş kolun daraltmasını kirletmez", () => {
  expect(
    çalıştır(
      'değişken ad: yazı? = "Ata"; eğer ad == yok ise { ad = "Yeni" } değilse { büyük_harf(ad) yazdır }',
    ),
  ).toEqual(["ATA"]);
});

test("döngü koşulunda çağrı sonrasında yeniden test güvenli fact üretir", () => {
  expect(
    çalıştır(
      'değişken ad: yazı? = "Ata"; işlev temizle(): mantık { ad = yok; doğru döndür }; temizle() ve ad != yok iken { büyük_harf(ad) yazdır }',
    ),
  ).toEqual([]);
});
