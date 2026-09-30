import type { Program, Bildirim, İfade, Blok } from "../ast/düğümler.ts";
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
  function değerlendir(ifade: İfade, ortam: Ortam): Değer {
    switch (ifade.tür) {
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
        break;
    }
    return devam;
  }

  try {
    const küresel = new Ortam();
    for (const işlev of yerleşikler)
      küresel.tanımla(işlev.ad, { tür: "yerleşik", işlev }, program.aralık);
    for (const bildirim of program.bildirimler) {
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
