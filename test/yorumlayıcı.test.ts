import { expect, test } from "bun:test";
import { ayrıştır, analizEt, kaynakOluştur, yorumla } from "../src/index.ts";
import type { Program } from "../src/index.ts";

function çalıştır(metin: string) {
  const kaynak = kaynakOluştur("çalışma.ata", metin);
  const ayrışmış = ayrıştır(kaynak);
  expect(ayrışmış.tanılar).toEqual([]);
  if (!ayrışmış.program) throw new Error("Program bekleniyordu.");
  expect(analizEt(ayrışmış.program, kaynak.yol).tanılar).toEqual([]);
  const çıktı: string[] = [];
  const sonuç = yorumla(ayrışmış.program, {
    yol: kaynak.yol,
    çıktıYaz: (satır) => çıktı.push(satır),
  });
  return { çıktı, tanılar: sonuç.tanılar };
}

test("kaynak → AST → analiz → yorumlayıcı gerçek Ata değerleri yazdırır", () => {
  expect(
    çalıştır(
      '42 yazdır\n"Merhaba" yazdır\ndoğru yazdır\nyanlış yazdır\nyok yazdır\n[1, 2, 3] yazdır',
    ),
  ).toEqual({
    çıktı: ["42", "Merhaba", "doğru", "yanlış", "yok", "[1, 2, 3]"],
    tanılar: [],
  });
});

test("aritmetik öncelik, yazı toplama, tekli ve karşılaştırma Ata kurallarıyla çalışır", () => {
  expect(
    çalıştır(
      '1 + 2 * 3 yazdır\n(10 - 2) / 4 % 2 yazdır\n-3 yazdır\n"Ata" + " Dil" yazdır\n1 < 2 yazdır\ndoğru değil yazdır',
    ),
  ).toEqual({
    çıktı: ["7", "0", "-3", "Ata Dil", "doğru", "yanlış"],
    tanılar: [],
  });
});

test("değerler, atamalar ve blok gölgelemesi lexical ortamları kullanır", () => {
  expect(
    çalıştır(
      'değişken x = 1\nx = 2\nx += 3\nx -= 1\nx *= 2\nx /= 2\nx %= 3\neğer doğru ise { sabit x = x + 10; x yazdır }\nx yazdır\ndeğişken ad = "Ata"\nad += " Dil"\nad yazdır',
    ),
  ).toEqual({
    çıktı: ["11", "1", "Ata Dil"],
    tanılar: [],
  });
});

test("iken koşulu yeniden değerlendirilir, liste döngüsü her turda taze kapsam açar", () => {
  expect(
    çalıştır(
      "değişken sayaç = 0\nsayaç < 3 iken { sabit önce = sayaç; önce yazdır; sayaç += 1 }\nsabit sayı = 10\n[1, 2, 3] içindeki her sayı için { sabit iki = sayı * 2; iki yazdır }\nsayı yazdır",
    ),
  ).toEqual({
    çıktı: ["0", "1", "2", "2", "4", "6", "10"],
    tanılar: [],
  });
});

test("ön bildirilen işlev lexical ortamına bağlanır, parametre ve dönüşlerle özyineleme yapar", () => {
  expect(
    çalıştır(
      'faktöriyel(5) yazdır\nişlev faktöriyel(n: sayı): sayı { eğer n <= 1 ise { 1 döndür }; n * faktöriyel(n - 1) döndür }\nsabit sayı = 7\nişlev oku(): sayı { sayı döndür }\neğer doğru ise { sabit sayı = 20; oku() yazdır }\nişlev selamla(ad: yazı): hiç { "Merhaba {ad}" yazdır; döndür; "ulaşılmaz" yazdır }\nselamla("Ata")',
    ),
  ).toEqual({
    çıktı: ["120", "7", "Merhaba Ata"],
    tanılar: [],
  });
});

