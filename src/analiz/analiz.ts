import type { Program } from "../ast/düğümler.ts";
import { isimleriÇöz } from "./isim-çözümleyici.ts";
import { tipleriDenetle } from "./tip-denetleyici.ts";
import type { TipDenetlemeSonucu } from "./tip-denetleyici.ts";

export function analizEt(program: Program, yol = "<kaynak>"): TipDenetlemeSonucu {
  const isimler = isimleriÇöz(program, yol);
  const tipler = tipleriDenetle(program, isimler, yol);
  return {
    ...tipler,
    tanılar: [...isimler.tanılar, ...tipler.tanılar].toSorted(
      (a, b) => a.aralık.başlangıç.ofset - b.aralık.başlangıç.ofset,
    ),
  };
}
