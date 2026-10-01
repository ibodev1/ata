import { lstat, mkdtemp, readdir, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { hedefler, projeKökü } from "./derle.ts";

export async function runtimeBul(hedef: (typeof hedefler)[number]): Promise<string> {
  if (hedef.platform === process.platform && hedef.mimari === process.arch) return process.execPath;
  const ad = `${hedef.hedef.replace(/arm64$/, "aarch64")}-v${Bun.version}`;
  const dizin = resolve(projeKökü, ".bun-cache");
  const adaylar = await readdir(dizin).catch((hata: unknown) => {
    if (hata instanceof Error && "code" in hata && hata.code === "ENOENT") return [];
    throw hata;
  });
  const dosya = adaylar.find((aday) => aday === ad || aday === `${ad}.exe`);
  if (!dosya)
    throw new Error(
      `Yerel Bun runtime eksik: ${ad}. Önce bun run release:runtime çalıştırın (ağ kullanır).`,
    );
  const yol = join(dizin, dosya);
  const bilgi = await lstat(yol);
  if (!bilgi.isFile() || bilgi.isSymbolicLink() || bilgi.size === 0)
    throw new Error(`Geçersiz runtime: ${yol}`);
  return yol;
}

async function hazırla() {
  const geçici = await mkdtemp(join(tmpdir(), "ata-runtime-"));
  try {
    const giriş = join(geçici, "boş.ts");
    await Bun.write(giriş, "process.exit(0);\n");
    await hedefler.reduce(
      (önce, hedef) =>
        önce.then(async () => {
          try {
            await runtimeBul(hedef);
            return;
          } catch {
            /* Bun resmi runtime indirmesini yapar. */
          }
          const çıktı = join(geçici, hedef.dosya);
          const işlem = Bun.spawn(
            [
              process.execPath,
              "build",
              "--compile",
              `--target=${hedef.hedef}`,
              giriş,
              "--outfile",
              çıktı,
            ],
            {
              cwd: projeKökü,
              env: { ...process.env, BUN_INSTALL_CACHE_DIR: resolve(projeKökü, ".bun-cache") },
              stdout: "inherit",
              stderr: "inherit",
            },
          );
          if ((await işlem.exited) !== 0) throw new Error(`Runtime hazırlanamadı: ${hedef.ad}`);
          await unlink(çıktı);
          await runtimeBul(hedef);
        }),
      Promise.resolve(),
    );
    console.log("Dört Bun runtime yerelde hazır; release:prepare ağ kullanmadan derleyebilir.");
  } finally {
    const adlar = await readdir(geçici);
    await Promise.all(adlar.map((ad) => unlink(join(geçici, ad))));
    await rmdir(geçici);
  }
}

if (import.meta.main) {
  try {
    await hazırla();
  } catch (hata) {
    console.error(hata instanceof Error ? hata.message : "Runtime hazırlanamadı.");
    process.exitCode = 1;
  }
}
