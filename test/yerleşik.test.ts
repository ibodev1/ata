import { expect, test } from "bun:test";
import { kaynakOluştur, ayrıştır, analizEt, yorumla, sözcüklereAyır } from "../src/index.ts";

function programıAl(metin: string) {
  const sonuç = ayrıştır(kaynakOluştur("yerleşik.ata", metin));
  expect(sonuç.tanılar).toEqual([]);
  if (!sonuç.program) throw new Error("Program bekleniyordu.");
  return sonuç.program;
}

function çalıştır(metin: string) {
  const program = programıAl(metin);
  expect(analizEt(program, "yerleşik.ata").tanılar).toEqual([]);
  const çıktı: string[] = [];
  const sonuç = yorumla(program, { yol: "yerleşik.ata", çıktıYaz: (satır) => çıktı.push(satır) });
  return { çıktı, tanılar: sonuç.tanılar };
}

test("yerleşik uzunluk bütün pipeline boyunca yazı ve liste boyutunu hesaplar", () => {
  expect(çalıştır('uzunluk("Ata") yazdır\nuzunluk([1, 2, 3]) yazdır\nuzunluk([]) yazdır')).toEqual({
    çıktı: ["3", "3", "0"],
    tanılar: [],
  });
});

test("girdi senkron sağlayıcıya istemi aynen aktarır ve dönen metni kullanır", () => {
  const program = programıAl('sabit ad = girdi("Adınız: ")\n"Merhaba {ad}" yazdır');
  expect(analizEt(program).tanılar).toEqual([]);
  const istemler: string[] = [];
  const çıktı: string[] = [];
  const sonuç = yorumla(program, {
    çıktıYaz: (satır) => çıktı.push(satır),
    girdiOku: (istem) => {
      istemler.push(istem);
      return "İbrahim";
    },
  });
  expect(sonuç.tanılar).toEqual([]);
  expect(istemler).toEqual(["Adınız: "]);
  expect(çıktı).toEqual(["Merhaba İbrahim"]);
});

test("yazıya merkezi gösterimi, harf dönüşümleri Türkçe locale'i kullanır", () => {
  expect(
    çalıştır(
      'yazıya(doğru) yazdır\nyazıya(yok) yazdır\nyazıya([1, 2]) yazdır\nbüyük_harf("istanbul") yazdır\nküçük_harf("IĞDIR") yazdır\nküçük_harf("İSTANBUL") yazdır',
    ),
  ).toEqual({
    çıktı: ["doğru", "yok", "[1, 2]", "İSTANBUL", "ığdır", "istanbul"],
    tanılar: [],
  });
});

test("yazı yardımcıları kırpma ve büyük/küçük harfe duyarlı arama yapar", () => {
  expect(
    çalıştır(
      'kırp("  Ata  ") yazdır\niçerir("Ata Dil", "Dil") yazdır\niçerir("Ata Dil", "ata") yazdır\nbaşlar_mı("Ata Dil", "Ata") yazdır\nbiter_mi("Ata Dil", "Dil") yazdır',
    ),
  ).toEqual({
    çıktı: ["Ata", "doğru", "yanlış", "doğru", "doğru"],
    tanılar: [],
  });
});

const adlar = [
  "girdi",
  "uzunluk",
  "yazıya",
  "büyük_harf",
  "küçük_harf",
  "kırp",
  "içerir",
  "başlar_mı",
  "biter_mi",
];

test.each(adlar)(
  "%s normal tanımlayıcıdır, globalde tanımlıdır ve değer olarak kullanılamaz",
  (ad) => {
    const sözcükler = sözcüklereAyır(kaynakOluştur("ad.ata", ad));
    expect(sözcükler.tanılar).toEqual([]);
    expect(sözcükler.tokenlar[0]?.tokenType.name).toBe("Tanımlayıcı");
    expect(analizEt(programıAl(`sabit f = ${ad}`)).tanılar.map((tanı) => tanı.kod)).toEqual([
      "ATA4010",
    ]);
  },
);

