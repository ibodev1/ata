import type { Kaynak } from "../kaynak/kaynak.ts";
import type { Tanı } from "./tanı.ts";

const sekmeleriAç = (yazı: string) => yazı.replaceAll("\t", "    ");

export function tanıyıGöster(kaynak: Kaynak, tanı: Tanı): string {
  const { satır, sütun } = tanı.aralık.başlangıç;
  const metin = kaynak.içerik.normalize("NFC").split(/\r\n|\r|\n/)[satır - 1] ?? "";
  const önek = `${satır} │ `;
  const boşluk = Bun.stringWidth(önek + sekmeleriAç(metin.slice(0, sütun - 1)));
  const uzunluk =
    tanı.aralık.bitiş.satır === satır ? tanı.aralık.bitiş.sütun - sütun : metin.length - sütun + 1;
  const işaretSayısı = Math.max(
    1,
    Bun.stringWidth(sekmeleriAç(metin.slice(sütun - 1, sütun - 1 + uzunluk))),
  );
  return `${tanı.kod} (${tanı.seviye}): ${tanı.mesaj}\n\n  --> ${tanı.yol}:${satır}:${sütun}\n\n${önek}${sekmeleriAç(metin)}\n${" ".repeat(boşluk)}${"^".repeat(işaretSayısı)}`;
}
