import { CstParser, EOF, tokenMatcher } from "chevrotain";
import type { CstNode, IParserErrorMessageProvider, ParserMethod, TokenType } from "chevrotain";
import { kaynakOluştur } from "../kaynak/kaynak.ts";
import type { Kaynak } from "../kaynak/kaynak.ts";
import { aralıkBul } from "../kaynak/konum.ts";
import { sözcüklereAyır } from "../sözcük/çözümleyici.ts";
import { tokenTürleri, Ad, SatırSonu } from "../sözcük/tokenlar.ts";
import type { Tanı } from "../tanılama/tanı.ts";
import type { Program } from "../ast/düğümler.ts";
import { AstÜreticisi } from "../ast/üretici.ts";

function tokenTürü(ad: string): TokenType {
  const tür = tokenTürleri.find((token) => token.name === ad);
  if (!tür) throw new Error(`Token türü bulunamadı: ${ad}`);
  return tür;
}

const hataMesajları: IParserErrorMessageProvider = {
  buildMismatchTokenMessage: ({ expected }) =>
    `'${expected === EOF ? "dosya sonu" : (expected.LABEL ?? expected.name)}' bekleniyordu.`,
  buildNoViableAltMessage: () =>
    "Beklenmeyen sözcük; bu konumda geçerli bir ifade veya bildirim bekleniyordu.",
  buildEarlyExitMessage: () => "Bildirimler arasında satır sonu veya ';' bekleniyordu.",
  buildNotAllInputParsedMessage: () =>
    "Beklenmeyen sözcük; bildirimler arasında satır sonu veya ';' kullanın.",
};

const atamaTürleri = [
  "Ata",
  "ToplayarakAta",
  "ÇıkararakAta",
  "ÇarparakAta",
  "BölerekAta",
  "KalanlaAta",
].map(tokenTürü);

class AtaAyrıştırıcısı extends CstParser {
  constructor() {
    super(tokenTürleri, {
      nodeLocationTracking: "full",
      recoveryEnabled: false,
      errorMessageProvider: hataMesajları,
    });
    this.performSelfAnalysis();
  }

  readonly program = this.RULE("program", () => {
    this.MANY(() => this.SUBRULE(this.ayırıcı));
    this.OPTION(() => this.SUBRULE(this.üstBildirim));
    this.MANY2(() => {
      this.AT_LEAST_ONE(() => this.SUBRULE2(this.ayırıcı));
      this.OPTION2(() => this.SUBRULE2(this.üstBildirim));
    });
    this.CONSUME(EOF);
  });

  readonly üstBildirim = this.RULE("üstBildirim", () =>
    this.OR([
      { ALT: () => this.SUBRULE(this.işlevBildirimi) },
      { ALT: () => this.SUBRULE(this.yapıBildirimi) },
      { ALT: () => this.SUBRULE(this.seçenekBildirimi) },
      { ALT: () => this.SUBRULE(this.bildirim) },
    ]),
  );
  readonly bildirim = this.RULE("bildirim", () => {
    this.OR([
      {
        GATE: () =>
          tokenMatcher(this.LA(1), tokenTürü("Yazı")) &&
          (tokenMatcher(this.LA(2), tokenTürü("kullan")) ||
            tokenMatcher(this.LA(2), tokenTürü("içinden")) ||
            tokenMatcher(this.LA(2), tokenTürü("Tanımlayıcı"))),
        ALT: () => this.SUBRULE(this.kullanBildirimi),
      },
      { ALT: () => this.SUBRULE(this.değerBildirimi) },
      { ALT: () => this.SUBRULE(this.koşul) },
      { ALT: () => this.SUBRULE(this.blok) },
      { ALT: () => this.CONSUME(tokenTürü("döndür")) },
      { ALT: () => this.SUBRULE(this.ifadeBildirimi) },
    ]);
  });
  readonly kullanBildirimi = this.RULE("kullanBildirimi", () => {
    this.CONSUME(tokenTürü("Yazı"), { LABEL: "yol" });
    this.OPTION(() =>
      this.OR([
        {
          ALT: () => {
            this.CONSUME(tokenTürü("Tanımlayıcı"), { LABEL: "takmaAd" });
            this.CONSUME(tokenTürü("olarak"));
          },
        },
        {
          ALT: () => {
            this.CONSUME(tokenTürü("içinden"));
            this.CONSUME(Ad, { LABEL: "seçilenAd" });
            this.MANY(() => {
              this.CONSUME(tokenTürü("Virgül"));
              this.CONSUME2(Ad, { LABEL: "seçilenAd" });
            });
          },
        },
      ]),
    );
    this.CONSUME(tokenTürü("kullan"));
  });
  readonly ifadeBildirimi = this.RULE("ifadeBildirimi", () => {
    this.SUBRULE(this.ifade);
    this.OPTION(() =>
      this.OR([
        { ALT: () => this.CONSUME(tokenTürü("yazdır")) },
        { ALT: () => this.CONSUME(tokenTürü("döndür")) },
        { ALT: () => this.SUBRULE(this.eşleştirmeSonu) },
        {
          ALT: () => {
            this.CONSUME(tokenTürü("iken"));
            this.SUBRULE(this.satırlar);
            this.SUBRULE(this.blok);
          },
        },
        {
          ALT: () => {
            this.CONSUME(tokenTürü("içindeki"));
            this.CONSUME(tokenTürü("her"));
            this.CONSUME(Ad, { LABEL: "ad" });
            this.CONSUME(tokenTürü("için"));
            this.SUBRULE2(this.satırlar);
            this.SUBRULE2(this.blok);
          },
        },
      ]),
    );
  });

