import { expect, test } from "bun:test";
import { kaynakOluştur } from "../src/kaynak/kaynak.ts";
import { sözcüklereAyır } from "../src/sözcük/çözümleyici.ts";

test("ayrılmış sözcük ile Unicode tanımlayıcı ve anahtar kelime öneki ayrılır", () => {
  const sonuç = sözcüklereAyır(kaynakOluştur("örnek.ata", "eğer eğerli Eğer öğrenci"));
  expect(sonuç.tanılar).toEqual([]);
  expect(sonuç.tokenlar.map((token) => [token.tokenType.name, token.image])).toEqual([
    ["eğer", "eğer"],
    ["Tanımlayıcı", "eğerli"],
    ["Tanımlayıcı", "Eğer"],
    ["Tanımlayıcı", "öğrenci"],
  ]);
});

test("geçersiz kaçıştaki BMP dışı karakter mesajda ve aralıkta bölünmez", () => {
  const sonuç = sözcüklereAyır(kaynakOluştur("kaçış.ata", '"a\\😀"'));
  expect(sonuç.tanılar).toHaveLength(1);
  expect(sonuç.tanılar[0]!.mesaj).toContain("\\😀.");
  expect(sonuç.tanılar[0]!.aralık).toEqual({
    başlangıç: { satır: 1, sütun: 3, ofset: 2 },
    bitiş: { satır: 1, sütun: 6, ofset: 5 },
  });
});

test.each([
  "sabit",
  "değişken",
  "işlev",
  "döndür",
  "eğer",
  "ise",
  "değilse",
  "iken",
  "içindeki",
  "her",
  "için",
  "ve",
  "veya",
  "değil",
  "doğru",
  "yanlış",
  "yok",
  "sayı",
  "yazı",
  "mantık",
  "hiç",
  "liste",
  "yazdır",
])("%s yalnızca tam ve küçük harf eşleşmesinde ayrılmış sözcüktür", (sözcük) => {
  const büyük = sözcük.toLocaleUpperCase("tr");
  const sonuç = sözcüklereAyır(kaynakOluştur("sözcük.ata", `${sözcük} ${sözcük}li ${büyük}`));
  expect(sonuç.tanılar).toEqual([]);
  expect(sonuç.tokenlar.map((token) => token.tokenType.name)).toEqual([
    sözcük,
    "Tanımlayıcı",
    "Tanımlayıcı",
  ]);
});

test.each([
  "eğerli",
  "sabitlik",
  "işlevsel",
  "yazdırma",
  "öğrenci",
  "Öğrenci",
  "ÖĞRENCİ",
  "çözüm",
  "ölçü",
  "şehir",
  "yağmur",
  "çalıştır",
  "öğrenci_sayısı",
  "sıcaklık2",
  "_özel",
  "TürkçeDeğer",
  "αβ",
  "变量",
  "𐐀değer",
  "a\u0307",
  "değer٢",
])("%s tek bir Unicode tanımlayıcıdır", (ad) => {
  const sonuç = sözcüklereAyır(kaynakOluştur("ad.ata", ad));
  expect(sonuç.tanılar).toEqual([]);
  expect(sonuç.tokenlar.map((token) => [token.tokenType.name, token.image])).toEqual([
    ["Tanımlayıcı", ad.normalize("NFC")],
  ]);
});

test("sözcük çözümleme doğrudan verilen ayrık Unicode kaynağı da normalleştirir", () => {
  const sonuç = sözcüklereAyır({ yol: "nfc.ata", içerik: "eg\u0306er o\u0308lc\u0327u\u0308" });
  expect(
    sonuç.tokenlar.map((token) => [token.tokenType.name, token.image, token.startOffset]),
  ).toEqual([
    ["eğer", "eğer", 0],
    ["Tanımlayıcı", "ölçü", 5],
  ]);
  expect(sonuç.tanılar).toEqual([]);
});

test("rakam ve birleştirme işareti tanımlayıcı başlangıcı olamaz", () => {
  const sonuç = sözcüklereAyır(kaynakOluştur("ad.ata", "2öğrenci \u0307ad"));
  expect(sonuç.tokenlar.map((token) => token.tokenType.name)).toEqual([
    "Sayı",
    "Tanımlayıcı",
    "Tanımlayıcı",
  ]);
  expect(sonuç.tanılar.map((tanı) => tanı.kod)).toEqual(["ATA1001"]);
});

test("onluk olmayan sayı biçimleri tek bir sayı tokenı olarak desteklenmez", () => {
  const sonuç = sözcüklereAyır(kaynakOluştur("sayı.ata", "0xFF 0b10 1e3 1_000"));
  expect(sonuç.tokenlar.map((token) => token.image)).toEqual([
    "0",
    "xFF",
    "0",
    "b10",
    "1",
    "e3",
    "1",
    "_000",
  ]);
});

test.each(["\n", "\r\n", "\r"])("%j ile tam token konumları korunur", (son) => {
  const sonuç = sözcüklereAyır(kaynakOluştur("konum.ata", `sabit x = 1${son}  öğrenci >= 2`));
  const token = sonuç.tokenlar[4]!;
  expect([
    token.startLine,
    token.startColumn,
    token.endLine,
    token.endColumn,
    token.startOffset,
    token.endOffset,
  ]).toEqual([2, 3, 2, 9, 13 + son.length, 19 + son.length]);
  expect(sonuç.tanılar).toEqual([]);
});

