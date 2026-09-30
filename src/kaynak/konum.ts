import type { Kaynak } from "./kaynak.ts";

export interface KaynakKonumu {
  readonly satır: number;
  readonly sütun: number;
  readonly ofset: number;
}

/** Bitiş dışlayıcıdır; ofset ve sütunlar normalleştirilmiş metnin UTF-16 birimleridir. */
export interface KaynakAralığı {
  readonly başlangıç: KaynakKonumu;
  readonly bitiş: KaynakKonumu;
}

const satırÖnbelleği = new WeakMap<Kaynak, readonly number[]>();

export function konumBul(kaynak: Kaynak, ofset: number): KaynakKonumu {
  if (!Number.isInteger(ofset) || ofset < 0 || ofset > kaynak.içerik.length) {
    throw new RangeError("Kaynak ofseti içerik sınırları içinde bir tam sayı olmalıdır.");
  }
  let başlangıçlar = satırÖnbelleği.get(kaynak);
  if (!başlangıçlar) {
    başlangıçlar = [
      0,
      ...Array.from(
        kaynak.içerik.matchAll(/\r\n|\r|\n/g),
        (eşleşme) => eşleşme.index + eşleşme[0].length,
      ),
    ];
    satırÖnbelleği.set(kaynak, başlangıçlar);
  }
  let alt = 0;
  let üst = başlangıçlar.length;
  while (alt + 1 < üst) {
    const orta = Math.floor((alt + üst) / 2);
    if (başlangıçlar[orta]! <= ofset) alt = orta;
    else üst = orta;
  }
  return { satır: alt + 1, sütun: ofset - başlangıçlar[alt]! + 1, ofset };
}

export function aralıkBul(kaynak: Kaynak, başlangıç: number, bitiş: number): KaynakAralığı {
  if (bitiş < başlangıç)
    throw new RangeError("Kaynak aralığının bitişi başlangıcından önce olamaz.");
  return { başlangıç: konumBul(kaynak, başlangıç), bitiş: konumBul(kaynak, bitiş) };
}