test.each([
  { metin: '"" yazdır', çıktı: [""] },
  { metin: '"Merhaba {1 + 2}!" yazdır', çıktı: ["Merhaba 3!"] },
  { metin: 'sabit ölçü = 2\n"Ölçü: {ölçü}, {ölçü * 3}" yazdır', çıktı: ["Ölçü: 2, 6"] },
  { metin: 'sabit x = "Ata"\nsabit y = 2\n"A {x} B {y} C" yazdır', çıktı: ["A Ata B 2 C"] },
  { metin: String.raw`"\{literal\}"` + " yazdır", çıktı: ["{literal}"] },
  { metin: String.raw`"\"\\\n\r\t\{\}"` + " yazdır", çıktı: ['"\\\n\r\t{}'] },
  { metin: '"{doğru}, {yanlış}, {yok}, {[1, 2]}" yazdır', çıktı: ["doğru, yanlış, yok, [1, 2]"] },
  {
    metin: 'değişken ad: yazı? = yok\n"{ad}" yazdır\nad = "Ata"\n"{ad}" yazdır',
    çıktı: ["yok", "Ata"],
  },
  {
    metin: '["Ata", "Dil"] yazdır\n[[1, 2], [3]] yazdır',
    çıktı: ['["Ata", "Dil"]', "[[1, 2], [3]]"],
  },
  { metin: 'sabit a: liste<yazı?> = ["Ata", yok]\n"{a}" yazdır', çıktı: ['["Ata", yok]'] },
  { metin: '"{"iç {2 + 3}"}" yazdır', çıktı: ["iç 5"] },
  { metin: '"{"a" + "b"}" yazdır', çıktı: ["ab"] },
  {
    metin:
      '1 <= 1 yazdır\n2 > 1 yazdır\n2 >= 2 yazdır\n1 == 1 yazdır\n1 != 2 yazdır\n"ata" == "ata" yazdır\ndoğru != yanlış yazdır',
    çıktı: Array<string>(7).fill("doğru"),
  },
  {
    metin:
      "sabit a: sayı? = yok\na == yok yazdır\na != 1 yazdır\nsabit b: sayı? = 1\nb == 1 yazdır\nb != yok yazdır",
    çıktı: ["doğru", "doğru", "doğru", "doğru"],
  },
  { metin: "sabit a: liste<sayı>? = [1]\na == yok yazdır", çıktı: ["yanlış"] },
  {
    metin:
      'eğer yanlış ise { "yanlış kol" yazdır } değilse eğer doğru ise { "seçilen" yazdır } değilse { "diğer" yazdır }',
    çıktı: ["seçilen"],
  },
  {
    metin:
      "yanlış iken { 1 / 0 yazdır }\nsabit boş: liste<sayı> = []\nboş içindeki her n için { n yazdır }",
    çıktı: [],
  },
  {
    metin:
      "işlev topla(a: sayı, b: sayı): sayı { a + b döndür }\ntopla(topla(1, 2), topla(3, 4)) yazdır\ntopla(5, 6) yazdır",
    çıktı: ["10", "11"],
  },
  { metin: 'işlev f(): hiç {}\nf()\n"bitti" yazdır', çıktı: ["bitti"] },
  {
    metin: "işlev f(): sayı { doğru iken { eğer doğru ise { 7 döndür } }; 0 döndür }\nf() yazdır",
    çıktı: ["7"],
  },
  {
    metin: "işlev f(): sayı { [3, 4] içindeki her n için { { n döndür } }; 0 döndür }\nf() yazdır",
    çıktı: ["3"],
  },
  {
    metin:
      "işlev a(n: sayı): mantık { eğer n == 0 ise { doğru döndür }; b(n - 1) döndür }\nişlev b(n: sayı): mantık { eğer n == 0 ise { yanlış döndür }; a(n - 1) döndür }\na(4) yazdır",
    çıktı: ["doğru"],
  },
  {
    metin:
      "işlev toplam(n: sayı): sayı { eğer n == 0 ise { 0 döndür }; n + toplam(n - 1) döndür }\ntoplam(5) yazdır",
    çıktı: ["15"],
  },
  { metin: "değişken x = 1\n(x = 2) yazdır\n(x += 3) yazdır\nx yazdır", çıktı: ["2", "5", "5"] },
  {
    metin:
      'değişken x = 1\nişlev artır(): sayı { x += 1; x döndür }\n"{artır()} {artır()}" yazdır\nx yazdır',
    çıktı: ["2 3", "3"],
  },
])("çalışma zamanı davranışı: %j", ({ metin, çıktı }) => {
  expect(çalıştır(metin)).toEqual({ çıktı: [...çıktı], tanılar: [] });
});

