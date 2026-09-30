import type { KaynakAralığı } from "../kaynak/konum.ts";

export type TanıSeviyesi = "hata" | "uyarı";

export interface Tanı {
  readonly kod: `ATA${number}`;
  readonly seviye: TanıSeviyesi;
  readonly mesaj: string;
  readonly yol: string;
  readonly aralık: KaynakAralığı;
}
