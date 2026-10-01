import type {
  Program,
  Bildirim,
  İfade,
  Blok,
  YapıBildirimi,
  SeçenekBildirimi,
} from "../ast/düğümler.ts";
import type { Tanı } from "../tanılama/tanı.ts";
import type { Değer } from "./değer.ts";
import { yazıyaDönüştür, hiç } from "./değer.ts";
import { Ortam } from "./ortam.ts";
import { ÇalışmaZamanıHatası, hata } from "./hata.ts";
import { sayıSonucu, mantıkAl, ikiliUygula } from "./işlemler.ts";
import { yerleşikler, yerleşiğiÇağır } from "../standart/yerleşikler.ts";
import type { GirdiOku } from "../standart/yerleşikler.ts";

export interface YorumlamaSeçenekleri {
  readonly yol?: string;
  readonly çıktıYaz: (metin: string) => void;
  readonly girdiOku?: GirdiOku;
}

export interface YorumlamaSonucu {
  readonly tanılar: readonly Tanı[];
}

type Akış = { readonly tür: "devam" } | { readonly tür: "dönüş"; readonly değer: Değer };
const devam: Akış = { tür: "devam" };

export function yorumla(program: Program, seçenekler: YorumlamaSeçenekleri): YorumlamaSonucu {
  let çağrıDerinliği = 0;
  const tipBildirimleri = new Map<string, YapıBildirimi | SeçenekBildirimi>();
  function değerlendir(ifade: İfade, ortam: Ortam): Değer {
    switch (ifade.tür) {
      case "nitelikli-ad": {
        if (ifade.parçalar.length !== 2)
          return hata("ATA5005", "Çalışma zamanında geçersiz seçenek değeri.", ifade.aralık);
        return değerlendir(
          {
            tür: "seçenek-değeri",
            seçenekAdı: ifade.parçalar[0].ad,
            üyeAdı: ifade.parçalar[1].ad,
            aralık: ifade.aralık,
          },
          ortam,
        );
      }
      case "seçenek-değeri": {
        const seçenek = tipBildirimleri.get(ifade.seçenekAdı);
        if (seçenek?.tür !== "seçenek" || !seçenek.üyeler.some((üye) => üye.ad === ifade.üyeAdı))
          return hata("ATA5005", "Çalışma zamanında geçersiz seçenek değeri.", ifade.aralık);
        return { tür: "seçenek", seçenekAdı: seçenek.ad, üyeAdı: ifade.üyeAdı };
      }
      case "yapı-oluşturma": {
        const yapıAdı = ifade.yapıYolu[0].ad;
        const yapı = ifade.yapıYolu.length === 1 ? tipBildirimleri.get(yapıAdı) : undefined;
        if (yapı?.tür !== "yapı")
          return hata(
            "ATA5005",
            `Çalışma zamanı yapı tipi bulunamadı: '${yapıAdı}'.`,
            ifade.aralık,
          );
        const alanlar = new Map<string, Değer>();
        for (const alan of ifade.alanlar) {
          if (alanlar.has(alan.ad) || !yapı.alanlar.some((tanım) => tanım.ad === alan.ad))
            return hata("ATA5005", `Geçersiz yapı alanı: '${alan.ad}'.`, alan.aralık);
          alanlar.set(alan.ad, değerlendir(alan.değer, ortam));
        }
        if (yapı.alanlar.some((alan) => !alanlar.has(alan.ad)))
          return hata("ATA5005", "Çalışma zamanında yapı alanı eksik.", ifade.aralık);
        return { tür: "yapı", yapıAdı: yapı.ad, alanlar };
      }
      case "alan-erişim": {
        const hedef = değerlendir(ifade.hedef, ortam);
        if (hedef.tür !== "yapı")
          return hata("ATA5005", "Alan erişimi için yapı değeri bekleniyordu.", ifade.aralık);
        const alan = hedef.alanlar.get(ifade.alan);
        if (!alan)
          return hata(
            "ATA5005",
            `'${hedef.yapıAdı}' yapısında '${ifade.alan}' alanı bulunamadı.`,
            ifade.aralık,
          );
        return alan;
      }
      case "indeks": {
        const hedef = değerlendir(ifade.hedef, ortam);
        const indeks = değerlendir(ifade.indeks, ortam);
        if (hedef.tür !== "liste" || indeks.tür !== "sayı")
          return hata("ATA5005", "İndeksleme liste ve sayı değeri gerektirir.", ifade.aralık);
        if (!Number.isFinite(indeks.değer) || !Number.isSafeInteger(indeks.değer))
          return hata("ATA5008", "Liste indeksi güvenli tam sayı olmalıdır.", ifade.indeks.aralık);
        if (indeks.değer < 0 || indeks.değer >= hedef.elemanlar.length)
          return hata("ATA5009", "Liste indeksi aralık dışında.", ifade.indeks.aralık);
        const değer = hedef.elemanlar[indeks.değer];
        if (!değer) return hata("ATA5005", "Liste elemanı bulunamadı.", ifade.aralık);
        return değer;
      }
      case "sayı":
        return sayıSonucu(ifade.değer, ifade.aralık);
      case "mantık":
        return { tür: "mantık", değer: ifade.değer };
      case "yok":
        return { tür: "yok" };
      case "yazı":
        return {
          tür: "yazı",
          değer: ifade.parçalar
            .map((parça) =>
              parça.tür === "metin"
                ? parça.değer
                : yazıyaDönüştür(değerlendir(parça.ifade, ortam), parça.ifade.aralık),
            )
            .join(""),
        };
      case "liste":
        return {
          tür: "liste",
          elemanlar: ifade.elemanlar.map((eleman) => değerlendir(eleman, ortam)),
        };
      case "tekli": {
        const değer = değerlendir(ifade.ifade, ortam);
        if (ifade.işleç === "değil")
          return { tür: "mantık", değer: !mantıkAl(değer, ifade.aralık) };
        if (değer.tür !== "sayı")
          return hata("ATA5005", "Tekli eksi için 'sayı' bekleniyordu.", ifade.aralık);
        return sayıSonucu(-değer.değer, ifade.aralık);
      }
      case "ikili": {
        const sol = değerlendir(ifade.sol, ortam);
        if (ifade.işleç === "ve" || ifade.işleç === "veya") {
          const mantık = mantıkAl(sol, ifade.sol.aralık);
          if ((ifade.işleç === "ve" && !mantık) || (ifade.işleç === "veya" && mantık)) return sol;
          return {
            tür: "mantık",
            değer: mantıkAl(değerlendir(ifade.sağ, ortam), ifade.sağ.aralık),
          };
        }
        return ikiliUygula(ifade.işleç, sol, değerlendir(ifade.sağ, ortam), ifade.aralık);
      }
      case "tanımlayıcı": {
        const bağ = ortam.bul(ifade.ad, ifade.aralık);
        if (bağ.tür !== "değer")
          return hata("ATA5005", "İşlev yalnızca çağrı hedefi olabilir.", ifade.aralık);
        return bağ.değer;
      }
      case "atama": {
        const bağ = ortam.bul(ifade.ad, ifade.aralık);
        if (bağ.tür !== "değer" || !bağ.değiştirilebilir)
          return hata("ATA5004", `Çalışma zamanı adı değiştirilemez: '${ifade.ad}'.`, ifade.aralık);
        const sol = bağ.değer;
        let değer = değerlendir(ifade.değer, ortam);
        if (ifade.işleç !== "=") {
          const işleç = ifade.işleç.slice(0, -1);
          if (işleç === "+" || işleç === "-" || işleç === "*" || işleç === "/" || işleç === "%")
            değer = ikiliUygula(işleç, sol, değer, ifade.aralık);
        }
        ortam.ata(ifade.ad, değer, ifade.aralık);
        return değer;
      }
      case "çağrı": {
        if (ifade.çağrılan.tür !== "tanımlayıcı")
          return hata("ATA5005", "Çağrı hedefi işlev adı olmalıdır.", ifade.çağrılan.aralık);
        const bağ = ortam.bul(ifade.çağrılan.ad, ifade.çağrılan.aralık);
        if (bağ.tür === "yerleşik")
          return yerleşiğiÇağır(
            bağ.işlev,
            ifade.argümanlar.map((argüman) => değerlendir(argüman, ortam)),
            seçenekler,
            ifade.aralık,
          );
        if (bağ.tür !== "işlev")
          return hata("ATA5005", "Çağrı hedefi bir işlev değildir.", ifade.çağrılan.aralık);
        if (ifade.argümanlar.length !== bağ.bildirim.parametreler.length)
          return hata("ATA5005", "Çalışma zamanında işlev argüman sayısı uyuşmuyor.", ifade.aralık);
        if (çağrıDerinliği >= 256)
          return hata("ATA5006", "İşlev çağrı derinliği sınırı aşıldı (256).", ifade.aralık);
        çağrıDerinliği++;
        try {
          const argümanlar = ifade.argümanlar.map((argüman) => değerlendir(argüman, ortam));
          const çağrıOrtamı = new Ortam(bağ.ortam);
          bağ.bildirim.parametreler.forEach((parametre, sıra) =>
            çağrıOrtamı.tanımla(
              parametre.ad,
              { tür: "değer", değer: argümanlar[sıra]!, değiştirilebilir: false },
              parametre.aralık,
            ),
          );
          const akış = bildirimleriYürüt(bağ.bildirim.blok.bildirimler, çağrıOrtamı);
          const değer = akış.tür === "dönüş" ? akış.değer : hiç;
          const değerBekleniyor =
            bağ.bildirim.dönüşTipi.tür !== "temel-tip" || bağ.bildirim.dönüşTipi.ad !== "hiç";
          if (değerBekleniyor === (değer.tür === "hiç"))
            return hata(
              "ATA5005",
              "İşlevin çalışma zamanı dönüş değeri bildirimine uymuyor.",
              ifade.aralık,
            );
          return değer;
        } finally {
          çağrıDerinliği--;
        }
      }
    }
  }

  function bildirimleriYürüt(bildirimler: readonly Bildirim[], ortam: Ortam): Akış {
    for (const bildirim of bildirimler) {
      const akış = yürüt(bildirim, ortam);
      if (akış.tür === "dönüş") return akış;
    }
    return devam;
  }

  function blokYürüt(blok: Blok, üst: Ortam): Akış {
    return bildirimleriYürüt(blok.bildirimler, new Ortam(üst));
  }

  function yürüt(bildirim: Bildirim, ortam: Ortam): Akış {
    switch (bildirim.tür) {
      case "sabit":
      case "değişken": {
        const değer = değerlendir(bildirim.başlangıç, ortam);
        ortam.tanımla(
          bildirim.ad,
          { tür: "değer", değer, değiştirilebilir: bildirim.tür === "değişken" },
          bildirim.aralık,
        );
        break;
      }
      case "yazdır":
        seçenekler.çıktıYaz(
          yazıyaDönüştür(değerlendir(bildirim.ifade, ortam), bildirim.ifade.aralık),
        );
        break;
      case "ifade-bildirimi":
        değerlendir(bildirim.ifade, ortam);
        break;
      case "blok":
        return blokYürüt(bildirim, ortam);
      case "eşleştir": {
        const hedef = değerlendir(bildirim.hedef, ortam);
        if (hedef.tür !== "seçenek")
          return hata(
            "ATA5005",
            "Eşleştir hedefi seçenek değeri olmalıdır.",
            bildirim.hedef.aralık,
          );
        const kol = bildirim.kollar.find(
          (aday) =>
            aday.desen.tür === "diğer" ||
            (aday.desen.tür === "seçenek-değeri"
              ? aday.desen.seçenekAdı === hedef.seçenekAdı && aday.desen.üyeAdı === hedef.üyeAdı
              : aday.desen.parçalar.length === 2 &&
                aday.desen.parçalar[0].ad === hedef.seçenekAdı &&
                aday.desen.parçalar[1].ad === hedef.üyeAdı),
        );
        if (!kol)
          return hata(
            "ATA5005",
            "Çalışma zamanında eşleşen seçenek kolu bulunamadı.",
            bildirim.aralık,
          );
        return blokYürüt(kol.blok, ortam);
      }
      case "koşul":
        if (mantıkAl(değerlendir(bildirim.koşul, ortam), bildirim.koşul.aralık))
          return blokYürüt(bildirim.doğruysa, ortam);
        return bildirim.değilse ? yürüt(bildirim.değilse, ortam) : devam;
      case "iken":
        while (mantıkAl(değerlendir(bildirim.koşul, ortam), bildirim.koşul.aralık)) {
          const akış = blokYürüt(bildirim.blok, ortam);
          if (akış.tür === "dönüş") return akış;
        }
        break;
      case "liste-döngüsü": {
        const liste = değerlendir(bildirim.koleksiyon, ortam);
        if (liste.tür !== "liste")
          return hata(
            "ATA5005",
            "Liste döngüsünde 'liste' değeri bekleniyordu.",
            bildirim.koleksiyon.aralık,
          );
        for (const değer of liste.elemanlar) {
          const döngüOrtamı = new Ortam(ortam);
          döngüOrtamı.tanımla(
            bildirim.ad,
            { tür: "değer", değer, değiştirilebilir: false },
            bildirim.aralık,
          );
          const akış = bildirimleriYürüt(bildirim.blok.bildirimler, döngüOrtamı);
          if (akış.tür === "dönüş") return akış;
        }
        break;
      }
      case "döndür":
        return { tür: "dönüş", değer: bildirim.ifade ? değerlendir(bildirim.ifade, ortam) : hiç };
      case "işlev":
      case "yapı":
      case "seçenek":
        break;
    }
    return devam;
  }

  try {
    const küresel = new Ortam();
    for (const işlev of yerleşikler)
      küresel.tanımla(işlev.ad, { tür: "yerleşik", işlev }, program.aralık);
    for (const bildirim of program.bildirimler) {
      if (bildirim.tür === "yapı" || bildirim.tür === "seçenek") {
        const adlar = bildirim.tür === "yapı" ? bildirim.alanlar : bildirim.üyeler;
        if (
          tipBildirimleri.has(bildirim.ad) ||
          new Set(adlar.map((öğe) => öğe.ad)).size !== adlar.length ||
          (bildirim.tür === "seçenek" && adlar.length === 0)
        )
          hata(
            "ATA5005",
            `Geçersiz çalışma zamanı tip bildirimi: '${bildirim.ad}'.`,
            bildirim.aralık,
          );
        tipBildirimleri.set(bildirim.ad, bildirim);
      }
      if (bildirim.tür === "işlev")
        küresel.tanımla(bildirim.ad, { tür: "işlev", bildirim, ortam: küresel }, bildirim.aralık);
    }
    const akış = bildirimleriYürüt(program.bildirimler, küresel);
    if (akış.tür === "dönüş") hata("ATA5005", "İşlev dışında dönüş yapılamaz.", program.aralık);
    return { tanılar: [] };
  } catch (yakalanan) {
    if (!(yakalanan instanceof ÇalışmaZamanıHatası)) throw yakalanan;
    return {
      tanılar: [
        {
          kod: yakalanan.kod,
          seviye: "hata",
          mesaj: yakalanan.message,
          aralık: yakalanan.aralık,
          yol: seçenekler.yol ?? "<kaynak>",
        },
      ],
    };
  }
}
