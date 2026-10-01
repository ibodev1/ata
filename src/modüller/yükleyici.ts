import { realpath, stat } from "node:fs/promises";
import { ayrıştır } from "../ayrıştırıcı/ayrıştırıcı.ts";
import { kaynakOku } from "../kaynak/kaynak.ts";
import type { Kaynak } from "../kaynak/kaynak.ts";
import type { ModülBağımlılığı, ModülKaydı, ModülYüklemeSonucu } from "./grafik.ts";
import type { Tanı } from "../tanılama/tanı.ts";
import { modülDosyaHatası, modülYolunuÇöz, modülGörünenYolu } from "./yol.ts";

export async function modülleriYükle(girişYolu: string): Promise<ModülYüklemeSonucu> {
  const modüller = new Map<string, ModülKaydı>();
  const başarısızlar = new Set<string>();
  const kaynaklar = new Map<string, Kaynak>();
  const sıra: ModülKaydı[] = [];
  const tanılar: Tanı[] = [];
  const okumaHataları = new Map<string, unknown>();
  const yığın: string[] = [];

  async function yükle(kanonikYol: string): Promise<ModülKaydı | null> {
    const önceki = modüller.get(kanonikYol);
    if (önceki) return önceki;
    if (başarısızlar.has(kanonikYol)) return null;
    let kaynak: Kaynak;
    try {
      kaynak = kaynaklar.get(kanonikYol) ?? (await kaynakOku(kanonikYol));
    } catch (hata) {
      okumaHataları.set(kanonikYol, hata);
      başarısızlar.add(kanonikYol);
      return null;
    }
    kaynaklar.set(kanonikYol, kaynak);
    const sonuç = ayrıştır(kaynak);
    tanılar.push(...sonuç.tanılar);
    if (!sonuç.program) {
      başarısızlar.add(kanonikYol);
      return null;
    }
    const bağımlılıklar: ModülBağımlılığı[] = [];
    const modül: ModülKaydı = { kanonikYol, kaynak, program: sonuç.program, bağımlılıklar };
    modüller.set(kanonikYol, modül);
    yığın.push(kanonikYol);
    for (const bildirim of modül.program.kullanBildirimleri) {
      // eslint-disable-next-line no-await-in-loop -- Kaynak sıralı DFS; paralel çözümleme yapılmaz.
      const hedef = await modülYolunuÇöz(kanonikYol, bildirim.yol);
      if (!("yol" in hedef)) {
        tanılar.push({ ...hedef, seviye: "hata", yol: kanonikYol, aralık: bildirim.yolAralığı });
        continue;
      }
      const hedefYol = hedef.yol;
      bağımlılıklar.push({ bildirim, hedefYol });
      const döngüBaşlangıcı = yığın.indexOf(hedefYol);
      if (döngüBaşlangıcı !== -1) {
        const zincir = [...yığın.slice(döngüBaşlangıcı), hedefYol]
          .map((yol) => modülGörünenYolu(giriş, yol))
          .join(" -> ");
        tanılar.push({
          kod: "ATA6003",
          seviye: "hata",
          mesaj: `Döngüsel modül bağımlılığı: ${zincir}`,
          yol: kanonikYol,
          aralık: bildirim.yolAralığı,
        });
        continue;
      }
      // eslint-disable-next-line no-await-in-loop -- Bir dal tamamlanmadan sonraki import ziyaret edilmez.
      await yükle(hedefYol);
      if (okumaHataları.has(hedefYol)) {
        tanılar.push({
          ...modülDosyaHatası(okumaHataları.get(hedefYol), `${bildirim.yol}.ata`),
          seviye: "hata",
          yol: kanonikYol,
          aralık: bildirim.yolAralığı,
        });
      }
    }
    yığın.pop();
    sıra.push(modül);
    return modül;
  }

  let giriş: string;
  try {
    giriş = await realpath(girişYolu);
    if (!(await stat(giriş)).isFile())
      return { grafik: null, tanılar: [], kaynaklar, girişOkunamadı: true };
    kaynaklar.set(giriş, await kaynakOku(giriş));
  } catch {
    return { grafik: null, tanılar: [], kaynaklar, girişOkunamadı: true };
  }
  const girişModülü = await yükle(giriş);
  return {
    grafik: girişModülü && tanılar.length === 0 ? { giriş: girişModülü, modüller, sıra } : null,
    tanılar,
    kaynaklar,
    girişOkunamadı: false,
  };
}
