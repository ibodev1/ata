import { createHash } from "node:crypto";
import { hedefler } from "./derle.ts";
import { version } from "../package.json";

export const yayınDeposu = "ibodev1/ata";
export const kurulumDosyaları = ["kur.ps1", "kur.sh", "kaldir.ps1", "kaldir.sh"] as const;
export const yayınDosyaları = [
  ...hedefler.map((hedef) => hedef.asset),
  ...kurulumDosyaları,
  "SHA256SUMS.txt",
].toSorted();

export function sha256(veri: Uint8Array): string {
  return createHash("sha256").update(veri).digest("hex");
}

export function sağlamaÜret(dosyalar: Readonly<Record<string, Uint8Array>>): string {
  return Object.keys(dosyalar)
    .toSorted()
    .map((ad) => `${sha256(dosyalar[ad]!)}  ${ad}\n`)
    .join("");
}

export function sağlamaDoğrula(metin: string, asset: string, veri: Uint8Array): void {
  const kayıtlar = new Map<string, string>();
  for (const satır of metin.replaceAll("\r\n", "\n").replace(/\n$/, "").split("\n")) {
    const kayıt = /^([a-fA-F0-9]{64})  ([A-Za-z0-9][A-Za-z0-9._-]*)$/.exec(satır);
    if (!kayıt || kayıtlar.has(kayıt[2]!))
      throw new Error("Geçersiz veya yinelenen SHA256SUMS kaydı.");
    kayıtlar.set(kayıt[2]!, kayıt[1]!.toLowerCase());
  }
  const beklenen = kayıtlar.get(asset);
  if (!beklenen) throw new Error(`Checksum bulunamadı: ${asset}`);
  if (veri.byteLength === 0 || sha256(veri) !== beklenen)
    throw new Error(`SHA-256 uyuşmazlığı: ${asset}`);
}

export function yayınTagi(sürüm: string = version): string {
  if (!/^\d+\.\d+\.\d+(?:-(?:rc|dev)\.\d+)?$/.test(sürüm)) throw new Error("Geçersiz sürüm.");
  return `v${sürüm}`;
}

export function tagDoğrula(tag: string): void {
  if (tag !== yayınTagi())
    throw new Error(`Tag/sürüm uyuşmazlığı: ${tag}; beklenen ${yayınTagi()}`);
}

export function assetSeç(platform: string, mimari: string): string {
  const hedef = hedefler.find((aday) => aday.platform === platform && aday.mimari === mimari);
  if (!hedef) throw new Error("Bu platform henüz desteklenmiyor.");
  return hedef.asset;
}

export function yayınUrl(
  asset: string,
  sürüm: string = version,
  depo: string = yayınDeposu,
): string {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(depo) || !yayınDosyaları.includes(asset))
    throw new Error("Geçersiz depo veya asset.");
  return `https://github.com/${depo}/releases/download/${yayınTagi(sürüm)}/${asset}`;
}

if (import.meta.main) {
  try {
    tagDoğrula(Bun.argv[2] ?? "");
    console.log("Tag/sürüm eşleşiyor.");
  } catch (hata) {
    console.error(hata instanceof Error ? hata.message : "Tag doğrulanamadı.");
    process.exitCode = 1;
  }
}