test.each(adlar)("%s global değer ve işlev bildirimiyle çakışır, iç blokta gölgelenir", (ad) => {
  for (const metin of [`sabit ${ad} = 10`, `işlev ${ad}(): yazı { "x" döndür }`]) {
    expect(analizEt(programıAl(metin)).tanılar.map((tanı) => tanı.kod)).toContain("ATA3002");
  }
  expect(çalıştır(`eğer doğru ise { sabit ${ad} = 10; ${ad} yazdır }`).çıktı).toEqual(["10"]);
});

test.each([
  "girdi(1)",
  "uzunluk(42)",
  "uzunluk(doğru)",
  "uzunluk(yok)",
  "büyük_harf(42)",
  "küçük_harf(yok)",
  "kırp([1])",
  'içerir("Ata", 1)',
  'başlar_mı(1, "Ata")',
  'biter_mi("Ata", yanlış)',
  "değişken ad: yazı? = yok; uzunluk(ad)",
  "değişken ad: liste<sayı>? = yok; uzunluk(ad)",
  "işlev f(): hiç {}; yazıya(f())",
])("yanlış yerleşik argüman tipi reddedilir: %s", (metin) => {
  expect(analizEt(programıAl(metin)).tanılar.map((tanı) => tanı.kod)).toContain("ATA4005");
  expect(
    yorumla(programıAl(metin), { çıktıYaz: () => {} }).tanılar.map((tanı) => tanı.kod),
  ).toContain("ATA5005");
});

test.each([
  'girdi("a", "b")',
  "uzunluk()",
  'uzunluk("a", "b")',
  "yazıya()",
  "yazıya(1, 2)",
  "büyük_harf()",
  'büyük_harf("a", "b")',
  "küçük_harf()",
  'küçük_harf("a", "b")',
  "kırp()",
  'kırp("a", "b")',
  'içerir("a")',
  'içerir("a", "b", "c")',
  'başlar_mı("a")',
  'başlar_mı("a", "b", "c")',
  'biter_mi("a")',
  'biter_mi("a", "b", "c")',
])("yanlış yerleşik argüman sayısı analizde ve runtime'da korunur: %s", (metin) => {
  expect(analizEt(programıAl(metin)).tanılar.map((tanı) => tanı.kod)).toContain("ATA4004");
  expect(
    yorumla(programıAl(metin), { çıktıYaz: () => {} }).tanılar.map((tanı) => tanı.kod),
  ).toEqual(["ATA5005"]);
});

test("tanımsız argüman gereksiz tip hatası üretmez", () => {
  expect(analizEt(programıAl("uzunluk(olmayan)")).tanılar.map((tanı) => tanı.kod)).toEqual([
    "ATA3001",
  ]);
});

test("yerleşik çağrılar dönüş tiplerini çıkarır ve heterojen listeyi kabul etmez", () => {
  expect(
    analizEt(
      programıAl(
        'sabit a: sayı = uzunluk([]); sabit b: yazı = yazıya([]); sabit c: mantık = içerir("a", "b"); sabit d: yazı = girdi()',
      ),
    ).tanılar,
  ).toEqual([]);
  expect(analizEt(programıAl('uzunluk([1, "a"])')).tanılar.length).toBeGreaterThan(0);
});

test("parametre gölgelemesi ve blok bitiminde global yerleşiğe dönüş çalışır", () => {
  expect(
    çalıştır(
      'işlev f(uzunluk: sayı): sayı { uzunluk döndür }\nf(4) yazdır\neğer doğru ise { sabit uzunluk = 9; uzunluk yazdır }\nuzunluk("ata") yazdır',
    ).çıktı,
  ).toEqual(["4", "9", "3"]);
});

