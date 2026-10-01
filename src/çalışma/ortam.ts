import type { İşlevBildirimi } from "../ast/düğümler.ts";
import type { KaynakAralığı } from "../kaynak/konum.ts";
import type { Değer } from "./değer.ts";
import { hata } from "./hata.ts";
import type { Yerleşikİşlev } from "../standart/yerleşikler.ts";
import type { İsimÇözümlemeSonucu } from "../analiz/isim-çözümleyici.ts";
import type { Sembol } from "../analiz/kapsam.ts";
import type { TipSembolü } from "../analiz/tipler.ts";

export interface ÇalışmaBağlamı {
  readonly yol: string;
  readonly isimler?: İsimÇözümlemeSonucu;
  readonly tipler: ReadonlyMap<string, TipSembolü>;
  readonly aktarımlar: ReadonlyMap<Sembol, Bağ>;
}

export type Bağ =
  | { readonly tür: "değer"; değer: Değer; readonly değiştirilebilir: boolean }
  | {
      readonly tür: "işlev";
      readonly bildirim: İşlevBildirimi;
      readonly ortam: Ortam;
      readonly bağlam: ÇalışmaBağlamı;
    }
  | { readonly tür: "yerleşik"; readonly işlev: Yerleşikİşlev };

export class Ortam {
  private readonly bağlar = new Map<string, Bağ>();
  constructor(readonly üst: Ortam | null = null) {}

  tanımla(ad: string, bağ: Bağ, aralık: KaynakAralığı): void {
    if (this.bağlar.has(ad)) hata("ATA5004", `Çalışma zamanı adı zaten tanımlı: '${ad}'.`, aralık);
    this.bağlar.set(ad, bağ);
  }

  bul(ad: string, aralık: KaynakAralığı): Bağ {
    const bağ = this.bağlar.get(ad);
    if (bağ) return bağ;
    if (this.üst) return this.üst.bul(ad, aralık);
    return hata("ATA5004", `Çalışma zamanı adı bulunamadı: '${ad}'.`, aralık);
  }

  ata(ad: string, değer: Değer, aralık: KaynakAralığı): void {
    const bağ = this.bul(ad, aralık);
    if (bağ.tür !== "değer" || !bağ.değiştirilebilir)
      hata("ATA5004", `Çalışma zamanı adı değiştirilemez: '${ad}'.`, aralık);
    bağ.değer = değer;
  }
}
