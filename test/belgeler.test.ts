import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { analizEt, ayrıştır, kaynakOluştur } from "../src/index.ts";
import { yerleşikler } from "../src/standart/yerleşikler.ts";

test("dil referansı bütün yerleşikleri gerçek adlarıyla belgeler", async () => {
  const belge = await Bun.file(new URL("../docs/dil-referansı.md", import.meta.url)).text();
  for (const işlev of yerleşikler) expect(belge).toContain(`${işlev.ad}(`);
});

test("dil referansındaki Ata örnekleri tip denetiminden geçer", async () => {
  const belge = await Bun.file(new URL("../docs/dil-referansı.md", import.meta.url)).text();
  const örnekler = [...belge.matchAll(/```ata\r?\n([\s\S]*?)```/g)];
  expect(örnekler.length).toBeGreaterThan(0);
  for (const örnek of örnekler) {
    const sonuç = ayrıştır(kaynakOluştur("<belge>", örnek[1]!));
    expect(sonuç.tanılar).toEqual([]);
    expect(sonuç.program).toBeDefined();
    expect(analizEt(sonuç.program!).tanılar).toEqual([]);
  }
});

test("tanı belgesi bütün kaynak kodlarını tam bir kez listeler", async () => {
  const yollar = [
    ...new Bun.Glob("src/**/*.ts").scanSync({
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      absolute: true,
    }),
  ];
  const metinler = await Promise.all(yollar.map((yol) => Bun.file(yol).text()));
  const kodlar = [
    ...new Set(
      metinler.flatMap((metin) => [...metin.matchAll(/ATA\d{4}/g)].map((eşleşme) => eşleşme[0])),
    ),
  ].toSorted();
  const belge = await Bun.file(new URL("../docs/tanılar.md", import.meta.url)).text();
  const belgelenen = [...belge.matchAll(/^\| (ATA\d{4}) \|/gm)].map((eşleşme) => eşleşme[1]);
  expect(belgelenen).toEqual(kodlar);
});