test.each([
  ['uzunluk("")', "0"],
  ['uzunluk("çğıöşü")', "6"],
  ['uzunluk("😊")', "1"],
  ['uzunluk("a😊𐐀")', "3"],
  ['uzunluk("e\u0301")', "1"],
  ['uzunluk("👩‍💻")', "3"],
  ['uzunluk(["a", "b"])', "2"],
  ['büyük_harf("ısparta")', "ISPARTA"],
  ['büyük_harf("iIİı")', "İIİI"],
  ['küçük_harf("iIİı")', "iıiı"],
  ['kırp("\u00a0\u2003Ata Dil\u2003\u00a0")', "Ata Dil"],
  ['kırp("")', ""],
  ['içerir("😊Ata", "😊")', "doğru"],
  ['başlar_mı("Ata", "ata")', "yanlış"],
  ['biter_mi("Ata", "TA")', "yanlış"],
  ['içerir("Ata", "")', "doğru"],
  ['başlar_mı("", "")', "doğru"],
  ['biter_mi("", "")', "doğru"],
  ["yazıya(42)", "42"],
  ["yazıya(3.14)", "3.14"],
  ['yazıya("Ata")', "Ata"],
  ["yazıya(yanlış)", "yanlış"],
  ["yazıya([])", "[]"],
  ['yazıya(["a", "b"])', '["a", "b"]'],
])("Unicode ve değer gösterimi: %s → %s", (ifade, beklenen) => {
  expect(çalıştır(`${ifade} yazdır`).çıktı).toEqual([beklenen]);
});

test("isteğe bağlı değer ve merkezi gösterim yazdır/yerleştirme/yazıya için aynıdır", () => {
  expect(
    çalıştır(
      'değişken a: sayı? = yok; yazıya(a) yazdır; a = 42; yazıya(a) yazdır; sabit l = [doğru, yanlış]; l yazdır; "{l}" yazdır; yazıya(l) yazdır',
    ).çıktı,
  ).toEqual(["yok", "42", "[doğru, yanlış]", "[doğru, yanlış]", "[doğru, yanlış]"]);
});

test("kaynak → analiz → runtime yerleşik zinciri", () => {
  expect(
    çalıştır('sabit ad = büyük_harf("ata"); sabit boyut = uzunluk(ad); "{ad}: {boyut}" yazdır')
      .çıktı,
  ).toEqual(["ATA: 3"]);
});

test("girdi boş istemi, boş cevabı ve ardışık çağrıları korur", () => {
  const istemler: string[] = [];
  const çıktı: string[] = [];
  const program = programıAl('girdi() yazdır; girdi("Ad: ") yazdır');
  expect(analizEt(program).tanılar).toEqual([]);
  expect(
    yorumla(program, {
      çıktıYaz: (metin) => çıktı.push(metin),
      girdiOku: (istem) => {
        istemler.push(istem);
        return istemler.length === 1 ? "" : "İbrahim";
      },
    }).tanılar,
  ).toEqual([]);
  expect(istemler).toEqual(["", "Ad: "]);
  expect(çıktı).toEqual(["", "İbrahim"]);
});

test("girdi tam pipeline içinde Türkçe dönüşüm ve yerleştirmeyle çalışır", () => {
  const program = programıAl('sabit ad = girdi("Adınız: "); "Merhaba {büyük_harf(ad)}!" yazdır');
  expect(analizEt(program).tanılar).toEqual([]);
  const çıktı: string[] = [];
  expect(
    yorumla(program, { çıktıYaz: (metin) => çıktı.push(metin), girdiOku: () => "İbrahim" }).tanılar,
  ).toEqual([]);
  expect(çıktı).toEqual(["Merhaba İBRAHİM!"]);
});

test.each(["eksik", "null", "hata"])(
  "girdi sağlayıcısı %s olduğunda yalnızca ATA5007 üretir ve durur",
  (durum) => {
    const çıktı: string[] = [];
    const seçenekler = { çıktıYaz: (metin: string) => çıktı.push(metin) };
    const sonuç = yorumla(
      programıAl('"önce" yazdır; girdi(); "sonra" yazdır'),
      durum === "eksik"
        ? seçenekler
        : {
            ...seçenekler,
            girdiOku: () => {
              if (durum === "hata") throw new Error("gizli Bun ayrıntısı");
              return null;
            },
          },
    );
    expect(sonuç.tanılar.map((tanı) => [tanı.kod, tanı.mesaj])).toEqual([
      ["ATA5007", "Girdi okunamadı."],
    ]);
    expect(çıktı).toEqual(["önce"]);
  },
);
