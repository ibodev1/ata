import { expect, test } from "bun:test";
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  modülYoluHatası,
  modülYolunuÇöz,
  modülGörünenYolu,
  modülDosyaHatası,
} from "../src/modüller/yol.ts";

test("decoded modül yolu yalnız extensionless göreli / biçimini kabul eder", () => {
  for (const yol of [
    "matematik",
    "./matematik",
    "../ortak/matematik",
    "alt/../matematik",
    "v1.0/matematik",
    "yardımcı dosyalar/ölçüler",
    "foo-bar",
    "123",
    "işlev",
  ])
    expect(modülYoluHatası(yol), yol).toBeNull();
  for (const yol of [
    "",
    "/opt/modul",
    "C:/modul",
    "C:\\modul",
    "//sunucu/paylasim",
    "\\\\sunucu\\paylasim",
    "https://örnek",
    "file://modul",
    "github:modul",
    "npm:modul",
    "git:modul",
    "a\\b",
    "a\0b",
    "a\nb",
    "a\u007fb",
    "a\u0085b",
    "a//b",
    "a/",
    ".",
    "..",
    "a/.",
    "a/..",
    "a.ata",
    "a.ts",
    "a.",
  ])
    expect(modülYoluHatası(yol), yol).not.toBeNull();
});

test("filesystem hata sınıfları missing ile okuma/izin hatasını ayırır ve raw mesajı saklar", () => {
  for (const code of ["ENOENT", "ENOTDIR"])
    expect(modülDosyaHatası({ code }, "m.ata").kod).toBe("ATA6001");
  for (const hata of [
    { code: "EACCES", message: "gizli ayrıntı" },
    { code: "EIO" },
    new TypeError("decoder ayrıntısı"),
  ]) {
    const sonuç = modülDosyaHatası(hata, "m.ata");
    expect(sonuç.kod).toBe("ATA6008");
    expect(sonuç.mesaj).toBe(
      "Modül okunamadı veya kanonikleştirilemedi: 'm.ata'. Dosyanın okuma iznini ve UTF-8 kodlamasını kontrol edin.",
    );
  }
});

test("resolver canonical importer dizinini kullanır; .ata ve normal dosya zorunludur", async () => {
  const geçici = await mkdtemp(join(tmpdir(), "ata-modül-yol-"));
  try {
    await mkdir(join(geçici, "uygulama"));
    const giriş = join(geçici, "uygulama/ana.ata");
    await Bun.write(giriş, "");
    await Bun.write(join(geçici, "ortak.ata"), "");
    await mkdir(join(geçici, "uygulama/dizin.ata"));
    await Bun.write(join(geçici, "uygulama/yalnız.ts"), "");
    await Bun.write(join(geçici, "uygulama/yalnız"), "");
    await Bun.write(join(geçici, "uygulama/indeks/index.ata"), "");
    const kanonik = await realpath(giriş);
    const ortak = await realpath(join(geçici, "ortak.ata"));
    expect(await modülYolunuÇöz(kanonik, "../ortak")).toEqual({ yol: ortak });
    expect(modülGörünenYolu(kanonik, ortak)).toBe("../ortak.ata");
    expect(modülGörünenYolu(kanonik, kanonik)).toBe("ana.ata");
    if (process.platform === "win32")
      expect(modülGörünenYolu("C:/proje/ana.ata", "D:/ortak/m.ata")).toBe("D:/ortak/m.ata");
    expect(await modülYolunuÇöz(kanonik, "ortak.ata")).toMatchObject({ kod: "ATA6002" });
    expect(await modülYolunuÇöz(kanonik, "yalnız")).toMatchObject({ kod: "ATA6001" });
    expect(await modülYolunuÇöz(kanonik, "indeks")).toMatchObject({ kod: "ATA6001" });
    expect(await modülYolunuÇöz(kanonik, "dizin")).toMatchObject({ kod: "ATA6002" });
  } finally {
    await rm(geçici, { recursive: true, force: true });
  }
});
