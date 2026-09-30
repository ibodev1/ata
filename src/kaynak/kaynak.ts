export interface Kaynak {
  readonly yol: string;
  readonly içerik: string;
}

export function kaynakOluştur(yol: string, içerik: string): Kaynak {
  return Object.freeze({ yol, içerik: içerik.normalize("NFC") });
}

export async function kaynakOku(yol: string): Promise<Kaynak> {
  const baytlar = await Bun.file(yol).arrayBuffer();
  const içerik = new TextDecoder("utf-8", { fatal: true }).decode(baytlar);
  return kaynakOluştur(yol, içerik);
}
