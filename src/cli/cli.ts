import { modülleriYükle } from "../modüller/yükleyici.ts";
import { modülGörünenYolu } from "../modüller/yol.ts";
import type { Tanı } from "../tanılama/tanı.ts";
import { modülleriAnalizEt } from "../analiz/modüller.ts";
import { yorumla } from "../çalışma/yorumlayıcı.ts";
import { tanıyıGöster } from "../tanılama/göster.ts";
import { version as sürüm } from "../../package.json";
import { girdiOku } from "./girdi.ts";

const yardım = `Ata Dil

Kullanım:
  ata <komut> [seçenekler]

Komutlar:
  çalıştır <dosya>   Ata programını denetle ve çalıştır
  denetle <dosya>    Ata programını çalıştırmadan denetle
  sürüm              Ata Dil sürümünü göster
  yardım             Bu yardımı göster`;

async function cli(argümanlar: readonly string[]): Promise<number> {
  const [komut, yol] = argümanlar;
  if (komut === undefined || komut === "yardım" || komut === "sürüm") {
    if (argümanlar.length > 1) {
      console.error(`'${komut}' komutu ek argüman kabul etmez.`);
      return 1;
    }
    console.log(komut === "sürüm" ? `Ata Dil ${sürüm}` : yardım);
    return 0;
  }
  if (komut !== "çalıştır" && komut !== "denetle") {
    console.error(`Bilinmeyen komut: '${komut}'. Kullanım için 'ata yardım' yazın.`);
    return 1;
  }
  if (argümanlar.length !== 2 || !yol) {
    console.error(`'${komut}' komutu için tek bir dosya yolu gereklidir.`);
    return 1;
  }
  if (!yol.endsWith(".ata")) {
    console.error("Kaynak dosyasının uzantısı '.ata' olmalıdır.");
    return 1;
  }
  const yükleme = await modülleriYükle(yol);
  if (yükleme.girişOkunamadı) {
    console.error(
      `Dosya UTF-8 olarak okunamadı: '${yol}'. Dosyanın varlığını, okuma iznini ve UTF-8 kodlamasını kontrol edin.`,
    );
    return 1;
  }
  const girişKaynağı = yükleme.kaynaklar.values().next().value;
  if (!girişKaynağı) throw new Error("Giriş kaynağı bekleniyordu.");
  const kanonikGiriş = girişKaynağı.yol;
  function tanılarıYaz(tanılar: readonly Tanı[]): void {
    for (const tanı of tanılar) {
      const kaynak = yükleme.kaynaklar.get(tanı.yol);
      if (!kaynak) throw new Error("Tanının kaynağı bulunamadı.");
      console.error(tanıyıGöster(kaynak, tanı, modülGörünenYolu(kanonikGiriş, tanı.yol)));
    }
  }
  tanılarıYaz(yükleme.tanılar);
  const grafik = yükleme.grafik;
  if (!grafik) return 1;
  const analiz = modülleriAnalizEt(grafik);
  tanılarıYaz(analiz.tanılar);
  for (const engel of analiz.engeller) {
    const { satır, sütun } = engel.aralık.başlangıç;
    console.error(
      `${engel.mesaj}\n  --> ${modülGörünenYolu(kanonikGiriş, engel.yol)}:${satır}:${sütun}`,
    );
  }
  if (analiz.tanılar.some((tanı) => tanı.seviye === "hata") || analiz.engeller.length) return 1;
  if (komut === "denetle") {
    console.log("Denetim başarılı.");
    return 0;
  }
  if (grafik.giriş.program.kullanBildirimleri.length > 0) {
    console.error("Modül çalışma zamanı bu geliştirme sürümünde henüz desteklenmiyor.");
    return 1;
  }
  const çalışma = yorumla(grafik.giriş.program, {
    yol: grafik.giriş.kanonikYol,
    çıktıYaz: (metin) => console.log(metin),
    girdiOku,
  });
  tanılarıYaz(çalışma.tanılar);
  return çalışma.tanılar.some((tanı) => tanı.seviye === "hata") ? 1 : 0;
}

if (import.meta.main) process.exitCode = await cli(Bun.argv.slice(2));
