import type { YapıBildirimi, SeçenekBildirimi } from "../ast/düğümler.ts";
import { basename, dirname, relative } from "node:path";

export interface TipSembolü {
  readonly modülYolu: string;
  readonly bildirim: YapıBildirimi | SeçenekBildirimi;
}

export interface NominalTip {
  readonly tür: "yapı" | "seçenek";
  readonly ad: string;
  readonly kimlik: TipSembolü;
}

export type Tip =
  | NominalTip
  | { readonly tür: "sayı" | "yazı" | "mantık" | "hiç" | "yok" | "bilinmeyen" }
  | { readonly tür: "liste"; readonly eleman: Tip }
  | { readonly tür: "isteğe-bağlı"; readonly temel: Tip };

export interface İşlevİmzası {
  readonly parametreler: readonly Tip[];
  readonly dönüş: Tip;
}

export function tipEşit(a: Tip, b: Tip): boolean {
  if (a.tür === "yapı" || a.tür === "seçenek") return a.tür === b.tür && a.kimlik === b.kimlik;
  if (a.tür === "liste") return b.tür === "liste" && tipEşit(a.eleman, b.eleman);
  if (a.tür === "isteğe-bağlı") return b.tür === "isteğe-bağlı" && tipEşit(a.temel, b.temel);
  return a.tür === b.tür;
}

export function atanabilir(kaynak: Tip, hedef: Tip): boolean {
  if (kaynak.tür === "bilinmeyen" || hedef.tür === "bilinmeyen") return true;
  if (tipEşit(kaynak, hedef)) return true;
  if (hedef.tür === "isteğe-bağlı") {
    return (
      kaynak.tür === "yok" || (kaynak.tür !== "isteğe-bağlı" && atanabilir(kaynak, hedef.temel))
    );
  }
  return false;
}

export function tipiGöster(tip: Tip, köken = false, girişYolu?: string): string {
  if (tip.tür === "yapı" || tip.tür === "seçenek")
    return köken
      ? `${girişYolu ? relative(dirname(girişYolu), tip.kimlik.modülYolu).replaceAll("\\", "/") : basename(tip.kimlik.modülYolu)} içindeki ${tip.ad}`
      : tip.ad;
  if (tip.tür === "liste") return `liste<${tipiGöster(tip.eleman, köken, girişYolu)}>`;
  if (tip.tür === "isteğe-bağlı") return `${tipiGöster(tip.temel, köken, girişYolu)}?`;
  return tip.tür;
}

function nominalTemel(tip: Tip): NominalTip | undefined {
  if (tip.tür === "liste") return nominalTemel(tip.eleman);
  if (tip.tür === "isteğe-bağlı") return nominalTemel(tip.temel);
  return tip.tür === "yapı" || tip.tür === "seçenek" ? tip : undefined;
}

export function kökenGerekli(sol: Tip, sağ: Tip): boolean {
  const a = nominalTemel(sol);
  const b = nominalTemel(sağ);
  return !!a && !!b && a.ad === b.ad && a.kimlik !== b.kimlik;
}

export function nominalTip(kimlik: TipSembolü): NominalTip {
  return { tür: kimlik.bildirim.tür, ad: kimlik.bildirim.ad, kimlik };
}
