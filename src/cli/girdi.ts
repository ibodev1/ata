import { readSync } from "node:fs";

// Bun prompt isteme boşluk ekler; bu sınır istemi değiştirmeden gösterir.
export function girdiOku(istem: string): string | null {
  process.stdout.write(istem);
  const bayt = new Uint8Array(1);
  const satır: number[] = [];
  while (true) {
    const okunan = readSync(0, bayt, 0, 1, null);
    if (okunan === 0) {
      if (satır.length === 0) return null;
      break;
    }
    const değer = bayt[0]!;
    if (değer === 10) break;
    satır.push(değer);
  }
  if (satır.at(-1) === 13) satır.pop();
  return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(satır));
}
