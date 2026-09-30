import { kaynakOku } from "../kaynak/kaynak.ts";
import type { Kaynak } from "../kaynak/kaynak.ts";
import { ayrıştır } from "../ayrıştırıcı/ayrıştırıcı.ts";
import { analizEt } from "../analiz/analiz.ts";
import { yorumla } from "../çalışma/yorumlayıcı.ts";
import { tanıyıGöster } from "../tanılama/göster.ts";
import { version as sürüm } from "../../package.json";

const yardım = `Ata Dil

Kullanım:
  ata <komut> [seçenekler]

Komutlar:
  çalıştır <dosya>   Ata programını denetle ve çalıştır
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
  if (komut !== "çalıştır") {
    console.error(`Bilinmeyen komut: '${komut}'. Kullanım için 'ata yardım' yazın.`);
    return 1;
  }
  if (argümanlar.length !== 2 || !yol) {
    console.error("'çalıştır' komutu için tek bir dosya yolu gereklidir.");
    return 1;
  }
  if (!yol.endsWith(".ata")) {
    console.error("Kaynak dosyasının uzantısı '.ata' olmalıdır.");
    return 1;
  }
  let kaynak: Kaynak;
  try {
    kaynak = await kaynakOku(yol);
  } catch {
    console.error(
      `Dosya UTF-8 olarak okunamadı: '${yol}'. Dosyanın varlığını, okuma iznini ve UTF-8 kodlamasını kontrol edin.`,
    );
    return 1;
  }
  const sonuç = ayrıştır(kaynak);
  for (const tanı of sonuç.tanılar) console.error(tanıyıGöster(kaynak, tanı));
  if (sonuç.tanılar.some((tanı) => tanı.seviye === "hata")) return 1;
  const analiz = analizEt(sonuç.program!, kaynak.yol);
  for (const tanı of analiz.tanılar) console.error(tanıyıGöster(kaynak, tanı));
  if (analiz.tanılar.some((tanı) => tanı.seviye === "hata")) return 1;
  const çalışma = yorumla(sonuç.program!, {
    yol: kaynak.yol,
    çıktıYaz: (metin) => console.log(metin),
  });
  for (const tanı of çalışma.tanılar) console.error(tanıyıGöster(kaynak, tanı));
  return çalışma.tanılar.some((tanı) => tanı.seviye === "hata") ? 1 : 0;
}

if (import.meta.main) process.exitCode = await cli(Bun.argv.slice(2));
