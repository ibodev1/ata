import type { YapıBildirimi, SeçenekBildirimi } from "../ast/düğümler.ts";
import type { KaynakAralığı } from "../kaynak/konum.ts";
import type { ModülBağımlılığı } from "../modüller/grafik.ts";
import type { Sembol } from "./kapsam.ts";
import type { Tip, İşlevİmzası } from "./tipler.ts";

export type DeğerDışaAktarımı =
  | {
      readonly tür: "sabit";
      readonly modülYolu: string;
      readonly sembol: Extract<Sembol, { tür: "değer" }>;
      readonly tip: Tip;
    }
  | {
      readonly tür: "işlev";
      readonly modülYolu: string;
      readonly sembol: Extract<Sembol, { tür: "işlev" }>;
      readonly imza: İşlevİmzası;
    };

export interface ModülDışaAktarımları {
  readonly modülYolu: string;
  readonly değerler: ReadonlyMap<string, DeğerDışaAktarımı>;
  readonly tipler: ReadonlyMap<string, YapıBildirimi | SeçenekBildirimi>;
}

export interface ModülBağlamı {
  readonly bağımlılıklar: readonly ModülBağımlılığı[];
  readonly kataloglar: ReadonlyMap<string, ModülDışaAktarımları>;
}

export interface GeliştirmeEngeli {
  readonly mesaj: string;
  readonly yol: string;
  readonly aralık: KaynakAralığı;
}

function modülGüvenliTip(tip: Tip): boolean {
  if (tip.tür === "liste") return modülGüvenliTip(tip.eleman);
  if (tip.tür === "isteğe-bağlı") return modülGüvenliTip(tip.temel);
  return tip.tür !== "yapı" && tip.tür !== "seçenek";
}

export function aktarımGüvenli(aktarım: DeğerDışaAktarımı): boolean {
  return aktarım.tür === "sabit"
    ? modülGüvenliTip(aktarım.tip)
    : modülGüvenliTip(aktarım.imza.dönüş) && aktarım.imza.parametreler.every(modülGüvenliTip);
}
