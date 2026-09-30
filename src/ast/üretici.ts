import type { CstNode, IToken } from "chevrotain";
import type { Kaynak } from "../kaynak/kaynak.ts";
import { aralıkBul } from "../kaynak/konum.ts";
import type { KaynakAralığı } from "../kaynak/konum.ts";
import type { Tanı } from "../tanılama/tanı.ts";
import type {
  Bildirim,
  Blok,
  KoşulBildirimi,
  DeğerBildirimi,
  İfade,
  Program,
  Tipİfadesi,
  İkiliİşleç,
  Atamaİşleci,
  SeçenekDeğeriİfadesi,
} from "./düğümler.ts";

function alt(düğüm: CstNode, ad: string, sıra = 0): CstNode {
  const eleman = düğüm.children[ad]?.[sıra];
  if (!eleman || !("children" in eleman)) throw new Error(`CST düğümü eksik: ${ad}`);
  return eleman;
}

function token(düğüm: CstNode, ad: string, sıra = 0): IToken {
  const eleman = düğüm.children[ad]?.[sıra];
  if (!eleman || !("image" in eleman)) throw new Error(`CST tokenı eksik: ${ad}`);
  return eleman;
}

function altlar(düğüm: CstNode, ad: string): CstNode[] {
  return (düğüm.children[ad] ?? []).map((_, sıra) => alt(düğüm, ad, sıra));
}

