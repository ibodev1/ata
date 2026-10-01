import type { Program } from "../ast/düğümler.ts";
import { isimleriÇöz } from "./isim-çözümleyici.ts";
import { tipleriDenetle } from "./tip-denetleyici.ts";
import type { TipDenetlemeSonucu } from "./tip-denetleyici.ts";
import type { İsimÇözümlemeSonucu } from "./isim-çözümleyici.ts";
import type { ModülBağlamı } from "./modül-bağları.ts";

export interface AnalizSonucu extends TipDenetlemeSonucu {
  readonly isimler: İsimÇözümlemeSonucu;
}

export function analizEt(
  program: Program,
  yol = "<kaynak>",
  modüller?: ModülBağlamı,
): AnalizSonucu {
  const isimler = isimleriÇöz(program, yol, modüller);
  const tipler = tipleriDenetle(program, isimler, yol);
  return {
    ...tipler,
    isimler,
    tanılar: [...isimler.tanılar, ...tipler.tanılar].toSorted(
      (a, b) => a.aralık.başlangıç.ofset - b.aralık.başlangıç.ofset,
    ),
  };
}