test.each([
  { ifade: "yanlış ve yan_etki()", çıktı: ["yanlış"] },
  { ifade: "doğru veya yan_etki()", çıktı: ["doğru"] },
  { ifade: "doğru ve yan_etki()", çıktı: ["çalıştı", "doğru"] },
  { ifade: "yanlış veya yan_etki()", çıktı: ["çalıştı", "doğru"] },
])("kısa devre yan etkili çağrıyı gerektiğinde yürütür: %j", ({ ifade, çıktı }) => {
  expect(
    çalıştır(`işlev yan_etki(): mantık { "çalıştı" yazdır; doğru döndür }\n${ifade} yazdır`),
  ).toEqual({ çıktı: [...çıktı], tanılar: [] });
});

test.each([
  { metin: "1 / 0 yazdır", kod: "ATA5001" },
  { metin: "1 % 0 yazdır", kod: "ATA5002" },
  { metin: "1 / -0 yazdır", kod: "ATA5001" },
  { metin: "değişken a = 1\na /= 0", kod: "ATA5001" },
  { metin: "değişken a = 1\na %= 0", kod: "ATA5002" },
  { metin: `${"9".repeat(308)}.0 * 2 yazdır`, kod: "ATA5003" },
  { metin: `${"9".repeat(308)}.0 + ${"9".repeat(308)}.0 yazdır`, kod: "ATA5003" },
  { metin: `-${"9".repeat(308)}.0 - ${"9".repeat(308)}.0 yazdır`, kod: "ATA5003" },
  { metin: '"{1 / 0}" yazdır', kod: "ATA5001" },
  { metin: "işlev f(): sayı { f() döndür }\nf()", kod: "ATA5006" },
  { metin: "f()\nsabit a = 1\nişlev f(): sayı { a döndür }", kod: "ATA5004" },
])("beklenen çalışma zamanı hatası Türkçe tanı olur: %j", ({ metin, kod }) => {
  const sonuç = çalıştır(metin);
  expect(sonuç.çıktı).toEqual([]);
  expect(sonuç.tanılar).toHaveLength(1);
  expect(sonuç.tanılar[0]).toMatchObject({ kod, seviye: "hata", yol: "çalışma.ata" });
});

test("çalışma zamanı hatasında sonraki bildirim yürütülmez, önceki çıktı korunur", () => {
  const sonuç = çalıştır('"önce" yazdır\n1 / 0 yazdır\n"sonra" yazdır');
  expect(sonuç.çıktı).toEqual(["önce"]);
  expect(sonuç.tanılar[0]).toMatchObject({
    kod: "ATA5001",
    aralık: {
      başlangıç: { satır: 2, sütun: 1, ofset: 14 },
      bitiş: { satır: 2, sütun: 6, ofset: 19 },
    },
  });
});

test.each([
  { metin: "olmayan yazdır", kod: "ATA5004" },
  { metin: "sabit a = 1\nsabit a = 2", kod: "ATA5004" },
  { metin: "sabit a = 1\na = 2", kod: "ATA5004" },
  { metin: "işlev f(a: sayı): hiç { a = 2 }\nf(1)", kod: "ATA5004" },
  { metin: "[1] içindeki her a için { a = 2 }", kod: "ATA5004" },
  { metin: "sabit a = 1\na()", kod: "ATA5005" },
  { metin: "1()", kod: "ATA5005" },
  { metin: "işlev f(a: sayı): hiç {}\nf()", kod: "ATA5005" },
  { metin: "işlev f(): sayı {}\nf()", kod: "ATA5005" },
  { metin: "işlev f(): hiç { 1 döndür }\nf()", kod: "ATA5005" },
  { metin: "işlev f(): hiç {}\nf yazdır", kod: "ATA5005" },
  { metin: "işlev f(): hiç {}\nf() yazdır", kod: "ATA5005" },
  { metin: 'işlev f(): hiç {}\n"{f()}" yazdır', kod: "ATA5005" },
  { metin: "1 döndür", kod: "ATA5005" },
  { metin: "eğer 1 ise {}", kod: "ATA5005" },
  { metin: '"a" iken {}', kod: "ATA5005" },
  { metin: "1 içindeki her a için {}", kod: "ATA5005" },
  { metin: "1 ve doğru", kod: "ATA5005" },
  { metin: "yanlış veya 1", kod: "ATA5005" },
  { metin: '"1" + 1', kod: "ATA5005" },
  { metin: "-doğru", kod: "ATA5005" },
  { metin: "1 değil", kod: "ATA5005" },
  { metin: "[1] == [1]", kod: "ATA5005" },
])("analiz atlanırsa yorumlayıcı invariant ihlalinde güvenli tanı verir: %j", ({ metin, kod }) => {
  const ayrışmış = ayrıştır(kaynakOluştur("koruma.ata", metin));
  expect(ayrışmış.tanılar).toEqual([]);
  const sonuç = yorumla(ayrışmış.program!, { çıktıYaz: () => {} });
  expect(sonuç.tanılar.map((tanı) => tanı.kod)).toEqual([kod]);
});

