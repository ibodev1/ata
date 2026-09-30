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

export interface YapıAlanı extends Düğüm {
  readonly ad: string;
  readonly tip: Tipİfadesi;
}

export interface YapıBildirimi extends Düğüm {
  readonly tür: "yapı";
  readonly ad: string;
  readonly alanlar: readonly YapıAlanı[];
}

export interface SeçenekBildirimi extends Düğüm {
  readonly tür: "seçenek";
  readonly ad: string;
  readonly üyeler: readonly (Düğüm & { readonly ad: string })[];
}

export interface SeçenekDeğeriİfadesi extends Düğüm {
  readonly tür: "seçenek-değeri";
  readonly seçenekAdı: string;
  readonly üyeAdı: string;
}

export interface EşleştirmeKolu extends Düğüm {
  readonly desen: SeçenekDeğeriİfadesi | (Düğüm & { readonly tür: "diğer" });
  readonly blok: Blok;
}

export interface EşleştirBildirimi extends Düğüm {
  readonly tür: "eşleştir";
  readonly hedef: İfade;
  readonly kollar: readonly EşleştirmeKolu[];
}

export type Bildirim =
  | DeğerBildirimi
  | Blok
  | KoşulBildirimi
  | İkenDöngüsü
  | ListeDöngüsü
  | İşlevBildirimi
  | YapıBildirimi
  | SeçenekBildirimi
  | EşleştirBildirimi
  | (Düğüm & { readonly tür: "yazdır" | "ifade-bildirimi"; readonly ifade: İfade })
  | (Düğüm & { readonly tür: "döndür"; readonly ifade: İfade | null });

export type Tipİfadesi =
  | (Düğüm & { readonly tür: "adlandırılmış-tip"; readonly ad: string })
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

export type YazıParçası =
  | { readonly tür: "metin"; readonly değer: string }
  | { readonly tür: "ifade"; readonly ifade: İfade };

export type İfade =
  | SeçenekDeğeriİfadesi
  | (Düğüm & {
      readonly tür: "yapı-oluşturma";
      readonly yapıAdı: string;
      readonly alanlar: readonly (Düğüm & { readonly ad: string; readonly değer: İfade })[];
    })
  | (Düğüm & { readonly tür: "alan-erişim"; readonly hedef: İfade; readonly alan: string })
  | (Düğüm & { readonly tür: "indeks"; readonly hedef: İfade; readonly indeks: İfade })
  | (Düğüm & { readonly tür: "sayı"; readonly değer: number })
  | (Düğüm & { readonly tür: "yazı"; readonly parçalar: readonly YazıParçası[] })
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
