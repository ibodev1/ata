export type Değer =
  | { readonly tür: "sayı"; readonly değer: number }
  | { readonly tür: "yazı"; readonly değer: string }
  | { readonly tür: "mantık"; readonly değer: boolean }
  | { readonly tür: "yok" | "hiç" }
  | { readonly tür: "liste"; readonly elemanlar: readonly Değer[] };

export const hiç: Değer = { tür: "hiç" };

export function değeriGöster(değer: Değer): string {
  switch (değer.tür) {
    case "sayı":
      return String(değer.değer);
    case "yazı":
      return değer.değer;
    case "mantık":
      return değer.değer ? "doğru" : "yanlış";
    case "yok":
      return "yok";
    case "hiç":
      return "hiç";
    case "liste":
      return `[${değer.elemanlar
        .map((eleman) =>
          eleman.tür === "yazı" ? JSON.stringify(eleman.değer) : değeriGöster(eleman),
        )
        .join(", ")}]`;
  }
}
