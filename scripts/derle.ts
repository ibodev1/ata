import { lstat, mkdir, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export const projeKökü = resolve(import.meta.dir, "..");
export const hedefler = [
  {
    ad: "windows-x64",
    platform: "win32",
    mimari: "x64",
    hedef: "bun-windows-x64",
    dosya: "ata.exe",
    asset: "ata-windows-x64.exe",
  },
  {
    ad: "linux-x64",
    platform: "linux",
    mimari: "x64",
    hedef: "bun-linux-x64",
    dosya: "ata",
    asset: "ata-linux-x64",
  },
  {
    ad: "darwin-x64",
    platform: "darwin",
    mimari: "x64",
    hedef: "bun-darwin-x64",
    dosya: "ata",
    asset: "ata-darwin-x64",
  },
  {
    ad: "darwin-arm64",
    platform: "darwin",
    mimari: "arm64",
    hedef: "bun-darwin-arm64",
    dosya: "ata",
    asset: "ata-darwin-arm64",
  },
] as const;

export function derlemeHedefi(
  args: readonly string[],
  platform: string = process.platform,
  mimari: string = process.arch,
) {
  const argümanlar = args[0] === "--" ? args.slice(1) : args;
  const açık = argümanlar.length !== 0;
  if (açık && (argümanlar.length !== 2 || argümanlar[0] !== "--target")) {
    throw new Error("Kullanım: bun run build [-- --target hedef]");
  }
  const hedef = hedefler.find((aday) =>
    açık ? aday.ad === argümanlar[1] : aday.platform === platform && aday.mimari === mimari,
  );
  if (!hedef)
    throw new Error(
      `Desteklenmeyen hedef. Hedefler: ${hedefler.map((aday) => aday.ad).join(", ")}`,
    );
  return { ...hedef, çıktı: açık ? `${hedef.ad}/${hedef.dosya}` : hedef.dosya };
}

async function dizinHazırla(yol: string) {
  await mkdir(yol, { recursive: true });
  const bilgi = await lstat(yol);
  if (bilgi.isSymbolicLink() || !bilgi.isDirectory())
    throw new Error(`Çıktı dizini gerçek bir dizin olmalı: ${yol}`);
}

export async function derle(args: readonly string[], yayın = false, runtimeYolu?: string) {
  const hedef = derlemeHedefi(args);
  const dist = resolve(projeKökü, "dist");
  const çıktı = resolve(dist, yayın ? `release/${hedef.asset}` : hedef.çıktı);
  // Yalnızca tablodan seçilmiş hedefin dosyası silinir; recursive silme yoktur.
  await dizinHazırla(dist);
  if (dirname(çıktı) !== dist) await dizinHazırla(dirname(çıktı));
  const eski = await lstat(çıktı).catch((hata: unknown) => {
    if (hata instanceof Error && "code" in hata && hata.code === "ENOENT") return undefined;
    throw hata;
  });
  if (eski) {
    if (!eski.isFile() || eski.isSymbolicLink())
      throw new Error(`Çıktı normal dosya olmalı: ${çıktı}`);
    await unlink(çıktı);
  }
  const işlem = Bun.spawn(
    [
      process.execPath,
      "build",
      "--compile",
      `--target=${hedef.hedef}`,
      ...(runtimeYolu ? ["--compile-executable-path", runtimeYolu] : []),
      "--no-compile-autoload-dotenv",
      "--no-compile-autoload-bunfig",
      "--no-compile-autoload-tsconfig",
      "--no-compile-autoload-package-json",
      resolve(projeKökü, "src/cli/cli.ts"),
      "--outfile",
      çıktı,
    ],
    { cwd: projeKökü, stdout: "inherit", stderr: "inherit" },
  );
  const kod = await işlem.exited;
  if (kod !== 0) throw new Error(`Derleme başarısız (çıkış ${kod}).`);
  console.log(`Derlendi: ${çıktı}`);
}

if (import.meta.main) {
  try {
    await derle(Bun.argv.slice(2));
  } catch (hata) {
    console.error(hata instanceof Error ? hata.message : "Derleme başarısız.");
    process.exitCode = 1;
  }
}
