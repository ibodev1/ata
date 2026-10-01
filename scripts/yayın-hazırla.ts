import { chmod, lstat, mkdir, readdir, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { version } from "../package.json";
import { derle, hedefler, projeKökü } from "./derle.ts";
import { runtimeBul } from "./runtime-hazırla.ts";
import {
  kurulumDosyaları,
  yayınDeposu,
  yayınDosyaları,
  sağlamaDoğrula,
  sağlamaÜret,
} from "./yayın.ts";

export const yayınDizini = resolve(projeKökü, "dist/release");

export async function yayınDoğrula() {
  const adlar = (await readdir(yayınDizini)).toSorted();
  if (JSON.stringify(adlar) !== JSON.stringify(yayınDosyaları))
    throw new Error("Release dosya listesi beklenen dokuz dosyayla eşleşmiyor.");
  const sağlama = await Bun.file(resolve(yayınDizini, "SHA256SUMS.txt")).text();
  await Promise.all(
    yayınDosyaları.map(async (ad) => {
      const yol = resolve(yayınDizini, ad);
      const bilgi = await lstat(yol);
      if (!bilgi.isFile() || bilgi.isSymbolicLink() || bilgi.size === 0)
        throw new Error(`Geçersiz release dosyası: ${ad}`);
      if (ad !== "SHA256SUMS.txt")
        sağlamaDoğrula(sağlama, ad, new Uint8Array(await Bun.file(yol).arrayBuffer()));
    }),
  );
}

async function hazırla() {
  // Bütün runtime'lar hazır değilse çıktılara dokunma; hazırlıkta indirme yapılmaz.
  const runtime = await Promise.all(hedefler.map(runtimeBul));
  await Promise.all(
    [resolve(projeKökü, "dist"), yayınDizini].map(async (dizin) => {
      // mkdir yalnızca bu kontrollü iki dizinde kullanılır; bağlantı ebeveyn reddedilir.
      const bilgi = await lstat(dizin).catch((hata: unknown) => {
        if (hata instanceof Error && "code" in hata && hata.code === "ENOENT") return undefined;
        throw hata;
      });
      if (bilgi && (!bilgi.isDirectory() || bilgi.isSymbolicLink()))
        throw new Error(`Çıktı dizini gerçek dizin olmalı: ${dizin}`);
    }),
  );
  await mkdir(yayınDizini, { recursive: true });
  const eski = await readdir(yayınDizini);
  await Promise.all(
    eski.map(async (ad) => {
      const yol = resolve(yayınDizini, ad);
      const bilgi = await lstat(yol);
      if (!yayınDosyaları.includes(ad) || !bilgi.isFile() || bilgi.isSymbolicLink())
        throw new Error(`Beklenmeyen release çıktısı; silinmedi: ${ad}`);
    }),
  );
  await Promise.all(eski.map((ad) => unlink(resolve(yayınDizini, ad))));
  await hedefler.reduce(
    (önce, hedef, sıra) => önce.then(() => derle(["--target", hedef.ad], true, runtime[sıra]!)),
    Promise.resolve(),
  );
  await Promise.all(
    kurulumDosyaları.map(async (ad) => {
      const kaynak = await Bun.file(resolve(projeKökü, "scripts", ad)).text();
      const metin = kaynak
        .replace(/^\uFEFF/, "")
        .replaceAll("\r\n", "\n")
        .replace(/(\$Surum = |surum=)'[^']*'/g, `$1'${version}'`)
        .replaceAll("ibodev1/ata", yayınDeposu);
      await Bun.write(resolve(yayınDizini, ad), ad.endsWith(".ps1") ? `\uFEFF${metin}` : metin);
      if (ad.endsWith(".sh")) await chmod(resolve(yayınDizini, ad), 0o755);
    }),
  );
  const veriler = await Promise.all(
    [...hedefler.map((hedef) => hedef.asset), ...kurulumDosyaları].map(
      async (ad) =>
        [ad, new Uint8Array(await Bun.file(resolve(yayınDizini, ad)).arrayBuffer())] as const,
    ),
  );
  await Bun.write(resolve(yayınDizini, "SHA256SUMS.txt"), sağlamaÜret(Object.fromEntries(veriler)));
  await yayınDoğrula();
  console.log(`Release hazırlığı başarılı: ${yayınDizini} (9 dosya; ağ/yayınlama yok).`);
}

if (import.meta.main) {
  try {
    if (Bun.argv[2] === "--verify") await yayınDoğrula();
    else if (Bun.argv.length === 2) await hazırla();
    else throw new Error("Kullanım: yayın-hazırla.ts [--verify]");
  } catch (hata) {
    console.error(hata instanceof Error ? hata.message : "Release hazırlığı başarısız.");
    process.exitCode = 1;
  }
}