test.each(["\n", "\r\n"])("çok satırlı açıklama sonrasında %j konumu doğrudur", (son) => {
  const sonuç = sözcüklereAyır(
    kaynakOluştur("açıklama.ata", `/* Türkçe${son}açıklama */${son}öğrenci`),
  );
  expect(sonuç.tokenlar).toHaveLength(1);
  expect([sonuç.tokenlar[0]!.startLine, sonuç.tokenlar[0]!.startColumn]).toEqual([3, 1]);
  expect(sonuç.tanılar).toEqual([]);
});

test.each(['"', '"son\\', '"kaçırılmış\\"', '"satır\nsonu', '"satır\r\nsonu'])(
  "%j yazısı kapanmadığında çökmeden tanı üretilir",
  (metin) => {
    expect(
      sözcüklereAyır(kaynakOluştur("yazı.ata", metin)).tanılar.map((tanı) => tanı.kod),
    ).toEqual(["ATA1002"]);
  },
);

test.each(["/*", "/*/", "/* Türkçe\n"])("%j açıklaması kapanmadığında tanı üretilir", (metin) => {
  const sonuç = sözcüklereAyır(kaynakOluştur("açıklama.ata", metin));
  expect(sonuç.tokenlar).toEqual([]);
  expect(sonuç.tanılar.map((tanı) => tanı.kod)).toEqual(["ATA1004"]);
});

test("geçersiz karakterde kaynak aralığı bulunur ve sonraki tokena devam edilir", () => {
  const sonuç = sözcüklereAyır(kaynakOluştur("hata.ata", "sabit değer = @\n42"));
  expect(sonuç.tanılar).toEqual([
    {
      kod: "ATA1001",
      seviye: "hata",
      mesaj: "Geçersiz karakter: '@' burada kullanılamaz.",
      yol: "hata.ata",
      aralık: {
        başlangıç: { satır: 1, sütun: 15, ofset: 14 },
        bitiş: { satır: 1, sütun: 16, ofset: 15 },
      },
    },
  ]);
  expect(sonuç.tokenlar.at(-1)!.image).toBe("42");
});

test("boş kaynak, sekmeler ve yalnızca açıklama tanısızdır", () => {
  for (const metin of ["", " \t\r\n", "// Türkçe", "/**/", "/* **/", "/* // @ */"]) {
    expect(sözcüklereAyır(kaynakOluştur("boş.ata", metin))).toEqual({ tokenlar: [], tanılar: [] });
  }
});

test("gerçek Ata örneği tanı üretmez", () => {
  const metin = `// İlk Ata programı

sabit ad = "İbrahim"
değişken sayaç = 0

eğer yaş >= 18 ise {
    "Yetişkin" yazdır
}

sayaç < 10 iken {
    sayaç += 1
}`;
  const sonuç = sözcüklereAyır(kaynakOluştur("gerçek.ata", metin));
  expect(sonuç.tanılar).toEqual([]);
  expect(sonuç.tokenlar).toHaveLength(26);
});

test("düz yazılar tek token kalır, yerleştirmeli yazılar modlarla ayrılır, açıklamalar atlanır", () => {
  const yazılar = ['""', '"Türkçe: çğıöşü İ"', String.raw`"\{ad\}"`, String.raw`"\"\\\n\r\t"`];
  const metin = `// Türkçe açıklama\n${yazılar.join(" ")} /* çok\nsatırlı */ sabit`;
  const sonuç = sözcüklereAyır(kaynakOluştur("yazı.ata", metin));
  expect(sonuç.tanılar).toEqual([]);
  expect(sonuç.tokenlar.map((token) => token.image)).toEqual([...yazılar, "sabit"]);
  expect(sonuç.tokenlar.slice(0, 4).map((token) => token.tokenType.name)).toEqual([
    "Yazı",
    "Yazı",
    "Yazı",
    "Yazı",
  ]);
});

test("kapanmayan yazı ve açıklama ile geçersiz kaçış Türkçe tanı üretir", () => {
  const sonuç = sözcüklereAyır(kaynakOluştur("hata.ata", '"a\\q" "kapanmadı\n/* kapanmadı'));
  expect(sonuç.tanılar.map((tanı) => tanı.kod)).toEqual(["ATA1003", "ATA1002", "ATA1004"]);
  expect(sonuç.tanılar.map((tanı) => tanı.mesaj)).toEqual([
    'Geçersiz kaçış dizisi: \\q. Desteklenen kaçışlar: \\", \\\\, \\n, \\r, \\t, \\{, \\}.',
    "Yazı sonlandırılmadı; kapanış çift tırnağı bekleniyor.",
    "Çok satırlı açıklama sonlandırılmadı; '*/' bekleniyor.",
  ]);
});

test("sayılar, bütün işleçler ve noktalama işaretleri en uzun eşleşmeyle ayrılır", () => {
  const metin = "0 42 3.14 0.5 = += -= *= /= %= + - * / % == != < <= > >= ( ) { } [ ] , : . ; ?";
  const sonuç = sözcüklereAyır(kaynakOluştur("işleç.ata", metin));
  expect(sonuç.tanılar).toEqual([]);
  expect(sonuç.tokenlar.map((token) => token.image)).toEqual(metin.split(" "));
  expect(sonuç.tokenlar.slice(0, 4).map((token) => token.tokenType.name)).toEqual([
    "Sayı",
    "Sayı",
    "Sayı",
    "Sayı",
  ]);
});
