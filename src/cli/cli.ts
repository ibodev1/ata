import { modülleriYükle } from "../modüller/yükleyici.ts";
import { modülGörünenYolu } from "../modüller/yol.ts";
import type { Tanı } from "../tanılama/tanı.ts";
import { modülleriAnalizEt } from "../analiz/modüller.ts";
import { modülleriYorumla } from "../çalışma/modüller.ts";
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
  if (analiz.tanılar.some((tanı) => tanı.seviye === "hata")) return 1;
  if (komut === "denetle") {
    console.log("Denetim başarılı.");
    return 0;
  }
  const çalışma = modülleriYorumla(grafik, analiz, {
    çıktıYaz: (metin) => console.log(metin),
    girdiOku,
  });
  tanılarıYaz(çalışma.tanılar);
  return çalışma.tanılar.some((tanı) => tanı.seviye === "hata") ? 1 : 0;
}

if (import.meta.main) process.exitCode = await cli(Bun.argv.slice(2));
