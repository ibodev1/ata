import type { İkiliİşleç } from "../ast/düğümler.ts";
import type { KaynakAralığı } from "../kaynak/konum.ts";
import type { Değer } from "./değer.ts";
import { hata } from "./hata.ts";

export function sayıSonucu(değer: number, aralık: KaynakAralığı): Değer {
  if (!Number.isFinite(değer))
    hata("ATA5003", "Sayısal işlem sonlu olmayan bir sonuç üretti.", aralık);
  return { tür: "sayı", değer };
}

export function mantıkAl(değer: Değer, aralık: KaynakAralığı): boolean {
  if (değer.tür !== "mantık")
    return hata("ATA5005", "Çalışma zamanında 'mantık' değeri bekleniyordu.", aralık);
  return değer.değer;
}

export function ikiliUygula(
  işleç: İkiliİşleç,
  sol: Değer,
  sağ: Değer,
  aralık: KaynakAralığı,
): Değer {
  if (işleç === "==" || işleç === "!=") {
    let eşit: boolean;
    if (sol.tür === "hiç" || sağ.tür === "hiç")
      return hata("ATA5005", "'hiç' değeri karşılaştırılamaz.", aralık);
    if (sol.tür === "yok" || sağ.tür === "yok") eşit = sol.tür === sağ.tür;
    else if (sol.tür === "sayı" && sağ.tür === "sayı") eşit = sol.değer === sağ.değer;
    else if (sol.tür === "yazı" && sağ.tür === "yazı") eşit = sol.değer === sağ.değer;
    else if (sol.tür === "mantık" && sağ.tür === "mantık") eşit = sol.değer === sağ.değer;
    else if (sol.tür === "seçenek" && sağ.tür === "seçenek" && sol.seçenekAdı === sağ.seçenekAdı)
      eşit = sol.üyeAdı === sağ.üyeAdı;
    else return hata("ATA5005", "Çalışma zamanında bu değerler karşılaştırılamaz.", aralık);
    return { tür: "mantık", değer: işleç === "==" ? eşit : !eşit };
  }
  if (işleç === "+" && sol.tür === "yazı" && sağ.tür === "yazı")
    return { tür: "yazı", değer: sol.değer + sağ.değer };
  if (sol.tür !== "sayı" || sağ.tür !== "sayı")
    return hata("ATA5005", `'${işleç}' işleci için beklenmeyen çalışma zamanı değer türü.`, aralık);
  switch (işleç) {
    case "+":
      return sayıSonucu(sol.değer + sağ.değer, aralık);
    case "-":
      return sayıSonucu(sol.değer - sağ.değer, aralık);
    case "*":
      return sayıSonucu(sol.değer * sağ.değer, aralık);
    case "/":
      if (sağ.değer === 0) hata("ATA5001", "Sıfıra bölme yapılamaz.", aralık);
      return sayıSonucu(sol.değer / sağ.değer, aralık);
    case "%":
      if (sağ.değer === 0) hata("ATA5002", "Sıfıra göre kalan hesaplanamaz.", aralık);
      return sayıSonucu(sol.değer % sağ.değer, aralık);
    case "<":
      return { tür: "mantık", değer: sol.değer < sağ.değer };
    case "<=":
      return { tür: "mantık", değer: sol.değer <= sağ.değer };
    case ">":
      return { tür: "mantık", değer: sol.değer > sağ.değer };
    case ">=":
      return { tür: "mantık", değer: sol.değer >= sağ.değer };
    default:
      return hata("ATA5005", `Beklenmeyen çalışma zamanı işleci: '${işleç}'.`, aralık);
  }
}
