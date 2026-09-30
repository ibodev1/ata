export type Tip =
  | { readonly tür: "yapı"; readonly ad: string }
  | { readonly tür: "sayı" | "yazı" | "mantık" | "hiç" | "yok" | "bilinmeyen" }
  | { readonly tür: "liste"; readonly eleman: Tip }
  | { readonly tür: "isteğe-bağlı"; readonly temel: Tip };

export interface İşlevİmzası {
  readonly parametreler: readonly Tip[];
  readonly dönüş: Tip;
}

export function tipEşit(a: Tip, b: Tip): boolean {
  if (a.tür === "yapı") return b.tür === "yapı" && a.ad === b.ad;
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

export function tipiGöster(tip: Tip): string {
  if (tip.tür === "yapı") return tip.ad;
  if (tip.tür === "liste") return `liste<${tipiGöster(tip.eleman)}>`;
  if (tip.tür === "isteğe-bağlı") return `${tipiGöster(tip.temel)}?`;
  return tip.tür;
}
