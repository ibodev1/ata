import type { Program, Bildirim, İfade, Parametre, Blok, YapıBildirimi } from "../ast/düğümler.ts";
import type { Tanı } from "../tanılama/tanı.ts";
import { Kapsam } from "./kapsam.ts";
import type { Sembol } from "./kapsam.ts";
import { yerleşikler } from "../standart/yerleşikler.ts";

export interface İsimÇözümlemeSonucu {
  readonly tanılar: readonly Tanı[];
  readonly bağlar: ReadonlyMap<İfade, Sembol>;
  readonly bildirimSembolleri: ReadonlyMap<Bildirim | Parametre, Sembol>;
  readonly yapılar: ReadonlyMap<string, YapıBildirimi>;
}

export function isimleriÇöz(program: Program, yol = "<kaynak>"): İsimÇözümlemeSonucu {
  const tanılar: Tanı[] = [];
  const bağlar = new Map<İfade, Sembol>();
  const bildirimSembolleri = new Map<Bildirim | Parametre, Sembol>();
  const programKapsamı = new Kapsam();
  const yapılar = new Map<string, YapıBildirimi>();
  for (const işlev of yerleşikler) programKapsamı.ekle({ tür: "yerleşik", ad: işlev.ad, işlev });

  function ekle(kapsam: Kapsam, sembol: Exclude<Sembol, { tür: "yerleşik" }>): void {
    bildirimSembolleri.set(sembol.bildirim, sembol);
    if (!kapsam.ekle(sembol))
      tanılar.push({
        kod: sembol.tür === "parametre" ? "ATA3003" : "ATA3002",
        seviye: "hata",
        yol,
        mesaj:
          sembol.tür === "parametre"
            ? `Yinelenen parametre: '${sembol.ad}'.`
            : `Aynı isim bu kapsamda zaten tanımlı: '${sembol.ad}'.`,
        aralık: sembol.aralık,
      });
  }

  function bağla(ifade: İfade, ad: string, kapsam: Kapsam): void {
    const sembol = kapsam.bul(ad);
    if (sembol) bağlar.set(ifade, sembol);
    else
      tanılar.push({
        kod: "ATA3001",
        seviye: "hata",
        yol,
        mesaj: `Tanımlanmamış isim: '${ad}'.`,
        aralık: ifade.aralık,
      });
  }

  function ifadeÇöz(ifade: İfade, kapsam: Kapsam): void {
    switch (ifade.tür) {
      case "yapı-oluşturma":
        ifade.alanlar.forEach((alan) => ifadeÇöz(alan.değer, kapsam));
        break;
      case "alan-erişim":
        ifadeÇöz(ifade.hedef, kapsam);
        break;
      case "indeks":
        ifadeÇöz(ifade.hedef, kapsam);
        ifadeÇöz(ifade.indeks, kapsam);
        break;
      case "tanımlayıcı":
        bağla(ifade, ifade.ad, kapsam);
        break;
      case "atama":
        bağla(ifade, ifade.ad, kapsam);
        ifadeÇöz(ifade.değer, kapsam);
        break;
      case "tekli":
        ifadeÇöz(ifade.ifade, kapsam);
        break;
      case "ikili":
        ifadeÇöz(ifade.sol, kapsam);
        ifadeÇöz(ifade.sağ, kapsam);
        break;
      case "çağrı":
        ifadeÇöz(ifade.çağrılan, kapsam);
        ifade.argümanlar.forEach((argüman) => ifadeÇöz(argüman, kapsam));
        break;
      case "liste":
        ifade.elemanlar.forEach((eleman) => ifadeÇöz(eleman, kapsam));
        break;
      case "yazı":
        ifade.parçalar.forEach((parça) => {
          if (parça.tür === "ifade") ifadeÇöz(parça.ifade, kapsam);
        });
        break;
      case "sayı":
      case "mantık":
      case "yok":
        break;
    }
  }

  function blokÇöz(blok: Blok, kapsam: Kapsam): void {
    for (const bildirim of blok.bildirimler) bildirimÇöz(bildirim, kapsam);
  }

  function bildirimÇöz(bildirim: Bildirim, kapsam: Kapsam): void {
    switch (bildirim.tür) {
      case "yapı":
        break;
      case "sabit":
      case "değişken":
        ifadeÇöz(bildirim.başlangıç, kapsam);
        ekle(kapsam, {
          tür: "değer",
          ad: bildirim.ad,
          bildirim,
          aralık: bildirim.aralık,
          değiştirilebilir: bildirim.tür === "değişken",
        });
        break;
      case "işlev": {
        const işlevKapsamı = new Kapsam(kapsam);
        for (const parametre of bildirim.parametreler)
          ekle(işlevKapsamı, {
            tür: "parametre",
            ad: parametre.ad,
            bildirim: parametre,
            aralık: parametre.aralık,
          });
        blokÇöz(bildirim.blok, işlevKapsamı);
        break;
      }
      case "blok":
        blokÇöz(bildirim, new Kapsam(kapsam));
        break;
      case "koşul":
        ifadeÇöz(bildirim.koşul, kapsam);
        blokÇöz(bildirim.doğruysa, new Kapsam(kapsam));
        if (bildirim.değilse) bildirimÇöz(bildirim.değilse, kapsam);
        break;
      case "iken":
        ifadeÇöz(bildirim.koşul, kapsam);
        blokÇöz(bildirim.blok, new Kapsam(kapsam));
        break;
      case "liste-döngüsü": {
        ifadeÇöz(bildirim.koleksiyon, kapsam);
        const döngüKapsamı = new Kapsam(kapsam);
        ekle(döngüKapsamı, { tür: "döngü", ad: bildirim.ad, bildirim, aralık: bildirim.aralık });
        blokÇöz(bildirim.blok, döngüKapsamı);
        break;
      }
      case "yazdır":
      case "ifade-bildirimi":
        ifadeÇöz(bildirim.ifade, kapsam);
        break;
      case "döndür":
        if (bildirim.ifade) ifadeÇöz(bildirim.ifade, kapsam);
        break;
    }
  }

  for (const bildirim of program.bildirimler) {
    if (bildirim.tür === "yapı") {
      if (yapılar.has(bildirim.ad))
        tanılar.push({
          kod: "ATA3005",
          seviye: "hata",
          yol,
          aralık: bildirim.aralık,
          mesaj: `Yinelenen yapı tipi: '${bildirim.ad}'.`,
        });
      else yapılar.set(bildirim.ad, bildirim);
    }
    if (bildirim.tür === "işlev")
      ekle(programKapsamı, { tür: "işlev", ad: bildirim.ad, bildirim, aralık: bildirim.aralık });
  }
  for (const bildirim of program.bildirimler) bildirimÇöz(bildirim, programKapsamı);
  return { tanılar, bağlar, bildirimSembolleri, yapılar };
}
