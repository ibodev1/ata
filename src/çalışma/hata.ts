import type { KaynakAralığı } from "../kaynak/konum.ts";

type ÇalışmaTanıKodu =
  | "ATA5001"
  | "ATA5002"
  | "ATA5003"
  | "ATA5004"
  | "ATA5005"
  | "ATA5006"
  | "ATA5007"
  | "ATA5008"
  | "ATA5009";

// Yalnızca beklenen çalışma zamanı tanıları API sınırında yakalanır.
export class ÇalışmaZamanıHatası extends Error {
  constructor(
    readonly kod: ÇalışmaTanıKodu,
    mesaj: string,
    readonly aralık: KaynakAralığı,
  ) {
    super(mesaj);
  }
}

export function hata(kod: ÇalışmaTanıKodu, mesaj: string, aralık: KaynakAralığı): never {
  throw new ÇalışmaZamanıHatası(kod, mesaj, aralık);
}
