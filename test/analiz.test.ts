import { expect, test } from "bun:test";
import { ayrıştır, kaynakOluştur } from "../src/index.ts";
import { analizEt } from "../src/analiz/analiz.ts";

function denetle(metin: string) {
  const sonuç = ayrıştır(kaynakOluştur("analiz.ata", metin));
  expect(sonuç.tanılar).toEqual([]);
  if (!sonuç.program) throw new Error("Program bekleniyordu.");
  return analizEt(sonuç.program, "analiz.ata");
}

test("literal ve liste tipleri çıkarılır, açık isteğe bağlı tip ve boş liste bağlamı çalışır", () => {
  const sonuç = denetle(
    'sabit a = 1\nsabit b = "Ata"\nsabit c = doğru\nsabit d = [1, 2]\nsabit e: yazı? = yok\nsabit f: liste<sayı> = []',
  );
  expect(sonuç.tanılar).toEqual([]);
  expect([...sonuç.sembolTipleri.values()].map((tip) => tip.tür)).toEqual([
    "sayı",
    "yazı",
    "mantık",
    "liste",
    "isteğe-bağlı",
    "liste",
  ]);
  expect([...sonuç.sembolTipleri.entries()].map(([sembol, tip]) => [sembol.ad, tip])).toEqual([
    ["a", { tür: "sayı" }],
    ["b", { tür: "yazı" }],
    ["c", { tür: "mantık" }],
    ["d", { tür: "liste", eleman: { tür: "sayı" } }],
    ["e", { tür: "isteğe-bağlı", temel: { tür: "yazı" } }],
    ["f", { tür: "liste", eleman: { tür: "sayı" } }],
  ]);
});

test("döngü değişkeninin eleman tipi ve çağrının dönüş tipi yan tablolarda tutulur", () => {
  const sonuç = denetle(
    'işlev f(): yazı { "Ata" döndür }\nsabit ad = f()\n["a", "b"] içindeki her değer için { değer yazdır }',
  );
  expect(sonuç.tanılar).toEqual([]);
  const döngüTipi = [...sonuç.sembolTipleri].find(([sembol]) => sembol.tür === "döngü")?.[1];
  expect(döngüTipi).toEqual({ tür: "yazı" });
  const çağrıTipi = [...sonuç.ifadeTipleri].find(([ifade]) => ifade.tür === "çağrı")?.[1];
  expect(çağrıTipi).toEqual({ tür: "yazı" });
  expect([...sonuç.işlevİmzaları.values()]).toEqual([{ parametreler: [], dönüş: { tür: "yazı" } }]);
});

test.each([
  { metin: "sabit a = [1]\nsabit b: liste<sayı> = a", kodlar: [] },
  { metin: "sabit a = [1]\nsabit b: liste<yazı> = a", kodlar: ["ATA4001"] },
  { metin: "sabit a = [1]\nsabit b: liste<sayı?> = a", kodlar: ["ATA4001"] },
  { metin: 'değişken a: yazı? = yok\ndeğişken b: yazı? = "Ata"\na = b', kodlar: [] },
  { metin: "sabit a: liste<sayı>? = [1]\na == yok", kodlar: [] },
  { metin: "sabit a: liste<sayı>? = [1]\na == a", kodlar: ["ATA4011"] },
  { metin: '["a"] içindeki her değer için { değer + 1 }', kodlar: ["ATA4011"] },
  { metin: "işlev f(): hiç {}\nf yazdır", kodlar: ["ATA4010"] },
  { metin: "işlev f(): sayı { 1 döndür }\nf(1)", kodlar: ["ATA4004"] },
  { metin: "işlev f(x: yazı): hiç {}\nsabit a: yazı? = yok\nf(a)", kodlar: ["ATA4005"] },
  { metin: 'işlev f(): sayı { döndür; "yanlış" + 1 }', kodlar: ["ATA4006", "ATA4011"] },
  {
    metin:
      "işlev f(n: sayı): sayı { eğer n > 1 ise { 1 döndür } değilse eğer n == 1 ise { 0 döndür } }",
    kodlar: ["ATA4007"],
  },
  { metin: "sabit a = 1\na(olmayan)", kodlar: ["ATA4009", "ATA3001"] },
])("yapısal tipler ve bağımsız hata davranışı: %j", ({ metin, kodlar }) => {
  expect(denetle(metin).tanılar.map((tanı) => tanı.kod)).toEqual([...kodlar]);
});

test.each(["+=", "-=", "*=", "/=", "%="])(
  "%s bileşik ataması da değiştirilebilirlik gerektirir",
  (işleç) => {
    expect(denetle(`sabit sayı = 1\nsayı ${işleç} 1`).tanılar.map((tanı) => tanı.kod)).toEqual([
      "ATA4003",
    ]);
  },
);

