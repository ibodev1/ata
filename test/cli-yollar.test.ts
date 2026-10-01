import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../src/cli/cli.ts", import.meta.url));

test.each([
  { mutlak: false, komut: "denetle", çıktı: "Denetim başarılı.\n" },
  { mutlak: true, komut: "denetle", çıktı: "Denetim başarılı.\n" },
  { mutlak: false, komut: "çalıştır", çıktı: "Öğrenci 🌍\n" },
  { mutlak: true, komut: "çalıştır", çıktı: "Öğrenci 🌍\n" },
])("CLI depo dışında Unicode/boşluklu yolu okur: %j", async ({ mutlak, komut, çıktı }) => {
  const geçici = await mkdtemp(join(tmpdir(), "ata yol şğ-"));
  try {
    const ad = "öğrenci 🌍 programı.ata";
    await Bun.write(join(geçici, ad), '"Öğrenci 🌍" yazdır');
    const sonuç = Bun.spawnSync(
      [process.execPath, "run", cli, komut, mutlak ? join(geçici, ad) : ad],
      { cwd: geçici },
    );
    expect(sonuç.exitCode).toBe(0);
    expect(sonuç.stdout.toString()).toBe(çıktı);
    expect(sonuç.stderr.toString()).toBe("");
  } finally {
    await rm(geçici, { recursive: true, force: true });
  }
});

test("CLI kabuk karakterli yolu yalnızca dosya adı olarak kullanır", async () => {
  const geçici = await mkdtemp(join(tmpdir(), "ata yol-"));
  try {
    const ad = process.platform === "win32" ? "öğrenci & ; ' 🌍.ata" : "öğrenci & | ; ' \" 🌍.ata";
    await Bun.write(join(geçici, ad), '"İğŞ 🌍" yazdır');
    const sonuç = Bun.spawnSync([process.execPath, "run", cli, "çalıştır", ad], { cwd: geçici });
    expect(sonuç.exitCode).toBe(0);
    expect(sonuç.stdout.toString()).toBe("İğŞ 🌍\n");
    expect(sonuç.stderr.toString()).toBe("");
  } finally {
    await rm(geçici, { recursive: true, force: true });
  }
});

test("CLI boş dosyayı kabul eder; dizin ve bozuk UTF-8'i stacksiz reddeder", async () => {
  const geçici = await mkdtemp(join(tmpdir(), "ata kaynak-"));
  try {
    await Bun.write(join(geçici, "boş.ata"), "");
    await mkdir(join(geçici, "dizin.ata"));
    await Bun.write(join(geçici, "bozuk.ata"), new Uint8Array([0xc3, 0x28]));
    for (const [ad, kod] of [
      ["boş.ata", 0],
      ["dizin.ata", 1],
      ["bozuk.ata", 1],
    ] as const) {
      const sonuç = Bun.spawnSync([process.execPath, "run", cli, "çalıştır", ad], { cwd: geçici });
      expect(sonuç.exitCode).toBe(kod);
      expect(sonuç.stdout.toString()).toBe("");
      const hata = sonuç.stderr.toString();
      if (kod === 0) expect(hata).toBe("");
      else {
        expect(hata).toContain("UTF-8");
        expect(hata).not.toMatch(/Error:|\bat .+\(.*:\d+:\d+\)/);
      }
    }
  } finally {
    await rm(geçici, { recursive: true, force: true });
  }
});