function kaçışlarıÇöz(metin: string): string {
  return metin.replace(/\\(["\\nrt{}])/g, (_, kaçış: string) => {
    switch (kaçış) {
      case "n":
        return "\n";
      case "r":
        return "\r";
      case "t":
        return "\t";
      default:
        return kaçış;
    }
  });
}

export class AstÜreticisi {
  readonly tanılar: Tanı[] = [];
  constructor(private readonly kaynak: Kaynak) {}

  private aralık(düğüm: CstNode): KaynakAralığı {
    const konum = düğüm.location;
    return aralıkBul(this.kaynak, konum!.startOffset, konum!.endOffset! + 1);
  }

  üret(düğüm: CstNode): Program {
    return {
      tür: "program",
      aralık: aralıkBul(this.kaynak, 0, this.kaynak.içerik.length),
      bildirimler: altlar(düğüm, "üstBildirim").map((altDüğüm) => this.bildirim(altDüğüm)),
    };
  }

  private bildirim(düğüm: CstNode): Bildirim {
    if (düğüm.name === "değerBildirimi") return this.değerBildirimi(düğüm);
    if (düğüm.name === "blok") return this.blok(düğüm);
    if (düğüm.name === "koşul") return this.koşul(düğüm);
    if (düğüm.name === "seçenekBildirimi")
      return {
        tür: "seçenek",
        ad: token(düğüm, "ad").image,
        aralık: this.aralık(düğüm),
        üyeler: altlar(düğüm, "seçenekÜyesi").map((üye) => ({
          ad: token(üye, "ad").image,
          aralık: this.aralık(üye),
        })),
      };
    if (düğüm.name === "yapıBildirimi")
      return {
        tür: "yapı",
        ad: token(düğüm, "ad").image,
        alanlar: altlar(düğüm, "yapıAlanı").map((alan) => ({
          ad: token(alan, "ad").image,
          tip: this.tip(alt(alan, "tip")),
          aralık: this.aralık(alan),
        })),
        aralık: this.aralık(düğüm),
      };
    if (düğüm.name === "işlevBildirimi")
      return {
        tür: "işlev",
        ad: token(düğüm, "ad").image,
        dönüşTipi: this.tip(alt(düğüm, "tip")),
        parametreler: altlar(düğüm, "parametre").map((parametre) => ({
          tür: "parametre",
          ad: token(parametre, "ad").image,
          tip: this.tip(alt(parametre, "tip")),
          aralık: this.aralık(parametre),
        })),
        blok: this.blok(alt(düğüm, "blok")),
        aralık: this.aralık(düğüm),
      };
    if (düğüm.name === "ifadeBildirimi") {
      const ifade = this.ifade(alt(düğüm, "ifade"));
      const aralık = this.aralık(düğüm);
      if (düğüm.children.eşleştirmeSonu) {
        const son = alt(düğüm, "eşleştirmeSonu");
        return {
          tür: "eşleştir",
          hedef: ifade,
          aralık,
          kollar: altlar(son, "eşleştirmeKolu").map((kol) => ({
            desen: kol.children.seçenekDeğeri
              ? this.seçenekDeğeri(alt(kol, "seçenekDeğeri"))
              : {
                  tür: "diğer",
                  aralık: aralıkBul(
                    this.kaynak,
                    token(kol, "diğer").startOffset,
                    token(kol, "diğer").startOffset + token(kol, "diğer").image.length,
                  ),
                },
            blok: this.blok(alt(kol, "blok")),
            aralık: this.aralık(kol),
          })),
        };
      }
      if (düğüm.children.iken)
        return { tür: "iken", koşul: ifade, blok: this.blok(alt(düğüm, "blok")), aralık };
      if (düğüm.children.içindeki)
        return {
          tür: "liste-döngüsü",
          koleksiyon: ifade,
          ad: token(düğüm, "ad").image,
          blok: this.blok(alt(düğüm, "blok")),
          aralık,
        };
      return {
        tür: düğüm.children.yazdır
          ? "yazdır"
          : düğüm.children.döndür
            ? "döndür"
            : "ifade-bildirimi",
        ifade,
        aralık,
      };
    }
    if (düğüm.children.döndür) return { tür: "döndür", ifade: null, aralık: this.aralık(düğüm) };
    const altDüğüm = Object.values(düğüm.children)
      .flat()
      .find((eleman): eleman is CstNode => "children" in eleman);
    if (!altDüğüm) throw new Error(`Bildirim düğümü eksik: ${düğüm.name}`);
    return this.bildirim(altDüğüm);
  }

  private blok(düğüm: CstNode): Blok {
    return {
      tür: "blok",
      bildirimler: altlar(düğüm, "bildirim").map((bildirim) => this.bildirim(bildirim)),
      aralık: this.aralık(düğüm),
    };
  }

  private seçenekDeğeri(düğüm: CstNode): SeçenekDeğeriİfadesi {
    return {
      tür: "seçenek-değeri",
      seçenekAdı: token(düğüm, "ad").image,
      üyeAdı: token(düğüm, "üye").image,
      aralık: this.aralık(düğüm),
    };
  }

  private koşul(düğüm: CstNode): KoşulBildirimi {
    return {
      tür: "koşul",
      koşul: this.ifade(alt(düğüm, "ifade")),
      doğruysa: this.blok(alt(düğüm, "blok")),
      değilse: düğüm.children.koşul
        ? this.koşul(alt(düğüm, "koşul"))
        : (düğüm.children.blok?.length ?? 0) > 1
          ? this.blok(alt(düğüm, "blok", 1))
          : null,
      aralık: this.aralık(düğüm),
    };
  }

  private değerBildirimi(düğüm: CstNode): DeğerBildirimi {
    return {
      tür: token(düğüm, "çeşit").image === "sabit" ? "sabit" : "değişken",
      ad: token(düğüm, "ad").image,
      açıkTip: düğüm.children.tip ? this.tip(alt(düğüm, "tip")) : null,
      başlangıç: this.ifade(alt(düğüm, "ifade")),
      aralık: this.aralık(düğüm),
    };
  }

  private tip(düğüm: CstNode): Tipİfadesi {
    const konum = düğüm.location!;
    const soru = düğüm.children.Soru ? token(düğüm, "Soru") : null;
    const sonToken = token(
      düğüm,
      düğüm.children.temel ? "temel" : düğüm.children.tipAdı ? "tipAdı" : "Büyük",
    );
    const aralık = aralıkBul(
      this.kaynak,
      konum.startOffset,
      sonToken.startOffset + sonToken.image.length,
    );
    const temel: Tipİfadesi = düğüm.children.temel
      ? {
          tür: "temel-tip",
          ad: token(düğüm, "temel").image as "sayı" | "yazı" | "mantık" | "hiç",
          aralık,
        }
      : düğüm.children.tipAdı
        ? { tür: "adlandırılmış-tip", ad: token(düğüm, "tipAdı").image, aralık }
        : { tür: "liste-tipi", eleman: this.tip(alt(düğüm, "tip")), aralık };
    return soru ? { tür: "isteğe-bağlı-tip", temel, aralık: this.aralık(düğüm) } : temel;
  }

  private ifade(düğüm: CstNode): İfade {
    if (düğüm.name === "seçenekDeğeri") return this.seçenekDeğeri(düğüm);
    if (düğüm.children.seçenekDeğeri) return this.seçenekDeğeri(alt(düğüm, "seçenekDeğeri"));
    const aralık = this.aralık(düğüm);
    if (düğüm.name === "ifade") {
      return düğüm.children.ad
        ? {
            tür: "atama",
            ad: token(düğüm, "ad").image,
            işleç: token(düğüm, "işleç").image as Atamaİşleci,
            değer: this.ifade(alt(düğüm, "değer")),
            aralık,
          }
        : this.ifade(alt(düğüm, "veyaİfadesi"));
    }
    if (
      ["veyaİfadesi", "veİfadesi", "eşitlik", "karşılaştırma", "toplama", "çarpma"].includes(
        düğüm.name,
      )
    ) {
      const öğeler = altlar(düğüm, "öğe");
      let sol = this.ifade(öğeler[0]!);
      for (let i = 1; i < öğeler.length; i++) {
        const sağ = this.ifade(öğeler[i]!);
        sol = {
          tür: "ikili",
          işleç: token(düğüm, "işleç", i - 1).image as İkiliİşleç,
          sol,
          sağ,
          aralık: { başlangıç: sol.aralık.başlangıç, bitiş: sağ.aralık.bitiş },
        };
      }
      return sol;
    }
    if (düğüm.name === "tekli") {
      if (düğüm.children.Eksi)
        return { tür: "tekli", işleç: "-", ifade: this.ifade(alt(düğüm, "tekli")), aralık };
      let ifade = this.ifade(alt(düğüm, "çağrı"));
      for (let i = 0; i < (düğüm.children.değil?.length ?? 0); i++) {
        const son = token(düğüm, "değil", i);
        ifade = {
          tür: "tekli",
          işleç: "değil",
          ifade,
          aralık: aralıkBul(
            this.kaynak,
            ifade.aralık.başlangıç.ofset,
            son.startOffset + son.image.length,
          ),
        };
      }
      return ifade;
    }
    if (düğüm.name === "çağrı") {
      let ifade = this.ifade(alt(düğüm, "birincil"));
      for (const son of altlar(düğüm, "postfixSonu")) {
        const postfixAralığı = { başlangıç: ifade.aralık.başlangıç, bitiş: this.aralık(son).bitiş };
        if (son.children.çağrıSonu)
          ifade = {
            tür: "çağrı",
            çağrılan: ifade,
            argümanlar: altlar(alt(son, "çağrıSonu"), "ifade").map((argüman) =>
              this.ifade(argüman),
            ),
            aralık: postfixAralığı,
          };
        else if (son.children.alan)
          ifade = {
            tür: "alan-erişim",
            hedef: ifade,
            alan: token(son, "alan").image,
            aralık: postfixAralığı,
          };
        else
          ifade = {
            tür: "indeks",
            hedef: ifade,
            indeks: this.ifade(alt(son, "ifade")),
            aralık: postfixAralığı,
          };
      }
      return ifade;
    }
    if (düğüm.name === "listeİfadesi")
      return {
        tür: "liste",
        elemanlar: altlar(düğüm, "ifade").map((eleman) => this.ifade(eleman)),
        aralık,
      };
    if (düğüm.children.listeİfadesi) return this.ifade(alt(düğüm, "listeİfadesi"));
    if (düğüm.children.yapıOluşturma) return this.ifade(alt(düğüm, "yapıOluşturma"));
    if (düğüm.name === "yapıOluşturma")
      return {
        tür: "yapı-oluşturma",
        yapıAdı: token(düğüm, "ad").image,
        aralık,
        alanlar: altlar(düğüm, "alanDeğeri").map((alan) => ({
          ad: token(alan, "ad").image,
          değer: this.ifade(alt(alan, "ifade")),
          aralık: this.aralık(alan),
        })),
      };
    if (düğüm.children.yerleştirmeliYazı) return this.ifade(alt(düğüm, "yerleştirmeliYazı"));
    if (düğüm.name === "yerleştirmeliYazı")
      return {
        tür: "yazı",
        aralık,
        parçalar: altlar(düğüm, "yazıParçası").map((parça) =>
          parça.children.YazıMetni
            ? { tür: "metin", değer: kaçışlarıÇöz(token(parça, "YazıMetni").image) }
            : { tür: "ifade", ifade: this.ifade(alt(parça, "ifade")) },
        ),
      };
    if (düğüm.children.ifade) return { ...this.ifade(alt(düğüm, "ifade")), aralık };
    const değer = token(düğüm, "değer");
    switch (değer.tokenType.name) {
      case "Sayı": {
        const sayı = Number(değer.image);
        if (!Number.isFinite(sayı) || (!değer.image.includes(".") && !Number.isSafeInteger(sayı))) {
          this.tanılar.push({
            kod: "ATA2002",
            seviye: "hata",
            yol: this.kaynak.yol,
            mesaj: "Sayı değeri güvenli temsil aralığının dışında.",
            aralık,
          });
        }
        return { tür: "sayı", değer: sayı, aralık };
      }
      case "Yazı":
        return {
          tür: "yazı",
          parçalar: [{ tür: "metin", değer: kaçışlarıÇöz(değer.image.slice(1, -1)) }],
          aralık,
        };
      case "doğru":
      case "yanlış":
        return { tür: "mantık", değer: değer.image === "doğru", aralık };
      case "yok":
        return { tür: "yok", değer: null, aralık };
      default:
        return { tür: "tanımlayıcı", ad: değer.image, aralık };
    }
  }
}