test("Türkçe tip tanısı normalleştirilmiş CRLF kaynak konumunu taşır", () => {
  const sonuç = denetle('sabit o\u0308lc\u0327u\u0308 = 1\r\nölçü + "yanlış"');
  expect(sonuç.tanılar[0]).toEqual({
    kod: "ATA4011",
    seviye: "hata",
    yol: "analiz.ata",
    mesaj: "'+' işleci 'sayı' ve 'yazı' tipleriyle kullanılamaz.",
    aralık: {
      başlangıç: { satır: 2, sütun: 1, ofset: 16 },
      bitiş: { satır: 2, sütun: 16, ofset: 31 },
    },
  });
});

test.each([
  'sabit x: yazı? = "Ata"',
  'değişken x: yazı? = yok\nx = "Ata"\nx = yok',
  "sabit x: liste<sayı> = []",
  'sabit x: liste<yazı?> = ["a", yok]',
  "sabit x: liste<liste<sayı>> = [[], [1, 2]]",
  "sabit x: liste<sayı>? = []",
  'sabit a: yazı? = "Ata"\nsabit b: yazı? = a',
  "sabit a = 1 + 2 * 3 / 4 % 2 - 1",
  'sabit a = "Ata" + " Dil"',
  "sabit a = doğru ve yanlış veya doğru değil",
  "sabit a = -1",
  "sabit a = 1 < 2\nsabit b = 1 <= 2\nsabit c = 2 > 1\nsabit d = 2 >= 1",
  'sabit a = 1 == 2\nsabit b = "a" != "b"\nsabit c = doğru == yanlış',
  "sabit a: yazı? = yok\nsabit b = a == yok\nsabit c = yok != a",
  "eğer doğru ise {}\nyanlış iken {}",
  "sabit değerler = [1, 2]\ndeğerler içindeki her değer için { sabit kare = değer * değer }",
  "değişken sayı = 1\nsayı = 2\nsayı += 2\nsayı -= 2\nsayı *= 2\nsayı /= 2\nsayı %= 2",
  'değişken ad = "Ata"\nad += " Dil"',
  "sonuç() yazdır\nişlev sonuç(): sayı { 42 döndür }",
  "işlev topla(a: sayı, b: sayı): sayı { a + b döndür }\ntopla(1, 2)",
  'işlev f(x: yazı?): yazı? { x döndür }\nf(yok)\nf("Ata")',
  "işlev f(x: liste<sayı>): liste<sayı> { x döndür }\nf([])",
  "işlev f(): liste<sayı> { [] döndür }",
  "işlev geri_say(n: sayı): sayı { eğer n == 0 ise { 0 döndür }; geri_say(n - 1) döndür }",
  "işlev a(): sayı { b() döndür }\nişlev b(): sayı { a() döndür }",
  'işlev göster(): hiç { "Merhaba" yazdır }\ngöster()',
  "işlev göster(): hiç { döndür }",
  "işlev işaret(x: sayı): sayı { eğer x >= 0 ise { 1 döndür } değilse { -1 döndür } }",
  "işlev f(n: sayı): sayı { eğer n > 1 ise { 1 döndür } değilse eğer n == 1 ise { 0 döndür } değilse { -1 döndür } }",
  "işlev f(): sayı { { 1 döndür } }",
  "sabit sayı = 1\neğer doğru ise { sabit sayı = sayı + 1; sayı yazdır }",
])("geçerli anlamsal program: %s", (metin) => {
  expect(denetle(metin).tanılar).toEqual([]);
});

