import type { ModülGrafiği } from "../modüller/grafik.ts";
import type { ModülAnalizSonucu } from "../analiz/modüller.ts";
import type { Sembol } from "../analiz/kapsam.ts";
import type { Bağ, Ortam } from "./ortam.ts";
import { çalışmaTanısı, hata } from "./hata.ts";
import { yorumlayıcıOluştur } from "./yorumlayıcı.ts";
import type { YorumlamaSeçenekleri, YorumlamaSonucu } from "./yorumlayıcı.ts";

interface ModülÇalışmaKaydı {
  readonly ortam: Ortam;
  readonly exportlar: ReadonlyMap<Sembol, Extract<Bağ, { tür: "değer" | "işlev" }>>;
}

export function modülleriYorumla(
  grafik: ModülGrafiği,
  analiz: ModülAnalizSonucu,
  seçenekler: YorumlamaSeçenekleri,
): YorumlamaSonucu {
  if (analiz.tanılar.some((tanı) => tanı.seviye === "hata")) return { tanılar: analiz.tanılar };
  if (
    grafik.sıra.some(
      (modül) =>
        !analiz.analizler.has(modül.kanonikYol) || !analiz.kataloglar.has(modül.kanonikYol),
    )
  )
    throw new Error("Çalışma öncesinde bütün modüller analiz edilmiş olmalıdır.");
  const kayıtlar = new Map<string, ModülÇalışmaKaydı>();
  const yürüt = yorumlayıcıOluştur(seçenekler);
  let yürütülenYol = grafik.giriş.kanonikYol;
  try {
    for (const modül of grafik.sıra) {
      if (kayıtlar.has(modül.kanonikYol)) continue;
      yürütülenYol = modül.kanonikYol;
      const semantik = analiz.analizler.get(modül.kanonikYol);
      const katalog = analiz.kataloglar.get(modül.kanonikYol);
      if (!semantik || !katalog) throw new Error("Modül analizi bulunamadı.");
      const aktarımlar = new Map<Sembol, Bağ>();
      for (const [sembol, hedef] of semantik.isimler.içeAktarımlar) {
        const bağ = kayıtlar.get(hedef.modülYolu)?.exportlar.get(sembol);
        if (!bağ)
          hata("ATA5005", "Çözülen çalışma zamanı export'u bulunamadı.", modül.program.aralık);
        aktarımlar.set(sembol, bağ);
      }
      const ortam = yürüt(modül.program, {
        yol: modül.kanonikYol,
        isimler: semantik.isimler,
        tipler: semantik.isimler.tipBildirimleri,
        aktarımlar,
      });
      const exportlar = new Map<Sembol, Extract<Bağ, { tür: "değer" | "işlev" }>>();
      for (const aktarım of katalog.değerler.values()) {
        const bağ = ortam.bul(aktarım.sembol.ad, aktarım.sembol.aralık);
        if (bağ.tür === "yerleşik" || (bağ.tür === "değer" && bağ.değiştirilebilir))
          hata("ATA5005", "Geçersiz çalışma zamanı export bağı.", aktarım.sembol.aralık);
        exportlar.set(aktarım.sembol, bağ);
      }
      kayıtlar.set(modül.kanonikYol, { ortam, exportlar });
    }
    return { tanılar: [] };
  } catch (yakalanan) {
    return { tanılar: [çalışmaTanısı(yakalanan, yürütülenYol)] };
  }
}
