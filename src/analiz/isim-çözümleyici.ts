import type {
  Program,
  Bildirim,
  İfade,
  Parametre,
  Blok,
  YapıBildirimi,
  SeçenekBildirimi,
  Tipİfadesi,
  AdYolu,
  KullanAdı,
} from "../ast/düğümler.ts";
import type { Tanı } from "../tanılama/tanı.ts";
import { Kapsam } from "./kapsam.ts";
import type { Sembol } from "./kapsam.ts";
import { yerleşikler } from "../standart/yerleşikler.ts";
import { posix } from "node:path";
import { kaynakOluştur } from "../kaynak/kaynak.ts";
import type { KaynakAralığı } from "../kaynak/konum.ts";
import { sözcüklereAyır } from "../sözcük/çözümleyici.ts";
import { Tanımlayıcı } from "../sözcük/tokenlar.ts";
import type { DeğerDışaAktarımı, ModülBağlamı } from "./modül-bağları.ts";
import type { Tip, TipSembolü } from "./tipler.ts";

export interface SeçenekErişimi {
  readonly tip: TipSembolü;
  readonly üye: KullanAdı;
}

export interface İsimÇözümlemeSonucu {
  readonly tanılar: readonly Tanı[];
  readonly bağlar: ReadonlyMap<İfade, Sembol>;
  readonly bildirimSembolleri: ReadonlyMap<Bildirim | Parametre, Sembol>;
  readonly tipBildirimleri: ReadonlyMap<string, TipSembolü>;
  readonly kendiTipleri: ReadonlyMap<YapıBildirimi | SeçenekBildirimi, TipSembolü>;
  readonly tipBağları: ReadonlyMap<Tipİfadesi | İfade, TipSembolü>;
  readonly yapıAlanları: ReadonlyMap<TipSembolü, ReadonlyMap<string, Tip>>;
  readonly seçenekErişimleri: ReadonlyMap<İfade, SeçenekErişimi>;
  readonly içeAktarımlar: ReadonlyMap<Sembol, DeğerDışaAktarımı>;
  readonly seçiciBağlar: ReadonlyMap<KullanAdı, Sembol>;
  readonly engellenenAdlar: ReadonlySet<string>;
}