test.each([
  { metin: 'sabit yaş: sayı = "21"', kod: "ATA4001" },
  { metin: "sabit ad: yazı = yok", kod: "ATA4001" },
  { metin: 'sabit a: yazı? = "Ata"\nsabit b: yazı = a', kod: "ATA4001" },
  { metin: "sabit x = yok", kod: "ATA4008" },
  { metin: "sabit x = []", kod: "ATA4008" },
  { metin: 'sabit x = [1, "iki"]', kod: "ATA4001" },
  { metin: 'sabit x: liste<sayı> = [1, "iki"]', kod: "ATA4001" },
  { metin: 'sabit x = "Yaş: " + 21', kod: "ATA4011" },
  { metin: 'sabit x = "a" - "b"', kod: "ATA4011" },
  { metin: 'sabit x = "a" * 2', kod: "ATA4011" },
  { metin: "sabit x = doğru / 2", kod: "ATA4011" },
  { metin: "sabit x = yanlış % 2", kod: "ATA4011" },
  { metin: "sabit x = -doğru", kod: "ATA4011" },
  { metin: "sabit x = 1 değil", kod: "ATA4011" },
  { metin: "sabit x = 1 ve doğru", kod: "ATA4011" },
  { metin: "sabit x = doğru veya 1", kod: "ATA4011" },
  { metin: 'sabit x = "1" < 2', kod: "ATA4011" },
  { metin: 'sabit x = 1 == "1"', kod: "ATA4011" },
  { metin: "sabit x = [1] == [1]", kod: "ATA4011" },
  { metin: "eğer 1 ise {}", kod: "ATA4002" },
  { metin: "1 iken {}", kod: "ATA4002" },
  { metin: "1 içindeki her sayı için {}", kod: "ATA4012" },
  { metin: "sabit sayaç = 0\nsayaç = 1", kod: "ATA4003" },
  { metin: "işlev f(a: sayı): hiç { a = 1 }", kod: "ATA4003" },
  { metin: "[1] içindeki her sayı için { sayı = 1 }", kod: "ATA4003" },
  { metin: 'değişken sayı = 1\nsayı = "iki"', kod: "ATA4001" },
  { metin: 'değişken sayı = 1\nsayı += "iki"', kod: "ATA4011" },
  { metin: 'değişken ad = "a"\nad -= "b"', kod: "ATA4011" },
  { metin: "değişken a: sayı? = 1\na += 1", kod: "ATA4011" },
  { metin: "işlev topla(a: sayı, b: sayı): sayı { a + b döndür }\ntopla(1)", kod: "ATA4004" },
  { metin: 'işlev topla(a: sayı, b: sayı): sayı { a + b döndür }\ntopla("1", 2)', kod: "ATA4005" },
  { metin: "sabit a = 1\na()", kod: "ATA4009" },
  { metin: "işlev f(): sayı { 1 döndür }\nsabit a = f", kod: "ATA4010" },
  { metin: "işlev göster(): hiç {}\ngöster() yazdır", kod: "ATA4015" },
  { metin: "işlev göster(): hiç { 1 döndür }", kod: "ATA4006" },
  { metin: "işlev kare(x: sayı): sayı { döndür }", kod: "ATA4006" },
  { metin: 'işlev kare(x: sayı): sayı { "x" döndür }', kod: "ATA4006" },
  { metin: "1 döndür", kod: "ATA4013" },
  { metin: "işlev işaret(x: sayı): sayı { eğer x >= 0 ise { 1 döndür } }", kod: "ATA4007" },
  { metin: "işlev f(): sayı { doğru iken { 1 döndür } }", kod: "ATA4007" },
])("anlamsal hata kodu tutarlıdır: %j", ({ metin, kod }) => {
  expect(denetle(metin).tanılar.map((tanı) => tanı.kod)).toEqual([kod]);
});

test("tanımsız isim hatası zincirlenmez ve bağımsız hatalar kaybolmaz", () => {
  expect(denetle("olmayan + 1").tanılar.map((tanı) => tanı.kod)).toEqual(["ATA3001"]);
  expect(denetle("olmayan() yazdır").tanılar.map((tanı) => tanı.kod)).toEqual(["ATA3001"]);
  const sonuç = denetle('olmayan + 1\nsabit yaş: sayı = "21"\nsabit sayaç = 1\nsayaç = 2\n-doğru');
  expect(sonuç.tanılar.map((tanı) => tanı.kod)).toEqual([
    "ATA3001",
    "ATA4001",
    "ATA4003",
    "ATA4011",
  ]);
  expect(sonuç.tanılar.every((tanı) => tanı.yol === "analiz.ata")).toBe(true);
});

test("AST değişmez kalır ve her analiz kendi bilgilerini üretir", () => {
  const sonuç = ayrıştır(kaynakOluştur("iyi.ata", "değişken sayaç = 1\nsayaç += 1"));
  const program = sonuç.program!;
  const önce = JSON.stringify(program);
  const a = analizEt(program);
  const b = analizEt(program);
  expect(a.tanılar).toEqual([]);
  expect(b.tanılar).toEqual([]);
  expect(JSON.stringify(program)).toBe(önce);
  expect(a.ifadeTipleri).not.toBe(b.ifadeTipleri);
});

test("parser dışından gelen iç içe isteğe bağlı tip anlamsal tanı üretir", () => {
  const sonuç = ayrıştır(kaynakOluştur("tip.ata", 'sabit x: yazı? = "Ata"'));
  const program = sonuç.program!;
  const bildirim = program.bildirimler[0]!;
  if (bildirim.tür !== "sabit" || !bildirim.açıkTip) throw new Error("Açık tip bekleniyordu.");
  const değiştirilmiş = {
    ...program,
    bildirimler: [
      {
        ...bildirim,
        açıkTip: {
          tür: "isteğe-bağlı-tip" as const,
          temel: bildirim.açıkTip,
          aralık: bildirim.açıkTip.aralık,
        },
      },
    ],
  };
  expect(analizEt(değiştirilmiş).tanılar.map((tanı) => tanı.kod)).toEqual(["ATA4014"]);
});

test("gerçek Ata programı bütün ön yüz ve analiz katmanlarından tanısız geçer", () => {
  const metin = `işlev kare(sayı: sayı): sayı {
    sayı * sayı döndür
}
işlev yetişkin_mi(yaş: sayı): mantık {
    eğer yaş >= 18 ise { doğru döndür }
    yanlış döndür
}
sabit ad = "İbrahim"
sabit yaş = 21
sabit sayılar = [1, 2, 3, 4, 5]
eğer yetişkin_mi(yaş) ise {
    "{ad} yetişkindir." yazdır
} değilse {
    "{ad} henüz yetişkin değildir." yazdır
}
sayılar içindeki her sayı için {
    kare(sayı) yazdır
}`;
  expect(denetle(metin).tanılar).toEqual([]);
});
