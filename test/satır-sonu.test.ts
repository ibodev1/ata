import { expect, test } from "bun:test";
import { kaynakOluştur, sözcüklereAyır } from "../src/index.ts";

test.each(["\n", "\r\n", "\r"])(
  "parser için %j satır sonları ve açıklama satırları korunur",
  (son) => {
    const kaynak = kaynakOluştur("satır.ata", `a // açıklama${son}b /* çok${son}satır */ c`);
    const sonuç = sözcüklereAyır(kaynak, { satırSonlarınıKoru: true });
    expect(sonuç.tanılar).toEqual([]);
    expect(sonuç.tokenlar.map((token) => token.image)).toEqual(["a", son, "b", son, "c"]);
    expect(sonuç.tokenlar[3]!.startLine).toBe(2);
    expect(sonuç.tokenlar[4]!.startLine).toBe(3);
  },
);
