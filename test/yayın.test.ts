import { expect, test } from "bun:test";
import {
  assetSeç,
  yayınTagi,
  tagDoğrula,
  yayınUrl,
  sağlamaÜret,
  sağlamaDoğrula,
  önSürümMü,
} from "../scripts/yayın.ts";

test("SHA-256 standart sabit vektörle üretilir ve doğrulanır", () => {
  const veri = Buffer.from("abc");
  const metin = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad  ata-linux-x64\n";
  expect(sağlamaÜret({ "ata-linux-x64": veri })).toBe(metin);
  expect(() => sağlamaDoğrula(metin, "ata-linux-x64", veri)).not.toThrow();
});

test("RC/dev ön sürümdür, final sürüm prerelease değildir", () => {
  expect(önSürümMü("0.1.0-rc.3")).toBe(true);
  expect(önSürümMü("0.1.0-dev.10")).toBe(true);
  expect(önSürümMü("0.1.0")).toBe(false);
  expect(() => önSürümMü("yanlış")).toThrow("Geçersiz sürüm");
});

test("bir bayt değişikliği ve eksik/bozuk checksum kurulumu reddeder", () => {
  const veri = Buffer.from("abc");
  const metin = sağlamaÜret({ "ata-linux-x64": veri });
  expect(() => sağlamaDoğrula(metin, "ata-linux-x64", Buffer.from("abd"))).toThrow("uyuşmazlığı");
  expect(() => sağlamaDoğrula(metin, "ata-windows-x64.exe", veri)).toThrow("bulunamadı");
  expect(() => sağlamaDoğrula("bozuk  ata-linux-x64\n", "ata-linux-x64", veri)).toThrow("Geçersiz");
  expect(() => sağlamaDoğrula(metin + metin, "ata-linux-x64", veri)).toThrow("yinelenen");
  expect(() => sağlamaDoğrula(metin, "ata-linux-x64", Buffer.alloc(0))).toThrow();
});

test("checksum isim sırasından bağımsız sabit alfabetik çıktı verir", () => {
  const abc = Buffer.from("abc");
  const boş = Buffer.alloc(0);
  expect(sağlamaÜret({ z: abc, a: boş })).toBe(
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  a\nba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad  z\n",
  );
});

test.each([
  { platform: "win32", mimari: "x64", asset: "ata-windows-x64.exe" },
  { platform: "linux", mimari: "x64", asset: "ata-linux-x64" },
  { platform: "darwin", mimari: "x64", asset: "ata-darwin-x64" },
  { platform: "darwin", mimari: "arm64", asset: "ata-darwin-arm64" },
])("desteklenen platformun tek doğru assetini seçer: %j", ({ platform, mimari, asset }) => {
  expect(assetSeç(platform, mimari)).toBe(asset);
});

test("desteklenmeyen mimaride başka platforma düşmez", () => {
  for (const platform of ["win32", "linux", "freebsd"])
    expect(() => assetSeç(platform, "arm64")).toThrow("desteklenmiyor");
});

test("RC URL ve final tag eşleşmesi güvenli biçimde doğrulanır", () => {
  expect(yayınTagi("0.1.0-rc.1")).toBe("v0.1.0-rc.1");
  expect(yayınUrl("ata-windows-x64.exe", "0.1.0-rc.1")).toBe(
    "https://github.com/ibodev1/ata/releases/download/v0.1.0-rc.1/ata-windows-x64.exe",
  );
  expect(yayınTagi()).toBe("v0.1.0");
  expect(önSürümMü()).toBe(false);
  expect(() => tagDoğrula("v0.1.0")).not.toThrow();
  expect(() => tagDoğrula("v0.1.0-rc.1")).toThrow("uyuşmazlığı");
  expect(() => tagDoğrula("v0.1.0-rc.2")).toThrow("uyuşmazlığı");
  expect(() => tagDoğrula("v0.1.0-rc.3")).toThrow("uyuşmazlığı");
  expect(() => tagDoğrula("v0.1.1")).toThrow("uyuşmazlığı");
  expect(() => tagDoğrula("v1.0.0")).toThrow("uyuşmazlığı");
  expect(yayınUrl("ata-windows-x64.exe")).toBe(
    "https://github.com/ibodev1/ata/releases/download/v0.1.0/ata-windows-x64.exe",
  );
  expect(() => yayınUrl("../ata", "0.1.0-rc.1")).toThrow();
  expect(() => yayınUrl("kur.sh", "0.1.0-rc.1", "owner/repo/yanlış")).toThrow();
  expect(() => yayınTagi("../../yanlış")).toThrow();
});
