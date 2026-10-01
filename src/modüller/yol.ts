import { realpath, stat } from "node:fs/promises";
import { dirname, isAbsolute, posix, relative, resolve, sep } from "node:path";

type YolHatası = { readonly kod: "ATA6001" | "ATA6002" | "ATA6008"; readonly mesaj: string };
export type ModülYoluSonucu = { readonly yol: string } | YolHatası;

// AST'deki decoded yol doğrulanır; filesystem adlarında Unicode dönüşümü yapılmaz.
export function modülYoluHatası(yol: string): string | null {
  if (!yol) return "Modül yolu boş olamaz.";
  if (yol.startsWith("/")) return "Modül yolu göreli olmalıdır.";
  if (yol.includes("\\")) return "Modül yolunda yalnız '/' ayırıcı kullanılabilir.";
  if (yol.includes(":")) return "Modül yolunda ':' kullanılamaz.";
  if (/\p{Cc}/u.test(yol)) return "Modül yolunda kontrol karakteri kullanılamaz.";
  const parçalar = yol.split("/");
  if (parçalar.includes("")) return "Modül yolunda boş segment kullanılamaz.";
  const son = parçalar.at(-1)!;
  if (son === "." || son === "..") return "Modül yolu bir dosya adıyla bitmelidir.";
  if (posix.extname(son)) return "Modül yolu açık dosya uzantısı içermemelidir.";
  return null;
}

export function modülGörünenYolu(girişYolu: string, yol: string): string {
  const görünen = relative(dirname(girişYolu), yol);
  return (isAbsolute(görünen) ? yol : görünen).split(sep).join("/");
}

export function modülDosyaHatası(hata: unknown, hedef: string): YolHatası {
  const kod = typeof hata === "object" && hata !== null && "code" in hata ? hata.code : null;
  if (kod === "ENOENT" || kod === "ENOTDIR")
    return { kod: "ATA6001", mesaj: `Modül dosyası bulunamadı: '${hedef}'.` };
  return {
    kod: "ATA6008",
    mesaj: `Modül okunamadı veya kanonikleştirilemedi: '${hedef}'. Dosyanın okuma iznini ve UTF-8 kodlamasını kontrol edin.`,
  };
}

export async function modülYolunuÇöz(importerYolu: string, yol: string): Promise<ModülYoluSonucu> {
  const hata = modülYoluHatası(yol);
  if (hata) return { kod: "ATA6002", mesaj: hata };
  const hedef = resolve(dirname(importerYolu), `${yol}.ata`);
  try {
    const kanonik = await realpath(hedef);
    if (!(await stat(kanonik)).isFile())
      return { kod: "ATA6002", mesaj: `Modül hedefi normal dosya değil: '${yol}.ata'.` };
    return { yol: kanonik };
  } catch (dosyaHatası) {
    return modülDosyaHatası(dosyaHatası, `${yol}.ata`);
  }
}
