import type { DeğerBildirimi, İşlevBildirimi, Parametre, ListeDöngüsü } from "../ast/düğümler.ts";
import type { KaynakAralığı } from "../kaynak/konum.ts";
import type { Yerleşikİşlev } from "../standart/yerleşikler.ts";
import type { KullanBildirimi } from "../ast/düğümler.ts";
import type { ModülDışaAktarımları } from "./modül-bağları.ts";

interface SembolTemeli {
  readonly ad: string;
  readonly aralık: KaynakAralığı;
}

export type Sembol =
  | (SembolTemeli & {
      readonly tür: "modül";
      readonly bildirim: KullanBildirimi;
      readonly katalog: ModülDışaAktarımları;
    })
  | (SembolTemeli & {
      readonly tür: "değer";
      readonly bildirim: DeğerBildirimi;
      readonly değiştirilebilir: boolean;
    })
  | (SembolTemeli & { readonly tür: "parametre"; readonly bildirim: Parametre })
  | (SembolTemeli & { readonly tür: "döngü"; readonly bildirim: ListeDöngüsü })
  | (SembolTemeli & { readonly tür: "işlev"; readonly bildirim: İşlevBildirimi })
  | { readonly tür: "yerleşik"; readonly ad: string; readonly işlev: Yerleşikİşlev };

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