  readonly satırlar = this.RULE("satırlar", () => this.MANY(() => this.CONSUME(SatırSonu)));

  readonly seçenekBildirimi = this.RULE("seçenekBildirimi", () => {
    this.CONSUME(tokenTürü("seçenek"));
    this.CONSUME(Ad, { LABEL: "ad" });
    this.SUBRULE(this.satırlar);
    this.CONSUME(tokenTürü("SolSüslü"));
    this.SUBRULE2(this.satırlar);
    this.OPTION(() => {
      this.SUBRULE(this.seçenekÜyesi);
      this.MANY(() => {
        this.SUBRULE(this.alanAyırıcı);
        this.OR([
          { ALT: () => this.SUBRULE2(this.seçenekÜyesi) },
          { GATE: () => tokenMatcher(this.LA(1), tokenTürü("SağSüslü")), ALT: () => {} },
        ]);
      });
    });
    this.CONSUME(tokenTürü("SağSüslü"));
  });

  readonly seçenekÜyesi = this.RULE("seçenekÜyesi", () => this.CONSUME(Ad, { LABEL: "ad" }));

  readonly nitelikliAd = this.RULE("nitelikliAd", () => {
    this.CONSUME(Ad, { LABEL: "parça" });
    this.AT_LEAST_ONE(() => {
      this.CONSUME(tokenTürü("ÇiftİkiNokta"));
      this.CONSUME2(Ad, { LABEL: "parça" });
    });
  });

  readonly eşleştirmeSonu = this.RULE("eşleştirmeSonu", () => {
    this.CONSUME(tokenTürü("eşleştir"));
    this.SUBRULE(this.satırlar);
    this.CONSUME(tokenTürü("SolSüslü"));
    this.SUBRULE2(this.satırlar);
    this.MANY(() => {
      this.SUBRULE(this.eşleştirmeKolu);
      this.SUBRULE3(this.satırlar);
    });
    this.CONSUME(tokenTürü("SağSüslü"));
  });

