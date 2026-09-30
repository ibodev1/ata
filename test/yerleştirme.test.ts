import { expect, test } from "bun:test";
import { ayrıştır, analizEt, kaynakOluştur, sözcüklereAyır } from "../src/index.ts";

test("yazı içindeki normal ifade AST parçası olur ve isimleri çözümlenir", () => {
  const sonuç = ayrıştır(kaynakOluştur("yazı.ata", 'sabit yaş = 21\n"Yaş: {yaş + 1}" yazdır'));
  expect(sonuç.tanılar).toEqual([]);
  expect(sonuç.program?.bildirimler[1]).toMatchObject({
    tür: "yazdır",
    ifade: {
      tür: "yazı",
      parçalar: [
        { tür: "metin", değer: "Yaş: " },
        {
          tür: "ifade",
          ifade: { tür: "ikili", işleç: "+", sol: { ad: "yaş" }, sağ: { değer: 1 } },
        },
      ],
    },
  });
  expect(analizEt(sonuç.program!).tanılar).toEqual([]);
});

test("lexer yazı → ifade → yazı modlarında normal Ata tokenlarını korur", () => {
  const sonuç = sözcüklereAyır(kaynakOluştur("yazı.ata", '"A {kare(2) + 1} B"'));
  expect(sonuç.tanılar).toEqual([]);
  expect(sonuç.tokenlar.map((token) => [token.tokenType.name, token.image])).toEqual([
    ["YazıBaşlangıcı", '"'],
    ["YazıMetni", "A "],
    ["YerleştirmeBaşlangıcı", "{"],
    ["Tanımlayıcı", "kare"],
    ["SolParantez", "("],
    ["Sayı", "2"],
    ["SağParantez", ")"],
    ["Artı", "+"],
    ["Sayı", "1"],
    ["YerleştirmeSonu", "}"],
    ["YazıMetni", " B"],
    ["YazıSonu", '"'],
  ]);
});

test.each(["\n", "\r\n", "\r"])(
  "yerleştirme tanısı %j ve NFC sonrası doğru aralıktadır",
  (satırSonu) => {
    const sonuç = ayrıştır(
      kaynakOluştur("konum.ata", `// bas\u0327lık${satırSonu}"Ölçü: {olmayan + 1}" yazdır`),
    );
    expect(sonuç.tanılar).toEqual([]);
    expect(analizEt(sonuç.program!, "konum.ata").tanılar).toMatchObject([
      {
        kod: "ATA3001",
        yol: "konum.ata",
        aralık: {
          başlangıç: { satır: 2, sütun: 9, ofset: 17 + satırSonu.length },
          bitiş: { satır: 2, sütun: 16, ofset: 24 + satırSonu.length },
        },
      },
    ]);
  },
);

test.each([
  { metin: '"{}"', önek: "ATA2" },
  { metin: '"{1 +}"', önek: "ATA2" },
  { metin: '"{1; 2}"', önek: "ATA2" },
  { metin: '"{sabit a = 1}"', önek: "ATA2" },
  { metin: '"{kare(1,)}"', önek: "ATA2" },
  { metin: '"{1}', önek: "ATA1" },
  { metin: '"{1', önek: "ATA1" },
  { metin: '"{1 + 2"', önek: "ATA1" },
  { metin: '"a {1}\nb"', önek: "ATA1" },
  { metin: '"{(1 +\r\n2)}"', önek: "ATA1" },
  { metin: '"{1 /*\n*/ + 2}"', önek: "ATA1" },
  { metin: '"a {1}\\q"', önek: "ATA1" },
])("bozuk yerleştirme çökmeksizin ön yüz tanısı üretir: %j", ({ metin, önek }) => {
  const sonuç = ayrıştır(kaynakOluştur("hata.ata", metin));
  expect(sonuç.program).toBeNull();
  expect(sonuç.tanılar.length).toBeGreaterThan(0);
  expect(sonuç.tanılar[0]!.kod.startsWith(önek)).toBe(true);
  expect(ayrıştır(kaynakOluştur("sonra.ata", '"{1 + 2}"')).tanılar).toEqual([]);
});

test.each([
  { metin: '"{olmayan}"', kod: "ATA3001" },
  { metin: '"{1 + "a"}"', kod: "ATA4011" },
  { metin: 'işlev f(): hiç {}\n"Sonuç: {f()}" yazdır', kod: "ATA4016" },
  { metin: 'işlev f(): sayı { 1 döndür }\n"{f}"', kod: "ATA4010" },
  { metin: 'işlev f(a: sayı): sayı { a döndür }\n"{f()}"', kod: "ATA4004" },
])("yazı içi ifadeler isim ve tip denetiminden geçer: %j", ({ metin, kod }) => {
  const sonuç = ayrıştır(kaynakOluştur("anlam.ata", metin));
  expect(sonuç.tanılar).toEqual([]);
  expect(analizEt(sonuç.program!).tanılar.map((tanı) => tanı.kod)).toEqual([kod]);
});

test("birden çok yerleştirme ifadesi AST'de kaynak sırasını korur", () => {
  const sonuç = ayrıştır(kaynakOluştur("parça.ata", '"A {1} B {2} C"'));
  expect(sonuç.tanılar).toEqual([]);
  expect(sonuç.program?.bildirimler[0]).toMatchObject({
    ifade: {
      parçalar: [
        { tür: "metin", değer: "A " },
        { tür: "ifade", ifade: { değer: 1 } },
        { tür: "metin", değer: " B " },
        { tür: "ifade", ifade: { değer: 2 } },
        { tür: "metin", değer: " C" },
      ],
    },
  });
});
