import type { KaynakAralığı } from "../kaynak/konum.ts";

interface Düğüm {
  readonly aralık: KaynakAralığı;
}

export interface Program extends Düğüm {
  readonly tür: "program";
  readonly bildirimler: readonly Bildirim[];
}

export interface DeğerBildirimi extends Düğüm {
  readonly tür: "sabit" | "değişken";
  readonly ad: string;
  readonly açıkTip: Tipİfadesi | null;
  readonly başlangıç: İfade;
}

export interface Blok extends Düğüm {
  readonly tür: "blok";
  readonly bildirimler: readonly Bildirim[];
}

export interface KoşulBildirimi extends Düğüm {
  readonly tür: "koşul";
  readonly koşul: İfade;
  readonly doğruysa: Blok;
  readonly değilse: Blok | KoşulBildirimi | null;
}

export interface İkenDöngüsü extends Düğüm {
  readonly tür: "iken";
  readonly koşul: İfade;
  readonly blok: Blok;
}

export interface ListeDöngüsü extends Düğüm {
  readonly tür: "liste-döngüsü";
  readonly koleksiyon: İfade;
  readonly ad: string;
  readonly blok: Blok;
}

export interface Parametre extends Düğüm {
  readonly tür: "parametre";
  readonly ad: string;
  readonly tip: Tipİfadesi;
}

export interface İşlevBildirimi extends Düğüm {
  readonly tür: "işlev";
  readonly ad: string;
  readonly parametreler: readonly Parametre[];
  readonly dönüşTipi: Tipİfadesi;
  readonly blok: Blok;
}

export type Bildirim =
  | DeğerBildirimi
  | Blok
  | KoşulBildirimi
  | İkenDöngüsü
  | ListeDöngüsü
  | İşlevBildirimi
  | (Düğüm & { readonly tür: "yazdır" | "ifade-bildirimi"; readonly ifade: İfade })
  | (Düğüm & { readonly tür: "döndür"; readonly ifade: İfade | null });

export type Tipİfadesi =
  | (Düğüm & { readonly tür: "temel-tip"; readonly ad: "sayı" | "yazı" | "mantık" | "hiç" })
  | (Düğüm & { readonly tür: "liste-tipi"; readonly eleman: Tipİfadesi })
  | (Düğüm & { readonly tür: "isteğe-bağlı-tip"; readonly temel: Tipİfadesi });

export type İkiliİşleç =
  | "*"
  | "/"
  | "%"
  | "+"
  | "-"
  | "<"
  | "<="
  | ">"
  | ">="
  | "=="
  | "!="
  | "ve"
  | "veya";
export type Atamaİşleci = "=" | "+=" | "-=" | "*=" | "/=" | "%=";

export type İfade =
  | (Düğüm & { readonly tür: "sayı"; readonly değer: number })
  | (Düğüm & { readonly tür: "yazı"; readonly değer: string })
  | (Düğüm & { readonly tür: "mantık"; readonly değer: boolean })
  | (Düğüm & { readonly tür: "yok"; readonly değer: null })
  | (Düğüm & { readonly tür: "tanımlayıcı"; readonly ad: string })
  | (Düğüm & { readonly tür: "tekli"; readonly işleç: "-" | "değil"; readonly ifade: İfade })
  | (Düğüm & {
      readonly tür: "ikili";
      readonly işleç: İkiliİşleç;
      readonly sol: İfade;
      readonly sağ: İfade;
    })
  | (Düğüm & {
      readonly tür: "atama";
      readonly işleç: Atamaİşleci;
      readonly ad: string;
      readonly değer: İfade;
    })
  | (Düğüm & {
      readonly tür: "çağrı";
      readonly çağrılan: İfade;
      readonly argümanlar: readonly İfade[];
    })
  | (Düğüm & { readonly tür: "liste"; readonly elemanlar: readonly İfade[] });
