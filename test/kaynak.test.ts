import { expect, test } from "bun:test";
import { kaynakOluştur, kaynakOku } from "../src/kaynak/kaynak.ts";
import { konumBul, aralıkBul } from "../src/kaynak/konum.ts";

test("kaynak yolu korunur ve ayrık Türkçe karakterler NFC biçimine getirilir", () => {
  const kaynak = kaynakOluştur("örnek.ata", "o\u0308g\u0306renci I\u0307");
  expect(kaynak.yol).toBe("örnek.ata");
  expect(kaynak.içerik).toBe("öğrenci İ");
});

test.each(["\n", "\r\n", "\r"])("%j satır sonunda satır ve sütun 1'den başlar", (son) => {
  const kaynak = kaynakOluştur("konum.ata", `öğrenci${son}İ`);
  const ofset = 7 + son.length;
  expect(konumBul(kaynak, ofset)).toEqual({ satır: 2, sütun: 1, ofset });
  expect(aralıkBul(kaynak, ofset, ofset + 1).bitiş).toEqual({
    satır: 2,
    sütun: 2,
    ofset: ofset + 1,
  });
});

test("boş kaynak ve dosya sonu konumları hesaplanır", () => {
  expect(konumBul(kaynakOluştur("boş.ata", ""), 0)).toEqual({ satır: 1, sütun: 1, ofset: 0 });
  expect(konumBul(kaynakOluştur("son.ata", "a\n"), 2)).toEqual({ satır: 2, sütun: 1, ofset: 2 });
});

test("UTF-8 kaynak dosyası okunur ve yolu korunur", async () => {
  const dosya = Bun.file(new URL("../README.md", import.meta.url));
  const kaynak = await kaynakOku(dosya.name!);
  expect(kaynak.yol).toBe(dosya.name!);
  expect(kaynak.içerik).toBe((await dosya.text()).normalize("NFC"));
});