test("yorumlayıcı AST birim sınırında çalışır; her çalıştırma bağımsız ortam kurar", () => {
  const aralık = {
    başlangıç: { satır: 1, sütun: 1, ofset: 0 },
    bitiş: { satır: 1, sütun: 3, ofset: 2 },
  };
  const program: Program = {
    tür: "program",
    kullanBildirimleri: [],
    aralık,
    bildirimler: [
      {
        tür: "değişken",
        ad: "a",
        açıkTip: null,
        başlangıç: { tür: "sayı", değer: 1, aralık },
        aralık,
      },
      {
        tür: "yazdır",
        aralık,
        ifade: {
          tür: "atama",
          ad: "a",
          işleç: "+=",
          değer: { tür: "sayı", değer: 1, aralık },
          aralık,
        },
      },
    ],
  };
  const önce = JSON.stringify(program);
  const çıktı: string[] = [];
  for (let tur = 0; tur < 2; tur++)
    expect(yorumla(program, { çıktıYaz: (satır) => çıktı.push(satır) }).tanılar).toEqual([]);
  expect(çıktı).toEqual(["2", "2"]);
  expect(JSON.stringify(program)).toBe(önce);
});

test("çıktı callback'inin beklenmeyen hatası runtime tanısı olarak yutulmaz", () => {
  const program = ayrıştır(kaynakOluştur("callback.ata", "1 yazdır")).program!;
  const hata = new Error("Çıktı sistemi arızalı.");
  expect(() =>
    yorumla(program, {
      çıktıYaz: () => {
        throw hata;
      },
    }),
  ).toThrow(hata);
});

test("argümanlar ve liste elemanları soldan sağa değerlendirilir", () => {
  expect(
    çalıştır(
      "değişken sayaç = 0\nişlev sıradaki(): sayı { sayaç += 1; sayaç döndür }\nişlev birleştir(a: sayı, b: sayı): sayı { a * 10 + b döndür }\nbirleştir(sıradaki(), sıradaki()) yazdır\n[sıradaki(), sıradaki()] yazdır",
    ),
  ).toEqual({ çıktı: ["12", "[3, 4]"], tanılar: [] });
});

test("tam program lexer, parser, analiz ve yorumlayıcıdan beklenen çıktıyla geçer", () => {
  expect(
    çalıştır(`işlev kare(sayı: sayı): sayı { sayı * sayı döndür }
işlev yetişkin_mi(yaş: sayı): mantık {
  eğer yaş >= 18 ise { doğru döndür }
  yanlış döndür
}
sabit ad = "İbrahim"
sabit yaş = 21
sabit sayılar = [1, 2, 3, 4, 5]
eğer yetişkin_mi(yaş) ise { "{ad} yetişkindir." yazdır }
değilse { "{ad} henüz yetişkin değildir." yazdır }
sayılar içindeki her sayı için { "{sayı} → {kare(sayı)}" yazdır }`),
  ).toEqual({
    çıktı: ["İbrahim yetişkindir.", "1 → 1", "2 → 4", "3 → 9", "4 → 16", "5 → 25"],
    tanılar: [],
  });
});