  readonly eşleştirmeKolu = this.RULE("eşleştirmeKolu", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.nitelikliAd) },
      { ALT: () => this.CONSUME(tokenTürü("diğer")) },
    ]);
    this.CONSUME(tokenTürü("ise"));
    this.SUBRULE(this.satırlar);
    this.SUBRULE(this.blok);
  });

  readonly blok = this.RULE("blok", () => {
    this.CONSUME(tokenTürü("SolSüslü"));
    this.MANY(() => this.SUBRULE(this.ayırıcı));
    this.OPTION(() => this.SUBRULE(this.bildirim));
    this.MANY2(() => {
      this.AT_LEAST_ONE(() => this.SUBRULE2(this.ayırıcı));
      this.OPTION2(() => this.SUBRULE2(this.bildirim));
    });
    this.CONSUME(tokenTürü("SağSüslü"));
  });

  readonly koşul = this.RULE("koşul", () => {
    this.CONSUME(tokenTürü("eğer"));
    this.SUBRULE(this.ifade);
    this.CONSUME(tokenTürü("ise"));
    this.SUBRULE(this.satırlar);
    this.SUBRULE(this.blok);
    this.OPTION({
      GATE: () => {
        let sıra = 1;
        while (tokenMatcher(this.LA(sıra), SatırSonu)) sıra++;
        return tokenMatcher(this.LA(sıra), tokenTürü("değilse"));
      },
      DEF: () => {
        this.SUBRULE2(this.satırlar);
        this.CONSUME(tokenTürü("değilse"));
        this.SUBRULE3(this.satırlar);
        this.OR([{ ALT: () => this.SUBRULE(this.koşul) }, { ALT: () => this.SUBRULE2(this.blok) }]);
      },
    });
  });

  readonly işlevBildirimi = this.RULE("işlevBildirimi", () => {
    this.CONSUME(tokenTürü("işlev"));
    this.CONSUME(Ad, { LABEL: "ad" });
    this.CONSUME(tokenTürü("SolParantez"));
    this.OPTION(() => {
      this.SUBRULE(this.parametre);
      this.MANY(() => {
        this.CONSUME(tokenTürü("Virgül"));
        this.SUBRULE2(this.parametre);
      });
    });
    this.CONSUME(tokenTürü("SağParantez"));
    this.CONSUME(tokenTürü("İkiNokta"));
    this.SUBRULE(this.tip);
    this.SUBRULE(this.satırlar);
    this.SUBRULE(this.blok);
  });

  readonly parametre = this.RULE("parametre", () => {
    this.CONSUME(Ad, { LABEL: "ad" });
    this.CONSUME(tokenTürü("İkiNokta"));
    this.SUBRULE(this.tip);
  });

  readonly yapıBildirimi = this.RULE("yapıBildirimi", () => {
    this.CONSUME(tokenTürü("yapı"));
    this.CONSUME(Ad, { LABEL: "ad" });
    this.SUBRULE(this.satırlar);
    this.CONSUME(tokenTürü("SolSüslü"));
    this.SUBRULE2(this.satırlar);
    this.OPTION(() => {
      this.SUBRULE(this.yapıAlanı);
      this.MANY(() => {
        this.SUBRULE(this.alanAyırıcı);
        this.OR([
          { ALT: () => this.SUBRULE2(this.yapıAlanı) },
          { GATE: () => tokenMatcher(this.LA(1), tokenTürü("SağSüslü")), ALT: () => {} },
        ]);
      });
    });
    this.CONSUME(tokenTürü("SağSüslü"));
  });

  readonly yapıAlanı = this.RULE("yapıAlanı", () => {
    this.CONSUME(Ad, { LABEL: "ad" });
    this.CONSUME(tokenTürü("İkiNokta"));
    this.SUBRULE(this.tip);
  });

  readonly alanAyırıcı = this.RULE("alanAyırıcı", () => {
    this.OR([
      {
        ALT: () => {
          this.CONSUME(tokenTürü("Virgül"));
          this.SUBRULE(this.satırlar);
        },
      },
      { ALT: () => this.AT_LEAST_ONE(() => this.CONSUME(SatırSonu)) },
    ]);
  });

  readonly ayırıcı = this.RULE("ayırıcı", () => {
    this.OR([
      { ALT: () => this.CONSUME(tokenTürü("SatırSonu")) },
      { ALT: () => this.CONSUME(tokenTürü("NoktalıVirgül")) },
    ]);
  });

  readonly değerBildirimi = this.RULE("değerBildirimi", () => {
    this.OR([
      { ALT: () => this.CONSUME(tokenTürü("sabit"), { LABEL: "çeşit" }) },
      { ALT: () => this.CONSUME(tokenTürü("değişken"), { LABEL: "çeşit" }) },
    ]);
    this.CONSUME(Ad, { LABEL: "ad" });
    this.OPTION(() => {
      this.CONSUME(tokenTürü("İkiNokta"));
      this.SUBRULE(this.tip);
    });
    this.CONSUME(tokenTürü("Ata"));
    this.SUBRULE(this.ifade);
  });

  readonly tip = this.RULE("tip", () => {
    this.OR([
      ...["sayı", "yazı", "mantık", "hiç"].map((ad) => ({
        ALT: () => this.CONSUME(tokenTürü(ad), { LABEL: "temel" }),
      })),
      {
        ALT: () => {
          this.CONSUME(tokenTürü("Tanımlayıcı"), { LABEL: "tipAdı" });
          this.MANY(() => {
            this.CONSUME(tokenTürü("ÇiftİkiNokta"));
            this.CONSUME2(tokenTürü("Tanımlayıcı"), { LABEL: "tipAdı" });
          });
        },
      },
      {
        ALT: () => {
          this.CONSUME(tokenTürü("liste"));
          this.CONSUME(tokenTürü("Küçük"));
          this.SUBRULE(this.tip);
          this.CONSUME(tokenTürü("Büyük"));
        },
      },
    ]);
    this.OPTION(() => this.CONSUME(tokenTürü("Soru")));
  });

  readonly ifade = this.RULE("ifade", () => {
    this.OR([
      {
        GATE: () =>
          tokenMatcher(this.LA(1), Ad) && atamaTürleri.some((tür) => tokenMatcher(this.LA(2), tür)),
        ALT: () => {
          this.CONSUME(Ad, { LABEL: "ad" });
          this.OR2(
            atamaTürleri.map((tür) => ({ ALT: () => this.CONSUME(tür, { LABEL: "işleç" }) })),
          );
          this.SUBRULE(this.ifade, { LABEL: "değer" });
        },
      },
      { ALT: () => this.SUBRULE(this.veya) },
    ]);
  });

  private ikili(kural: ParserMethod<[], CstNode>, işleçler: readonly string[]): void {
    this.SUBRULE(kural, { LABEL: "öğe" });
    this.MANY(() => {
      this.OR(
        işleçler.map((ad) => ({ ALT: () => this.CONSUME(tokenTürü(ad), { LABEL: "işleç" }) })),
      );
      this.SUBRULE2(kural, { LABEL: "öğe" });
    });
  }

  readonly veya = this.RULE("veyaİfadesi", () => this.ikili(this.ve, ["veya"]));
  readonly ve = this.RULE("veİfadesi", () => this.ikili(this.eşitlik, ["ve"]));
  readonly eşitlik = this.RULE("eşitlik", () =>
    this.ikili(this.karşılaştırma, ["Eşit", "EşitDeğil"]),
  );
  readonly karşılaştırma = this.RULE("karşılaştırma", () =>
    this.ikili(this.toplama, ["Küçük", "KüçükEşit", "Büyük", "BüyükEşit"]),
  );
  readonly toplama = this.RULE("toplama", () => this.ikili(this.çarpma, ["Artı", "Eksi"]));
  readonly çarpma = this.RULE("çarpma", () => this.ikili(this.tekli, ["Çarpı", "Bölü", "Kalan"]));

  readonly tekli = this.RULE("tekli", () => {
    this.OR([
      {
        ALT: () => {
          this.CONSUME(tokenTürü("Eksi"));
          this.SUBRULE(this.tekli);
        },
      },
      {
        ALT: () => {
          this.SUBRULE(this.çağrı);
          this.MANY(() => this.CONSUME(tokenTürü("değil")));
        },
      },
    ]);
  });

  readonly çağrı = this.RULE("çağrı", () => {
    this.SUBRULE(this.birincil);
    this.MANY(() => this.SUBRULE(this.postfixSonu));
  });

  readonly postfixSonu = this.RULE("postfixSonu", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.çağrıSonu) },
      {
        ALT: () => {
          this.CONSUME(tokenTürü("SolKöşeli"));
          this.SUBRULE(this.ifade);
          this.CONSUME(tokenTürü("SağKöşeli"));
        },
      },
      {
        ALT: () => {
          this.CONSUME(tokenTürü("Nokta"));
          this.CONSUME(Ad, { LABEL: "alan" });
        },
      },
    ]);
  });

  readonly yapıOluşturma = this.RULE("yapıOluşturma", () => {
    this.CONSUME(Ad, { LABEL: "parça" });
    this.MANY2(() => {
      this.CONSUME(tokenTürü("ÇiftİkiNokta"));
      this.CONSUME2(Ad, { LABEL: "parça" });
    });
    this.CONSUME(tokenTürü("SolSüslü"));
    this.SUBRULE(this.satırlar);
    this.OPTION(() => {
      this.SUBRULE(this.alanDeğeri);
      this.MANY(() => {
        this.SUBRULE(this.alanAyırıcı);
        this.OR([
          { ALT: () => this.SUBRULE2(this.alanDeğeri) },
          { GATE: () => tokenMatcher(this.LA(1), tokenTürü("SağSüslü")), ALT: () => {} },
        ]);
      });
    });
    this.CONSUME(tokenTürü("SağSüslü"));
  });

  readonly alanDeğeri = this.RULE("alanDeğeri", () => {
    this.CONSUME(Ad, { LABEL: "ad" });
    this.CONSUME(tokenTürü("İkiNokta"));
    this.SUBRULE(this.ifade);
  });

  readonly çağrıSonu = this.RULE("çağrıSonu", () => {
    this.CONSUME(tokenTürü("SolParantez"));
    this.OPTION(() => {
      this.SUBRULE(this.ifade);
      this.MANY(() => {
        this.CONSUME(tokenTürü("Virgül"));
        this.SUBRULE2(this.ifade);
      });
    });
    this.CONSUME(tokenTürü("SağParantez"));
  });

  readonly liste = this.RULE("listeİfadesi", () => {
    this.CONSUME(tokenTürü("SolKöşeli"));
    this.OPTION(() => {
      this.SUBRULE(this.ifade);
      this.MANY(() => {
        this.CONSUME(tokenTürü("Virgül"));
        this.SUBRULE2(this.ifade);
      });
    });
    this.CONSUME(tokenTürü("SağKöşeli"));
  });

  readonly birincil = this.RULE("birincil", () => {
    this.OR([
      { ALT: () => this.CONSUME(tokenTürü("Sayı"), { LABEL: "değer" }) },
      { ALT: () => this.CONSUME(tokenTürü("Yazı"), { LABEL: "değer" }) },
      { ALT: () => this.SUBRULE(this.yerleştirmeliYazı) },
      { ALT: () => this.CONSUME(tokenTürü("doğru"), { LABEL: "değer" }) },
      { ALT: () => this.CONSUME(tokenTürü("yanlış"), { LABEL: "değer" }) },
      { ALT: () => this.CONSUME(tokenTürü("yok"), { LABEL: "değer" }) },
      {
        GATE: () => {
          let sıra = 1;
          if (!tokenMatcher(this.LA(sıra), Ad)) return false;
          while (
            tokenMatcher(this.LA(sıra + 1), tokenTürü("ÇiftİkiNokta")) &&
            tokenMatcher(this.LA(sıra + 2), Ad)
          )
            sıra += 2;
          return tokenMatcher(this.LA(sıra + 1), tokenTürü("SolSüslü"));
        },
        ALT: () => this.SUBRULE(this.yapıOluşturma),
      },
      { ALT: () => this.SUBRULE(this.nitelikliAd) },
      { ALT: () => this.CONSUME(Ad, { LABEL: "değer" }) },
      {
        ALT: () => {
          this.CONSUME(tokenTürü("SolParantez"));
          this.SUBRULE(this.ifade);
          this.CONSUME(tokenTürü("SağParantez"));
        },
      },
      { ALT: () => this.SUBRULE(this.liste) },
    ]);
  });

  readonly yerleştirmeliYazı = this.RULE("yerleştirmeliYazı", () => {
    this.CONSUME(tokenTürü("YazıBaşlangıcı"));
    this.MANY(() => this.SUBRULE(this.yazıParçası));
    this.CONSUME(tokenTürü("YazıSonu"));
  });

  readonly yazıParçası = this.RULE("yazıParçası", () => {
    this.OR([
      { ALT: () => this.CONSUME(tokenTürü("YazıMetni")) },
      {
        ALT: () => {
          this.CONSUME(tokenTürü("YerleştirmeBaşlangıcı"));
          this.SUBRULE(this.ifade);
          this.CONSUME(tokenTürü("YerleştirmeSonu"));
        },
      },
    ]);
  });
}

