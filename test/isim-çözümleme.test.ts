import { expect, test } from "bun:test";
import { ayrıştır, kaynakOluştur } from "../src/index.ts";
import { isimleriÇöz } from "../src/analiz/isim-çözümleyici.ts";

function çöz(metin: string) {
  const sonuç = ayrıştır(kaynakOluştur("isim.ata", metin));
  expect(sonuç.tanılar).toEqual([]);
  if (!sonuç.program) throw new Error("Program bekleniyordu.");
  return isimleriÇöz(sonuç.program, "isim.ata");
}

test("dış ad okunur, iç ad gölgelenir ve blok dışına çıkamaz", () => {
  const sonuç = çöz(
    "sabit dış = 10\neğer doğru ise { sabit iç = dış; sabit dış = 20; dış yazdır }\niç yazdır",
  );
  expect(sonuç.tanılar.map((tanı) => [tanı.kod, tanı.mesaj])).toEqual([
    ["ATA3001", "Tanımlanmamış isim: 'iç'."],
  ]);
  const dışlar = [...sonuç.bağlar.values()].filter((sembol) => sembol.ad === "dış");
  expect(dışlar).toHaveLength(2);
  expect(dışlar[0]).not.toBe(dışlar[1]);
});

test.each([
  { metin: "değer yazdır\nsabit değer = 1", kodlar: ["ATA3001"] },
  { metin: "sabit sayı = sayı + 1", kodlar: ["ATA3001"] },
  { metin: "sabit sayı = 1\nsabit sayı = 2", kodlar: ["ATA3002"] },
  { metin: "işlev hesapla(): sayı { 1 döndür }\nsabit hesapla = 10", kodlar: ["ATA3002"] },
  { metin: "sabit hesapla = 10\nişlev hesapla(): sayı { 1 döndür }", kodlar: ["ATA3002"] },
  { metin: "işlev f(): hiç {}\nişlev f(): hiç {}", kodlar: ["ATA3002"] },
  { metin: "işlev topla(a: sayı, a: sayı): sayı { a döndür }", kodlar: ["ATA3003"] },
  { metin: "işlev örnek(a: sayı): sayı { sabit a = 10; a döndür }", kodlar: ["ATA3002"] },
  { metin: "[1] içindeki her sayı için { sayı yazdır }\nsayı yazdır", kodlar: ["ATA3001"] },
  { metin: "işlev f(): sayı { sonra döndür }\nsabit sonra = 1", kodlar: ["ATA3001"] },
])("isim çözümleme kuralı: %j", ({ metin, kodlar }) => {
  expect(çöz(metin).tanılar.map((tanı) => tanı.kod)).toEqual([...kodlar]);
});

test.each([
  "sonuç() yazdır\nişlev sonuç(): sayı { 42 döndür }",
  "işlev f(n: sayı): sayı { f(n - 1) döndür }",
  "işlev a(): sayı { b() döndür }\nişlev b(): sayı { a() döndür }",
  "işlev f(a: sayı): sayı { eğer doğru ise { sabit a = 2; a yazdır }; a döndür }",
  "sabit sayı = 1\neğer doğru ise { sabit sayı = sayı + 1; sayı yazdır }",
])("ön bildirim ve iç kapsam gölgelemesi geçerlidir: %s", (metin) => {
  expect(çöz(metin).tanılar).toEqual([]);
});
