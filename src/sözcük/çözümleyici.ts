import { Lexer, createTokenInstance } from "chevrotain";
import type { IToken } from "chevrotain";
import { kaynakOluştur } from "../kaynak/kaynak.ts";
import type { Kaynak } from "../kaynak/kaynak.ts";
import { aralıkBul, konumBul } from "../kaynak/konum.ts";
import type { Tanı } from "../tanılama/tanı.ts";
import {
  lexerModları,
  Yazı,
  YazıMetni,
  YazıBaşlangıcı,
  YazıSonu,
  YazıSatırSonu,
  SatırSonu,
} from "./tokenlar.ts";

const çözümleyici = new Lexer(lexerModları, {
  positionTracking: "full",
  lineTerminatorsPattern: /\r\n|\r|\n/g,
  lineTerminatorCharacters: ["\r", "\n"],
});

export interface SözcükÇözümlemeSonucu {
  readonly tokenlar: readonly IToken[];
  readonly tanılar: readonly Tanı[];
}

export function sözcüklereAyır(
  girdi: Kaynak,
  seçenekler: { readonly satırSonlarınıKoru?: boolean } = {},
): SözcükÇözümlemeSonucu {
  const kaynak = kaynakOluştur(girdi.yol, girdi.içerik);
  const sonuç = çözümleyici.tokenize(kaynak.içerik);
  const tanılar: Tanı[] = sonuç.errors.map((hata) => ({
    kod: "ATA1001",
    seviye: "hata",
    yol: kaynak.yol,
    mesaj: `Geçersiz karakter: '${kaynak.içerik.slice(hata.offset, hata.offset + hata.length)}' burada kullanılamaz.`,
    aralık: aralıkBul(kaynak, hata.offset, hata.offset + hata.length),
  }));
  for (const token of sonuç.tokens) {
    if (token.tokenType !== Yazı && token.tokenType !== YazıMetni) continue;
    let sonlandırıldı = false;
    for (let i = token.tokenType === Yazı ? 1 : 0; i < token.image.length; i++) {
      if (token.image[i] === '"') {
        sonlandırıldı = true;
        break;
      }
      if (token.image[i] === "\\") {
        const kodNoktası = token.image.codePointAt(i + 1);
        const kaçış = kodNoktası === undefined ? undefined : String.fromCodePoint(kodNoktası);
        if (kaçış !== undefined && !['"', "\\", "n", "r", "t", "{", "}"].includes(kaçış)) {
          tanılar.push({
            kod: "ATA1003",
            seviye: "hata",
            yol: kaynak.yol,
            mesaj: `Geçersiz kaçış dizisi: \\${kaçış}. Desteklenen kaçışlar: \\", \\\\, \\n, \\r, \\t, \\{, \\}.`,
            aralık: aralıkBul(
              kaynak,
              token.startOffset + i,
              token.startOffset + i + 1 + kaçış.length,
            ),
          });
        }
        i += kaçış?.length ?? 1;
      }
    }
    if (token.tokenType === Yazı && !sonlandırıldı)
      tanılar.push({
        kod: "ATA1002",
        seviye: "hata",
        yol: kaynak.yol,
        mesaj: "Yazı sonlandırılmadı; kapanış çift tırnağı bekleniyor.",
        aralık: aralıkBul(kaynak, token.startOffset, token.startOffset + token.image.length),
      });
  }
  const açıkYazılar: IToken[] = [];
  function yazıHatası(başlangıç: IToken, son: number): void {
    tanılar.push({
      kod: "ATA1002",
      seviye: "hata",
      yol: kaynak.yol,
      mesaj: "Yazı sonlandırılmadı; tek satırda kapanış çift tırnağı bekleniyor.",
      aralık: aralıkBul(kaynak, başlangıç.startOffset, son),
    });
  }
  for (const token of sonuç.tokens) {
    if (token.tokenType === YazıBaşlangıcı) açıkYazılar.push(token);
    if (token.tokenType === YazıSonu || token.tokenType === YazıSatırSonu) {
      const başlangıç = açıkYazılar.pop();
      if (
        başlangıç &&
        (token.tokenType === YazıSatırSonu ||
          /[\r\n]/.test(kaynak.içerik.slice(başlangıç.startOffset, token.startOffset)))
      )
        yazıHatası(başlangıç, token.startOffset + token.image.length);
    }
  }
  for (const başlangıç of açıkYazılar) yazıHatası(başlangıç, kaynak.içerik.length);
  for (const token of sonuç.groups["açıklamalar"] ?? []) {
    if (token.image.length >= 4 && token.image.endsWith("*/")) continue;
    tanılar.push({
      kod: "ATA1004",
      seviye: "hata",
      yol: kaynak.yol,
      mesaj: "Çok satırlı açıklama sonlandırılmadı; '*/' bekleniyor.",
      aralık: aralıkBul(kaynak, token.startOffset, token.startOffset + token.image.length),
    });
  }
  tanılar.sort((a, b) => a.aralık.başlangıç.ofset - b.aralık.başlangıç.ofset);
  if (!seçenekler.satırSonlarınıKoru) {
    return { tokenlar: sonuç.tokens.filter((token) => token.tokenType !== SatırSonu), tanılar };
  }
  const tokenlar = [...sonuç.tokens];
  // Atlanan blok açıklamalarının satır sonları da bildirim sınırı olabilir.
  for (const açıklama of sonuç.groups["açıklamalar"] ?? []) {
    for (const eşleşme of açıklama.image.matchAll(/\r\n|\r|\n/g)) {
      const ofset = açıklama.startOffset + eşleşme.index;
      const son = ofset + eşleşme[0].length - 1;
      const başlangıç = konumBul(kaynak, ofset);
      const bitiş = konumBul(kaynak, son);
      tokenlar.push(
        createTokenInstance(
          SatırSonu,
          eşleşme[0],
          ofset,
          son,
          başlangıç.satır,
          bitiş.satır,
          başlangıç.sütun,
          bitiş.sütun,
        ),
      );
    }
  }
  tokenlar.sort((a, b) => a.startOffset - b.startOffset);
  return { tokenlar, tanılar };
}
