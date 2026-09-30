import type { KaynakAralığı } from "../kaynak/konum.ts";
import { hata } from "./hata.ts";

export type Değer =
  | { readonly tür: "seçenek"; readonly seçenekAdı: string; readonly üyeAdı: string }
  | { readonly tür: "yapı"; readonly yapıAdı: string; readonly alanlar: ReadonlyMap<string, Değer> }
  | { readonly tür: "sayı"; readonly değer: number }
  | { readonly tür: "yazı"; readonly değer: string }
  | { readonly tür: "mantık"; readonly değer: boolean }
  | { readonly tür: "yok" | "hiç" }
  | { readonly tür: "liste"; readonly elemanlar: readonly Değer[] };

export const hiç: Değer = { tür: "hiç" };

export function yazıyaDönüştür(değer: Değer, aralık: KaynakAralığı): string {
  if (değer.tür === "hiç") return hata("ATA5005", "'hiç' değeri yazıya dönüştürülemez.", aralık);
  return değeriGöster(değer);
}

export function değeriGöster(değer: Değer): string {
  switch (değer.tür) {
    case "seçenek":
      return `${değer.seçenekAdı}::${değer.üyeAdı}`;
    case "yapı": {
      const alanlar = [...değer.alanlar].map(
        ([ad, alan]) =>
          `${ad}: ${alan.tür === "yazı" ? JSON.stringify(alan.değer) : değeriGöster(alan)}`,
      );
      return alanlar.length === 0
        ? `${değer.yapıAdı} {}`
        : `${değer.yapıAdı} { ${alanlar.join(", ")} }`;
    }
    case "sayı":
      return String(değer.değer);
    case "yazı":
      return değer.değer;
    case "mantık":
      return değer.değer ? "doğru" : "yanlış";
    case "yok":
      return "yok";
    case "hiç":
      return "hiç";
    case "liste":
      return `[${değer.elemanlar
        .map((eleman) =>
          eleman.tür === "yazı" ? JSON.stringify(eleman.değer) : değeriGöster(eleman),
        )
        .join(", ")}]`;
  }
}
