import type { ModülBağımlılığı } from "../modüller/grafik.ts";
import type { Sembol } from "./kapsam.ts";
import type { Tip, İşlevİmzası, TipSembolü } from "./tipler.ts";

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
  readonly tipler: ReadonlyMap<string, TipSembolü>;
  readonly yapıAlanları: ReadonlyMap<TipSembolü, ReadonlyMap<string, Tip>>;
}

export interface ModülBağlamı {
  readonly bağımlılıklar: readonly ModülBağımlılığı[];
  readonly kataloglar: ReadonlyMap<string, ModülDışaAktarımları>;
}