const parser = new AtaAyrıştırıcısı();

export interface AyrıştırmaSonucu {
  readonly program: Program | null;
  readonly tanılar: readonly Tanı[];
}

export function ayrıştır(girdi: Kaynak): AyrıştırmaSonucu {
  const kaynak = kaynakOluştur(girdi.yol, girdi.içerik);
  const sözcükler = sözcüklereAyır(kaynak, { satırSonlarınıKoru: true });
  if (sözcükler.tanılar.length > 0) return { program: null, tanılar: sözcükler.tanılar };
  const parantezler: string[] = [];
  parser.input = sözcükler.tokenlar.filter((token) => {
    if (["SolParantez", "SolKöşeli", "SolSüslü"].some((ad) => tokenMatcher(token, tokenTürü(ad))))
      parantezler.push(tokenMatcher(token, tokenTürü("SolSüslü")) ? "süslü" : "ifade");
    if (["SağParantez", "SağKöşeli", "SağSüslü"].some((ad) => tokenMatcher(token, tokenTürü(ad))))
      parantezler.pop();
    return token.tokenType !== SatırSonu || parantezler.at(-1) !== "ifade";
  });
  const cst = parser.program();
  const tanılar: Tanı[] = parser.errors.map((hata) => {
    const ofset = tokenMatcher(hata.token, EOF) ? kaynak.içerik.length : hata.token.startOffset;
    return {
      kod: "ATA2001",
      seviye: "hata",
      mesaj: hata.message,
      yol: kaynak.yol,
      aralık: aralıkBul(
        kaynak,
        ofset,
        tokenMatcher(hata.token, EOF) ? ofset : ofset + hata.token.image.length,
      ),
    };
  });
  if (tanılar.length > 0) return { program: null, tanılar };
  const üretici = new AstÜreticisi(kaynak);
  const program = üretici.üret(cst);
  return { program: üretici.tanılar.length > 0 ? null : program, tanılar: üretici.tanılar };
}
