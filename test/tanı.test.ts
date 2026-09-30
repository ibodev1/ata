import { expect, test } from "bun:test";
import { kaynakOluştur } from "../src/kaynak/kaynak.ts";
import { sözcüklereAyır } from "../src/sözcük/çözümleyici.ts";
import { tanıyıGöster } from "../src/tanılama/göster.ts";

test("Türkçe tanı, dosya konumu, kaynak satırı ve işaretçi gösterilir", () => {
  const kaynak = kaynakOluştur("örnek.ata", "// açıklama\r\nsabit @değer = 10");
  const tanı = sözcüklereAyır(kaynak).tanılar[0]!;
  expect(tanıyıGöster(kaynak, tanı)).toBe(
    "ATA1001 (hata): Geçersiz karakter: '@' burada kullanılamaz.\n\n  --> örnek.ata:2:7\n\n2 │ sabit @değer = 10\n          ^",
  );
});

test.each([
  { metin: "q\u0307 @", işaretçi: "      ^" },
  { metin: "变量 @", işaretçi: "         ^" },
])("Unicode terminal genişliği işaretçiyi bozmaz: %j", ({ metin, işaretçi }) => {
  const kaynak = kaynakOluştur("unicode.ata", metin);
  expect(tanıyıGöster(kaynak, sözcüklereAyır(kaynak).tanılar[0]!).split("\n").at(-1)).toBe(
    işaretçi,
  );
});

test("sekme bulunan satırda işaretçi doğru hizalanır", () => {
  const kaynak = kaynakOluştur("sekme.ata", "\t@");
  expect(tanıyıGöster(kaynak, sözcüklereAyır(kaynak).tanılar[0]!)).toContain(
    "1 │     @\n        ^",
  );
});
