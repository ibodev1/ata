import type { Tip } from "../analiz/tipler.ts";
import type { Değer } from "../çalışma/değer.ts";
import type { KaynakAralığı } from "../kaynak/konum.ts";
import { hata } from "../çalışma/hata.ts";
import { yazıyaDönüştür } from "../çalışma/değer.ts";

export type GirdiOku = (istem: string) => string | null;
export type YerleşikParametre = "yazı" | "uzunluğu-olan" | "gösterilebilir";

export interface YerleşikBağlam {
  readonly girdiOku?: GirdiOku;
}

export interface Yerleşikİşlev {
  readonly ad: string;
  readonly parametreler: readonly YerleşikParametre[];
  readonly enAzArgüman?: number;
  readonly dönüş: Tip;
  readonly uygula: (
    argümanlar: readonly Değer[],
    bağlam: YerleşikBağlam,
    aralık: KaynakAralığı,
  ) => Değer;
}

export function argümanSayısıUygun(işlev: Yerleşikİşlev, sayı: number): boolean {
  return (
    sayı >= (işlev.enAzArgüman ?? işlev.parametreler.length) && sayı <= işlev.parametreler.length
  );
}

export function parametreKabulEder(kural: YerleşikParametre, tip: Tip): boolean {
  if (tip.tür === "bilinmeyen") return true;
  switch (kural) {
    case "yazı":
      return tip.tür === "yazı";
    case "uzunluğu-olan":
      return tip.tür === "yazı" || tip.tür === "liste";
    case "gösterilebilir":
      return tip.tür !== "hiç";
  }
}

export function parametreyiGöster(kural: YerleşikParametre): string {
  switch (kural) {
    case "yazı":
      return "yazı";
    case "uzunluğu-olan":
      return "yazı veya liste<T>";
    case "gösterilebilir":
      return "hiç dışındaki kullanıcı değeri";
  }
}

function yazıAl(argümanlar: readonly Değer[], sıra: number, aralık: KaynakAralığı): string {
  const değer = argümanlar[sıra];
  if (değer?.tür !== "yazı")
    return hata("ATA5005", "Yerleşik işlev argümanı 'yazı' olmalıdır.", aralık);
  return değer.değer;
}

export const yerleşikler: readonly Yerleşikİşlev[] = [
  {
    ad: "girdi",
    parametreler: ["yazı"],
    enAzArgüman: 0,
    dönüş: { tür: "yazı" },
    uygula: (argümanlar, bağlam, aralık) => {
      const istem = argümanlar.length === 0 ? "" : yazıAl(argümanlar, 0, aralık);
      let metin: string | null | undefined;
      try {
        metin = bağlam.girdiOku?.(istem);
      } catch {
        return hata("ATA5007", "Girdi okunamadı.", aralık);
      }
      if (typeof metin !== "string") return hata("ATA5007", "Girdi okunamadı.", aralık);
      return { tür: "yazı", değer: metin };
    },
  },
  {
    ad: "uzunluk",
    parametreler: ["uzunluğu-olan"],
    dönüş: { tür: "sayı" },
    uygula: (argümanlar, _bağlam, aralık) => {
      const değer = argümanlar[0];
      if (değer?.tür === "yazı") return { tür: "sayı", değer: [...değer.değer].length };
      if (değer?.tür === "liste") return { tür: "sayı", değer: değer.elemanlar.length };
      return hata("ATA5005", "'uzunluk' yazı veya liste değeri gerektirir.", aralık);
    },
  },
  {
    ad: "yazıya",
    parametreler: ["gösterilebilir"],
    dönüş: { tür: "yazı" },
    uygula: (argümanlar, _bağlam, aralık) => {
      const değer = argümanlar[0];
      if (!değer) return hata("ATA5005", "'yazıya' bir değer gerektirir.", aralık);
      return { tür: "yazı", değer: yazıyaDönüştür(değer, aralık) };
    },
  },
  {
    ad: "büyük_harf",
    parametreler: ["yazı"],
    dönüş: { tür: "yazı" },
    uygula: (argümanlar, _bağlam, aralık) => ({
      tür: "yazı",
      değer: yazıAl(argümanlar, 0, aralık).toLocaleUpperCase("tr-TR"),
    }),
  },
  {
    ad: "küçük_harf",
    parametreler: ["yazı"],
    dönüş: { tür: "yazı" },
    uygula: (argümanlar, _bağlam, aralık) => ({
      tür: "yazı",
      değer: yazıAl(argümanlar, 0, aralık).toLocaleLowerCase("tr-TR"),
    }),
  },
  {
    ad: "kırp",
    parametreler: ["yazı"],
    dönüş: { tür: "yazı" },
    uygula: (argümanlar, _bağlam, aralık) => ({
      tür: "yazı",
      değer: yazıAl(argümanlar, 0, aralık).trim(),
    }),
  },
  {
    ad: "içerir",
    parametreler: ["yazı", "yazı"],
    dönüş: { tür: "mantık" },
    uygula: (argümanlar, _bağlam, aralık) => ({
      tür: "mantık",
      değer: yazıAl(argümanlar, 0, aralık).includes(yazıAl(argümanlar, 1, aralık)),
    }),
  },
  {
    ad: "başlar_mı",
    parametreler: ["yazı", "yazı"],
    dönüş: { tür: "mantık" },
    uygula: (argümanlar, _bağlam, aralık) => ({
      tür: "mantık",
      değer: yazıAl(argümanlar, 0, aralık).startsWith(yazıAl(argümanlar, 1, aralık)),
    }),
  },
  {
    ad: "biter_mi",
    parametreler: ["yazı", "yazı"],
    dönüş: { tür: "mantık" },
    uygula: (argümanlar, _bağlam, aralık) => ({
      tür: "mantık",
      değer: yazıAl(argümanlar, 0, aralık).endsWith(yazıAl(argümanlar, 1, aralık)),
    }),
  },
];

export function yerleşiğiÇağır(
  işlev: Yerleşikİşlev,
  argümanlar: readonly Değer[],
  bağlam: YerleşikBağlam,
  aralık: KaynakAralığı,
): Değer {
  if (!argümanSayısıUygun(işlev, argümanlar.length))
    return hata(
      "ATA5005",
      `'${işlev.ad}' işlevinin çalışma zamanı argüman sayısı uyuşmuyor.`,
      aralık,
    );
  return işlev.uygula(argümanlar, bağlam, aralık);
}
