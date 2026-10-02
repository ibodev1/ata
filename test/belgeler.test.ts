import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { modülleriYükle } from "../src/modüller/yükleyici.ts";
import { modülleriAnalizEt } from "../src/analiz/modüller.ts";
import { modülleriYorumla } from "../src/çalışma/modüller.ts";
import { yerleşikler } from "../src/standart/yerleşikler.ts";

test("dil referansı bütün yerleşikleri gerçek adlarıyla belgeler", async () => {
  const belge = await Bun.file(new URL("../docs/dil-referansı.md", import.meta.url)).text();
  for (const işlev of yerleşikler) expect(belge).toContain(`${işlev.ad}(`);
});

test("dil referansındaki Ata örnekleri dosya bağlamlarıyla doğrulanır; geçersiz örnek beklenen tanıyı alır", async () => {
  const belge = await Bun.file(new URL("../docs/dil-referansı.md", import.meta.url)).text();
  const örnekler = [...belge.matchAll(/```ata\r?\n([\s\S]*?)```/g)];
  expect(örnekler.length).toBeGreaterThan(0);
  // Yalnızca referansın üç adlandırılmış modülünü bağlama koy; genel Markdown parser'ı değildir.
  const modüller = [
    ...belge.matchAll(/`(matematik|modeller|sayaç)\.ata`:\r?\n\r?\n```ata\r?\n([\s\S]*?)```/g),
  ];
  expect(modüller.map((m) => m[1]).toSorted()).toEqual(["matematik", "modeller", "sayaç"]);
  const kök = await mkdtemp(join(tmpdir(), "ata-belgeler-"));
  try {
    await Promise.all(modüller.map((m) => Bun.write(join(kök, `${m[1]}.ata`), m[2]!)));
    const matematik = modüller.find((m) => m[1] === "matematik")!;
    await Bun.write(join(kök, "yardımcı/matematik.ata"), matematik[2]!);
    for (const örnek of örnekler) {
      const içerik = örnek[1]!;
      // eslint-disable-next-line no-await-in-loop -- Bağımsız belge örnekleri aynı geçici entry'de sırayla doğrulanır.
      await Bun.write(join(kök, "ana.ata"), içerik);
      // eslint-disable-next-line no-await-in-loop -- Her örnek kendi kaynak/analiz/çalışma oturumunu kurar.
      const yükleme = await modülleriYükle(join(kök, "ana.ata"));
      if (içerik.startsWith("// Geçersiz: ATA6006")) {
        expect(yükleme.tanılar.map((t) => t.kod)).toEqual(["ATA6006"]);
        expect(yükleme.grafik).toBeNull();
      } else {
        expect(yükleme.tanılar, içerik).toEqual([]);
        const grafik = yükleme.grafik;
        if (!grafik) throw new Error("Belge örneği için graph bekleniyordu.");
        const analiz = modülleriAnalizEt(grafik);
        expect(analiz.tanılar, içerik).toEqual([]);
        expect(modülleriYorumla(grafik, analiz, { çıktıYaz: () => {} }).tanılar, içerik).toEqual(
          [],
        );
      }
    }
  } finally {
    await rm(kök, { recursive: true, force: true });
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
