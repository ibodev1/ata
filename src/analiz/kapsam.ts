import type { DeğerBildirimi, İşlevBildirimi, Parametre, ListeDöngüsü } from "../ast/düğümler.ts";
import type { KaynakAralığı } from "../kaynak/konum.ts";

interface SembolTemeli {
  readonly ad: string;
  readonly aralık: KaynakAralığı;
}

export type Sembol =
  | (SembolTemeli & {
      readonly tür: "değer";
      readonly bildirim: DeğerBildirimi;
      readonly değiştirilebilir: boolean;
    })
  | (SembolTemeli & { readonly tür: "parametre"; readonly bildirim: Parametre })
  | (SembolTemeli & { readonly tür: "döngü"; readonly bildirim: ListeDöngüsü })
  | (SembolTemeli & { readonly tür: "işlev"; readonly bildirim: İşlevBildirimi });

export class Kapsam {
  private readonly semboller = new Map<string, Sembol>();
  constructor(readonly üst: Kapsam | null = null) {}

  ekle(sembol: Sembol): boolean {
    if (this.semboller.has(sembol.ad)) return false;
    this.semboller.set(sembol.ad, sembol);
    return true;
  }

  bul(ad: string): Sembol | undefined {
    return this.semboller.get(ad) ?? this.üst?.bul(ad);
  }
}
