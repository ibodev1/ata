import type { ModülGrafiği } from "../modüller/grafik.ts";
import type { Tanı } from "../tanılama/tanı.ts";
import { analizEt } from "./analiz.ts";
import type { AnalizSonucu } from "./analiz.ts";
import type { DeğerDışaAktarımı, ModülDışaAktarımları } from "./modül-bağları.ts";

export interface ModülAnalizSonucu {
  readonly analizler: ReadonlyMap<string, AnalizSonucu>;
  readonly kataloglar: ReadonlyMap<string, ModülDışaAktarımları>;
  readonly tanılar: readonly Tanı[];
}

export function modülleriAnalizEt(grafik: ModülGrafiği): ModülAnalizSonucu {
  const analizler = new Map<string, AnalizSonucu>();
  const kataloglar = new Map<string, ModülDışaAktarımları>();
  const tanılar: Tanı[] = [];
  for (const modül of grafik.sıra) {
    // Hatalı dependency'den sahte export/missing-name cascade'i üretilmez.
    if (modül.bağımlılıklar.some((kenar) => !kataloglar.has(kenar.hedefYol))) continue;
    const analiz = analizEt(modül.program, modül.kanonikYol, {
      bağımlılıklar: modül.bağımlılıklar,
      kataloglar,
    });
    analizler.set(modül.kanonikYol, analiz);
    tanılar.push(...analiz.tanılar);
    if (analiz.tanılar.some((tanı) => tanı.seviye === "hata")) continue;
    const değerler = new Map<string, DeğerDışaAktarımı>();
    for (const bildirim of modül.program.bildirimler) {
      const sembol = analiz.isimler.bildirimSembolleri.get(bildirim);
      if (bildirim.tür === "sabit" && sembol?.tür === "değer") {
        const tip = analiz.sembolTipleri.get(sembol);
        if (!tip) throw new Error("Çözülen sabit tipi bulunamadı.");
        değerler.set(bildirim.ad, { tür: "sabit", modülYolu: modül.kanonikYol, sembol, tip });
      } else if (bildirim.tür === "işlev" && sembol?.tür === "işlev") {
        const imza = analiz.işlevİmzaları.get(sembol);
        if (!imza) throw new Error("Çözülen işlev imzası bulunamadı.");
        değerler.set(bildirim.ad, { tür: "işlev", modülYolu: modül.kanonikYol, sembol, imza });
      }
    }
    kataloglar.set(modül.kanonikYol, {
      modülYolu: modül.kanonikYol,
      değerler,
      tipler: new Map(
        [...analiz.isimler.kendiTipleri].map(([bildirim, sembol]) => [bildirim.ad, sembol]),
      ),
      yapıAlanları: analiz.yapıAlanları,
    });
  }
  return { analizler, kataloglar, tanılar };
}