export function isimleriÇöz(
  program: Program,
  yol = "<kaynak>",
  modüller?: ModülBağlamı,
): İsimÇözümlemeSonucu {
  const tanılar: Tanı[] = [];
  const bağlar = new Map<İfade, Sembol>();
  const seçenekErişimleri = new Map<İfade, SeçenekErişimi>();
  const tipBağları = new Map<Tipİfadesi | İfade, TipSembolü>();
  const yapıAlanları = new Map<TipSembolü, ReadonlyMap<string, Tip>>();
  const içeAktarımlar = new Map<Sembol, DeğerDışaAktarımı>();
  const seçiciBağlar = new Map<KullanAdı, Sembol>();
  const engellenenAdlar = new Set<string>();
  const bildirimSembolleri = new Map<Bildirim | Parametre, Sembol>();
  const programKapsamı = new Kapsam();
  const tipBildirimleri = new Map<string, TipSembolü>();
  const kendiTipleri = new Map<YapıBildirimi | SeçenekBildirimi, TipSembolü>();
  for (const işlev of yerleşikler) programKapsamı.ekle({ tür: "yerleşik", ad: işlev.ad, işlev });

  function ekle(kapsam: Kapsam, sembol: Exclude<Sembol, { tür: "yerleşik" | "modül" }>): void {
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
    else if (!engellenenAdlar.has(ad))
      tanılar.push({
        kod: "ATA3001",
        seviye: "hata",
        yol,
        mesaj: `Tanımlanmamış isim: '${ad}'.`,
        aralık: ifade.aralık,
      });
  }

  function hata(kod: Tanı["kod"], mesaj: string, aralık: KaynakAralığı): void {
    tanılar.push({ kod, seviye: "hata", yol, mesaj, aralık });
  }

  function aktar(aktarım: DeğerDışaAktarımı): void {
    içeAktarımlar.set(aktarım.sembol, aktarım);
  }

  const adAlanları = new Set<string>();
  const seçilenler = new Set<Sembol>();
  const seçilenTipler = new Set<TipSembolü>();
  for (const kenar of modüller?.bağımlılıklar ?? []) {
    const bildirim = kenar.bildirim;
    const katalog = modüller?.kataloglar.get(kenar.hedefYol);
    if (!katalog) throw new Error("Dependency export kataloğu bulunamadı.");
    for (const [tip, alanlar] of katalog.yapıAlanları) yapıAlanları.set(tip, alanlar);
    if (bildirim.biçim.tür === "namespace") {
      const aralık = bildirim.biçim.takmaAd?.aralık ?? bildirim.yolAralığı;
      if (adAlanları.has(kenar.hedefYol)) {
        hata("ATA6007", `'${bildirim.yol}' modülü için ad alanı zaten bağlı.`, aralık);
        continue;
      }
      adAlanları.add(kenar.hedefYol);
      const ad = bildirim.biçim.takmaAd?.ad ?? posix.basename(posix.normalize(bildirim.yol));
      if (!bildirim.biçim.takmaAd) {
        const sözcükler = sözcüklereAyır(kaynakOluştur(yol, ad));
        const tek = sözcükler.tokenlar[0];
        if (
          sözcükler.tanılar.length ||
          sözcükler.tokenlar.length !== 1 ||
          tek?.tokenType !== Tanımlayıcı ||
          tek.image !== ad
        ) {
          hata(
            "ATA6005",
            `'${ad}' geçerli bir modül ad alanı değildir; açık bir takma ad kullanın.`,
            aralık,
          );
          continue;
        }
      }
      if (!programKapsamı.ekle({ tür: "modül", ad, aralık, bildirim, katalog }))
        hata("ATA3002", `Aynı isim bu kapsamda zaten tanımlı: '${ad}'.`, aralık);
      if (tipBildirimleri.has(ad))
        hata("ATA3005", `Tip adı modül ad alanıyla çakışıyor: '${ad}'.`, aralık);
    } else {
      for (const seçilen of bildirim.biçim.adlar) {
        const aktarım = katalog.değerler.get(seçilen.ad);
        const tip = katalog.tipler.get(seçilen.ad);
        if (!aktarım && !tip) {
          engellenenAdlar.add(seçilen.ad);
          hata(
            "ATA6004",
            `'${bildirim.yol}' modülünde erişilebilir '${seçilen.ad}' adı bulunamadı.`,
            seçilen.aralık,
          );
          continue;
        }
        if ((aktarım && seçilenler.has(aktarım.sembol)) || (tip && seçilenTipler.has(tip))) {
          hata(
            "ATA6007",
            `'${bildirim.yol}' modülünün '${seçilen.ad}' adı zaten seçici olarak bağlı.`,
            seçilen.aralık,
          );
          continue;
        }
        if (aktarım) {
          seçilenler.add(aktarım.sembol);
          aktar(aktarım);
          seçiciBağlar.set(seçilen, aktarım.sembol);
          if (!programKapsamı.ekle(aktarım.sembol))
            hata(
              "ATA3002",
              `Aynı isim bu kapsamda zaten tanımlı: '${seçilen.ad}'.`,
              seçilen.aralık,
            );
        }
        if (tip) {
          seçilenTipler.add(tip);
          if (programKapsamı.bul(seçilen.ad)?.tür === "modül")
            hata(
              "ATA3005",
              `Tip adı modül ad alanıyla çakışıyor: '${seçilen.ad}'.`,
              seçilen.aralık,
            );
          if (tipBildirimleri.has(seçilen.ad))
            hata("ATA3005", `Yinelenen tip adı: '${seçilen.ad}'.`, seçilen.aralık);
          else tipBildirimleri.set(seçilen.ad, tip);
        }
      }
    }
  }

  function tipYoluÇöz(parçalar: AdYolu, kapsam: Kapsam): TipSembolü | undefined {
    const [ilk, üye] = parçalar;
    if (!üye) {
      const tip = tipBildirimleri.get(ilk.ad);
      if (!tip && !engellenenAdlar.has(ilk.ad))
        hata("ATA3004", `Tanımlanmamış tip: '${ilk.ad}'.`, ilk.aralık);
      return tip;
    }
    const namespace = kapsam.bul(ilk.ad);
    if (namespace?.tür !== "modül") {
      hata("ATA3004", `'${ilk.ad}' bu kapsamda bir modül ad alanı değildir.`, ilk.aralık);
      return undefined;
    }
    if (parçalar.length !== 2) {
      const fazla = parçalar[2];
      if (fazla) hata("ATA4025", "Bu nitelikli tip yolu desteklenmiyor.", fazla.aralık);
      return undefined;
    }
    const tip = namespace.katalog.tipler.get(üye.ad);
    if (!tip)
      hata(
        "ATA6004",
        `'${ilk.ad}' modülünde erişilebilir '${üye.ad}' tipi bulunamadı.`,
        üye.aralık,
      );
    return tip;
  }

  function tipÇöz(ifade: Tipİfadesi, kapsam: Kapsam): void {
    if (ifade.tür === "liste-tipi") tipÇöz(ifade.eleman, kapsam);
    else if (ifade.tür === "isteğe-bağlı-tip") tipÇöz(ifade.temel, kapsam);
    else if (ifade.tür === "adlandırılmış-tip" || ifade.tür === "nitelikli-tip") {
      const tip = tipYoluÇöz(
        ifade.tür === "nitelikli-tip" ? ifade.parçalar : [{ ad: ifade.ad, aralık: ifade.aralık }],
        kapsam,
      );
      if (tip) tipBağları.set(ifade, tip);
    }
  }

  function seçenekÇöz(ifade: İfade, tipYolu: AdYolu, üye: KullanAdı, kapsam: Kapsam): void {
    const tip = tipYoluÇöz(tipYolu, kapsam);
    if (tip) seçenekErişimleri.set(ifade, { tip, üye });
  }

  function ifadeÇöz(ifade: İfade, kapsam: Kapsam): void {
    switch (ifade.tür) {
      case "nitelikli-ad": {
        const [ilk, üye] = ifade.parçalar;
        const sembol = kapsam.bul(ilk.ad);
        if (sembol?.tür === "modül" && ifade.parçalar.length === 3) {
          const varyant = ifade.parçalar[2];
          if (!sembol.katalog.tipler.has(üye.ad) && sembol.katalog.değerler.has(üye.ad)) {
            if (varyant) hata("ATA4025", "Değer üzerinde '::' kullanılamaz.", varyant.aralık);
          } else if (varyant) seçenekÇöz(ifade, [ilk, üye], varyant, kapsam);
        } else if (sembol?.tür === "modül") {
          const aktarım = sembol.katalog.değerler.get(üye.ad);
          if (!aktarım) {
            hata(
              "ATA6004",
              `'${sembol.ad}' modülünde erişilebilir '${üye.ad}' adı bulunamadı.`,
              üye.aralık,
            );
          } else if (ifade.parçalar.length !== 2) {
            const fazla = ifade.parçalar[2];
            if (fazla) hata("ATA4025", "Değer üzerinde '::' kullanılamaz.", fazla.aralık);
          } else {
            aktar(aktarım);
            bağlar.set(ifade, aktarım.sembol);
          }
        } else if (sembol && programKapsamı.bul(ilk.ad)?.tür === "modül") {
          hata("ATA4025", `'${ilk.ad}' bu kapsamda bir modül ad alanı değildir.`, ilk.aralık);
        } else if (engellenenAdlar.has(ilk.ad)) {
          break;
        } else if (ifade.parçalar.length !== 2) {
          const fazla = ifade.parçalar[2];
          if (fazla) hata("ATA4025", "Bu nitelikli ad yolu desteklenmiyor.", fazla.aralık);
        } else {
          seçenekÇöz(ifade, [ilk], üye, kapsam);
        }
        break;
      }
      case "yapı-oluşturma": {
        const tip = tipYoluÇöz(ifade.yapıYolu, kapsam);
        if (tip) tipBağları.set(ifade, tip);
        ifade.alanlar.forEach((alan) => ifadeÇöz(alan.değer, kapsam));
        break;
      }
      case "seçenek-değeri":
        seçenekÇöz(
          ifade,
          [{ ad: ifade.seçenekAdı, aralık: ifade.aralık }],
          { ad: ifade.üyeAdı, aralık: ifade.aralık },
          kapsam,
        );
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
        for (const alan of bildirim.alanlar) tipÇöz(alan.tip, kapsam);
        break;
      case "seçenek":
        break;
      case "eşleştir":
        ifadeÇöz(bildirim.hedef, kapsam);
        for (const kol of bildirim.kollar) {
          if (kol.desen.tür !== "diğer") ifadeÇöz(kol.desen, kapsam);
          blokÇöz(kol.blok, new Kapsam(kapsam));
        }
        break;
      case "sabit":
      case "değişken":
        if (bildirim.açıkTip) tipÇöz(bildirim.açıkTip, kapsam);
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
        tipÇöz(bildirim.dönüşTipi, programKapsamı);
        for (const parametre of bildirim.parametreler) tipÇöz(parametre.tip, programKapsamı);
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
    if (bildirim.tür === "yapı" || bildirim.tür === "seçenek") {
      if (tipBildirimleri.has(bildirim.ad))
        tanılar.push({
          kod: "ATA3005",
          seviye: "hata",
          yol,
          aralık: bildirim.aralık,
          mesaj: `Yinelenen tip adı: '${bildirim.ad}'.`,
        });
      else {
        const sembol = { modülYolu: yol, bildirim };
        kendiTipleri.set(bildirim, sembol);
        tipBildirimleri.set(bildirim.ad, sembol);
      }
      if (programKapsamı.bul(bildirim.ad)?.tür === "modül")
        hata("ATA3005", `Tip adı modül ad alanıyla çakışıyor: '${bildirim.ad}'.`, bildirim.aralık);
    }
    if (bildirim.tür === "işlev")
      ekle(programKapsamı, { tür: "işlev", ad: bildirim.ad, bildirim, aralık: bildirim.aralık });
  }
  for (const bildirim of program.bildirimler) bildirimÇöz(bildirim, programKapsamı);
  return {
    tanılar,
    bağlar,
    bildirimSembolleri,
    tipBildirimleri,
    kendiTipleri,
    tipBağları,
    yapıAlanları,
    seçenekErişimleri,
    içeAktarımlar,
    seçiciBağlar,
    engellenenAdlar,
  };
}
