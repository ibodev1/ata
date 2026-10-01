import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
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
