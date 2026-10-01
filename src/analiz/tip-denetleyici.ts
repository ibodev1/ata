import type { Program, Bildirim, Blok, İfade, Tipİfadesi, İkiliİşleç } from "../ast/düğümler.ts";
import type { KaynakAralığı } from "../kaynak/konum.ts";
import type { Tanı } from "../tanılama/tanı.ts";
import type { Sembol } from "./kapsam.ts";
import type { İsimÇözümlemeSonucu } from "./isim-çözümleyici.ts";
import type { Tip, İşlevİmzası } from "./tipler.ts";
import { atanabilir, tipEşit, tipiGöster } from "./tipler.ts";
import {
  argümanSayısıUygun,
  parametreKabulEder,
  parametreyiGöster,
  yerleşikDönüşTipi,
} from "../standart/yerleşikler.ts";

const bilinmeyen: Tip = { tür: "bilinmeyen" };
const sayı: Tip = { tür: "sayı" };
const mantık: Tip = { tür: "mantık" };

function bağlıAd(ifade: İfade): boolean {
  return ifade.tür === "tanımlayıcı" || ifade.tür === "nitelikli-ad";
}

type Daraltmalar = ReadonlyMap<Sembol, Tip>;
interface KoşulBilgisi {
  readonly tip: Tip;
  readonly doğru: Daraltmalar;
  readonly yanlış: Daraltmalar;
}

function ortakDaraltmalar(sol: Daraltmalar, sağ: Daraltmalar): Map<Sembol, Tip> {
  const ortak = new Map<Sembol, Tip>();
  for (const [sembol, tip] of sol) {
    const diğer = sağ.get(sembol);
    if (diğer && tipEşit(tip, diğer)) ortak.set(sembol, tip);
  }
  return ortak;
}

function daraltmaEkle(hedef: Map<Sembol, Tip>, sembol: Sembol, tip: Tip): void {
  const mevcut = hedef.get(sembol);
  if (mevcut && !tipEşit(mevcut, tip)) hedef.delete(sembol);
  else hedef.set(sembol, tip);
}

export interface TipDenetlemeSonucu {
  readonly tanılar: readonly Tanı[];
  readonly ifadeTipleri: ReadonlyMap<İfade, Tip>;
  readonly sembolTipleri: ReadonlyMap<Sembol, Tip>;
  readonly işlevİmzaları: ReadonlyMap<Sembol, İşlevİmzası>;
  readonly yapıAlanları: ReadonlyMap<string, ReadonlyMap<string, Tip>>;
}

export function tipleriDenetle(
  program: Program,
  isimler: İsimÇözümlemeSonucu,
  yol = "<kaynak>",
): TipDenetlemeSonucu {
  const tanılar: Tanı[] = [];
  const ifadeTipleri = new Map<İfade, Tip>();
  const sembolTipleri = new Map<Sembol, Tip>();
  const işlevİmzaları = new Map<Sembol, İşlevİmzası>();
  for (const [sembol, aktarım] of isimler.içeAktarımlar) {
    if (isimler.engellenenSemboller.has(sembol)) continue;
    if (aktarım.tür === "sabit") sembolTipleri.set(sembol, aktarım.tip);
    else işlevİmzaları.set(sembol, aktarım.imza);
  }
  const yapıAlanları = new Map<string, ReadonlyMap<string, Tip>>();
  const globalDeğişkenler = new Set<Sembol>();
  for (const bildirim of program.bildirimler) {
    if (bildirim.tür === "değişken") {
      const sembol = isimler.bildirimSembolleri.get(bildirim);
      if (sembol) globalDeğişkenler.add(sembol);
    }
  }
  let akış = new Map<Sembol, Tip>();
  let bozulanlar = new Set<Sembol>();

  function akışta<T>(daraltmalar: Daraltmalar, denetle: () => T) {
    const önceki = akış;
    const öncekiBozulanlar = bozulanlar;
    akış = new Map(daraltmalar);
    bozulanlar = new Set();
    try {
      const sonuç = denetle();
      return { sonuç, bozulanlar };
    } finally {
      akış = önceki;
      bozulanlar = öncekiBozulanlar;
    }
  }

  function daraltmayıBoz(sembol: Sembol): void {
    akış.delete(sembol);
    bozulanlar.add(sembol);
  }

  function bozulmalarıUygula(semboller: ReadonlySet<Sembol>): void {
    for (const sembol of semboller) daraltmayıBoz(sembol);
  }

  function globalDaraltmalarıBoz(): void {
    for (const sembol of globalDeğişkenler) {
      if (sembolTipleri.get(sembol)?.tür === "isteğe-bağlı") daraltmayıBoz(sembol);
    }
  }

  // Döngüde yazılabilen bağlar ilk yinelemeden önce temel tipe döner.
  // Böylece tek gövde denetimi sonraki yinelemeler için de güvenlidir.
  function döngüYazmalarınıBoz(düğüm: Bildirim | İfade): void {
    switch (düğüm.tür) {
      case "atama": {
        const sembol = isimler.bağlar.get(düğüm);
        if (sembol?.tür === "değer" && sembol.değiştirilebilir) daraltmayıBoz(sembol);
        döngüYazmalarınıBoz(düğüm.değer);
        break;
      }
      case "çağrı":
        if (isimler.bağlar.get(düğüm.çağrılan)?.tür === "işlev") globalDaraltmalarıBoz();
        döngüYazmalarınıBoz(düğüm.çağrılan);
        düğüm.argümanlar.forEach(döngüYazmalarınıBoz);
        break;
      case "blok":
        düğüm.bildirimler.forEach(döngüYazmalarınıBoz);
        break;
      case "koşul":
        döngüYazmalarınıBoz(düğüm.koşul);
        döngüYazmalarınıBoz(düğüm.doğruysa);
        if (düğüm.değilse) döngüYazmalarınıBoz(düğüm.değilse);
        break;
      case "eşleştir":
        döngüYazmalarınıBoz(düğüm.hedef);
        for (const kol of düğüm.kollar) döngüYazmalarınıBoz(kol.blok);
        break;
      case "iken":
        döngüYazmalarınıBoz(düğüm.koşul);
        döngüYazmalarınıBoz(düğüm.blok);
        break;
      case "liste-döngüsü":
        döngüYazmalarınıBoz(düğüm.koleksiyon);
        döngüYazmalarınıBoz(düğüm.blok);
        break;
      case "sabit":
      case "değişken":
        döngüYazmalarınıBoz(düğüm.başlangıç);
        break;
      case "yazdır":
      case "ifade-bildirimi":
      case "tekli":
        döngüYazmalarınıBoz(düğüm.ifade);
        break;
      case "döndür":
        if (düğüm.ifade) döngüYazmalarınıBoz(düğüm.ifade);
        break;
      case "ikili":
        döngüYazmalarınıBoz(düğüm.sol);
        döngüYazmalarınıBoz(düğüm.sağ);
        break;
      case "liste":
        düğüm.elemanlar.forEach(döngüYazmalarınıBoz);
        break;
      case "yazı":
        for (const parça of düğüm.parçalar)
          if (parça.tür === "ifade") döngüYazmalarınıBoz(parça.ifade);
        break;
      case "yapı-oluşturma":
        for (const alan of düğüm.alanlar) döngüYazmalarınıBoz(alan.değer);
        break;
      case "alan-erişim":
        döngüYazmalarınıBoz(düğüm.hedef);
        break;
      case "indeks":
        döngüYazmalarınıBoz(düğüm.hedef);
        döngüYazmalarınıBoz(düğüm.indeks);
        break;
      case "işlev":
      case "yapı":
      case "seçenek":
      case "seçenek-değeri":
      case "nitelikli-ad":
      case "tanımlayıcı":
      case "sayı":
      case "mantık":
      case "yok":
        break;
    }
  }

  function hata(kod: Tanı["kod"], mesaj: string, aralık: KaynakAralığı): void {
    tanılar.push({ kod, seviye: "hata", mesaj, aralık, yol });
  }

  function değerTipi(tip: Tip, aralık: KaynakAralığı): Tip {
    if (tip.tür !== "hiç") return tip;
    hata("ATA4034", "'hiç' yalnızca işlev dönüş tipi olarak kullanılabilir.", aralık);
    return bilinmeyen;
  }

  // Dönüş istisnası bu düğüme aittir; bileşik tiplerin içi değer bağlamında çözülür.
  function tipÇöz(ifade: Tipİfadesi, bağlam: "değer" | "işlev-dönüşü" = "değer"): Tip {
    switch (ifade.tür) {
      case "adlandırılmış-tip": {
        const bildirim = isimler.tipBildirimleri.get(ifade.ad);
        if (bildirim) return { tür: bildirim.tür, ad: ifade.ad };
        if (isimler.engellenenAdlar.has(ifade.ad)) return bilinmeyen;
        hata("ATA3004", `Tanımlanmamış tip: '${ifade.ad}'.`, ifade.aralık);
        return bilinmeyen;
      }
      case "temel-tip": {
        const tip: Tip = { tür: ifade.ad };
        return bağlam === "işlev-dönüşü" ? tip : değerTipi(tip, ifade.aralık);
      }
      case "liste-tipi": {
        const eleman = tipÇöz(ifade.eleman);
        return eleman.tür === "bilinmeyen" ? bilinmeyen : { tür: "liste", eleman };
      }
      case "isteğe-bağlı-tip": {
        const temel = tipÇöz(ifade.temel);
        if (temel.tür === "isteğe-bağlı") {
          hata("ATA4014", "İç içe isteğe bağlı tipler desteklenmiyor.", ifade.aralık);
          return bilinmeyen;
        }
        return temel.tür === "bilinmeyen" ? bilinmeyen : { tür: "isteğe-bağlı", temel };
      }
    }
  }

  function uyumDenetle(
    kaynak: Tip,
    hedef: Tip,
    aralık: KaynakAralığı,
    kod: Tanı["kod"] = "ATA4001",
  ): void {
    if (!atanabilir(kaynak, hedef))
      hata(
        kod,
        `Tip uyuşmazlığı: '${tipiGöster(kaynak)}', '${tipiGöster(hedef)}' tipine atanamaz.`,
        aralık,
      );
  }

  function ikiliTip(işleç: İkiliİşleç, sol: Tip, sağ: Tip, aralık: KaynakAralığı): Tip {
    if (sol.tür === "bilinmeyen" || sağ.tür === "bilinmeyen") return bilinmeyen;
    if (işleç === "==" || işleç === "!=") {
      const temelSol = sol.tür === "isteğe-bağlı" ? sol.temel : sol;
      const temelSağ = sağ.tür === "isteğe-bağlı" ? sağ.temel : sağ;
      const yokKarşılaştırması =
        (sol.tür === "yok" && sağ.tür === "isteğe-bağlı") ||
        (sağ.tür === "yok" && sol.tür === "isteğe-bağlı");
      if (
        yokKarşılaştırması ||
        (temelSol.tür !== "liste" &&
          temelSağ.tür !== "liste" &&
          temelSol.tür !== "yapı" &&
          temelSağ.tür !== "yapı" &&
          sol.tür !== "hiç" &&
          sağ.tür !== "hiç" &&
          (atanabilir(sol, sağ) || atanabilir(sağ, sol)))
      )
        return mantık;
    } else if (işleç === "ve" || işleç === "veya") {
      if (sol.tür === "mantık" && sağ.tür === "mantık") return mantık;
    } else if (["<", "<=", ">", ">="].includes(işleç)) {
      if (sol.tür === "sayı" && sağ.tür === "sayı") return mantık;
    } else if (işleç === "+" && sol.tür === "yazı" && sağ.tür === "yazı") {
      return sol;
    } else if (sol.tür === "sayı" && sağ.tür === "sayı") return sayı;
    hata(
      "ATA4011",
      `'${işleç}' işleci '${tipiGöster(sol)}' ve '${tipiGöster(sağ)}' tipleriyle kullanılamaz.`,
      aralık,
    );
    return bilinmeyen;
  }

  function ifadeDenetle(ifade: İfade, beklenen?: Tip): Tip {
    const mantıksal =
      (ifade.tür === "ikili" && (ifade.işleç === "ve" || ifade.işleç === "veya")) ||
      (ifade.tür === "tekli" && ifade.işleç === "değil");
    const tip = mantıksal ? koşuluÇözümle(ifade).tip : ifadeTipi(ifade, beklenen);
    ifadeTipleri.set(ifade, tip);
    return tip;
  }

  function ifadeTipi(ifade: İfade, beklenen?: Tip): Tip {
    switch (ifade.tür) {
      case "nitelikli-ad": {
        const seçenek = isimler.seçenekErişimleri.get(ifade);
        if (seçenek) return ifadeTipi(seçenek);
        return sembolDeğeri(ifade);
      }
      case "seçenek-değeri": {
        const bildirim = isimler.tipBildirimleri.get(ifade.seçenekAdı);
        if (!bildirim) {
          hata("ATA3004", `Tanımlanmamış tip: '${ifade.seçenekAdı}'.`, ifade.aralık);
          return bilinmeyen;
        }
        if (bildirim.tür !== "seçenek") {
          hata(
            "ATA4025",
            `'::' bir seçenek tipi gerektirir; '${bildirim.ad}' verildi.`,
            ifade.aralık,
          );
          return bilinmeyen;
        }
        if (!bildirim.üyeler.some((üye) => üye.ad === ifade.üyeAdı)) {
          hata(
            "ATA4026",
            `'${bildirim.ad}' seçeneğinde '${ifade.üyeAdı}' üyesi bulunamadı.`,
            ifade.aralık,
          );
          return bilinmeyen;
        }
        return { tür: "seçenek", ad: bildirim.ad };
      }
      case "yapı-oluşturma": {
        const alanlar = yapıAlanları.get(ifade.yapıAdı);
        if (!alanlar) {
          if (isimler.tipBildirimleri.has(ifade.yapıAdı))
            hata(
              "ATA4020",
              `Yapı oluşturma bir yapı tipi gerektirir; '${ifade.yapıAdı}' verildi.`,
              ifade.aralık,
            );
          else hata("ATA3004", `Tanımlanmamış tip: '${ifade.yapıAdı}'.`, ifade.aralık);
        }
        const verilenler = new Set<string>();
        for (const alan of ifade.alanlar) {
          if (verilenler.has(alan.ad))
            hata("ATA4018", `Yinelenen alan: '${alan.ad}'.`, alan.aralık);
          verilenler.add(alan.ad);
          const hedef = alanlar?.get(alan.ad);
          const tip = ifadeDenetle(alan.değer, hedef);
          if (hedef) uyumDenetle(tip, hedef, alan.değer.aralık);
          else if (alanlar)
            hata(
              "ATA4019",
              `'${ifade.yapıAdı}' yapısında '${alan.ad}' alanı bulunamadı.`,
              alan.aralık,
            );
        }
        for (const ad of alanlar?.keys() ?? []) {
          if (!verilenler.has(ad))
            hata("ATA4017", `'${ifade.yapıAdı}' yapısının '${ad}' alanı eksik.`, ifade.aralık);
        }
        return alanlar ? { tür: "yapı", ad: ifade.yapıAdı } : bilinmeyen;
      }
      case "alan-erişim": {
        const hedef = ifadeDenetle(ifade.hedef);
        if (hedef.tür === "bilinmeyen") return bilinmeyen;
        if (hedef.tür !== "yapı") {
          hata(
            "ATA4020",
            `Alan erişimi yapı gerektirir; '${tipiGöster(hedef)}' verildi.`,
            ifade.aralık,
          );
          return bilinmeyen;
        }
        const tip = yapıAlanları.get(hedef.ad)?.get(ifade.alan);
        if (tip) return tip;
        hata("ATA4019", `'${hedef.ad}' yapısında '${ifade.alan}' alanı bulunamadı.`, ifade.aralık);
        return bilinmeyen;
      }
      case "indeks": {
        const hedef = ifadeDenetle(ifade.hedef);
        const indeks = ifadeDenetle(ifade.indeks);
        if (indeks.tür !== "sayı" && indeks.tür !== "bilinmeyen")
          hata(
            "ATA4022",
            `Liste indeksi 'sayı' olmalıdır; '${tipiGöster(indeks)}' verildi.`,
            ifade.indeks.aralık,
          );
        if (hedef.tür === "liste") return hedef.eleman;
        if (hedef.tür !== "bilinmeyen")
          hata(
            "ATA4021",
            `İndeksleme 'liste<T>' gerektirir; '${tipiGöster(hedef)}' verildi.`,
            ifade.hedef.aralık,
          );
        return bilinmeyen;
      }
      case "sayı":
        return sayı;
      case "mantık":
        return mantık;
      case "yazı":
        for (const parça of ifade.parçalar) {
          if (parça.tür === "ifade" && ifadeDenetle(parça.ifade).tür === "hiç")
            hata(
              "ATA4016",
              "'hiç' türündeki ifade yazı içine yerleştirilemez.",
              parça.ifade.aralık,
            );
        }
        return { tür: "yazı" };
      case "yok":
        return { tür: ifade.tür };
      case "tanımlayıcı": {
        return sembolDeğeri(ifade);
      }
      case "tekli": {
        const tip = ifadeDenetle(ifade.ifade);
        const hedef = ifade.işleç === "-" ? sayı : mantık;
        if (tip.tür === "bilinmeyen") return bilinmeyen;
        if (tipEşit(tip, hedef)) return hedef;
        hata(
          "ATA4011",
          `'${ifade.işleç}' işleci '${tipiGöster(hedef)}' gerektirir; '${tipiGöster(tip)}' verildi.`,
          ifade.aralık,
        );
        return bilinmeyen;
      }
      case "ikili": {
        let sol = ifadeDenetle(ifade.sol);
        let sağ = ifadeDenetle(ifade.sağ);
        // Önceden daraltılmış optional adın yeniden yok testi, temel tipe göre geçerlidir.
        if (ifade.işleç === "==" || ifade.işleç === "!=") {
          if (bağlıAd(ifade.sol) && ifade.sağ.tür === "yok")
            sol = karşılaştırmaTipi(ifade.sol, sol);
          if (bağlıAd(ifade.sağ) && ifade.sol.tür === "yok")
            sağ = karşılaştırmaTipi(ifade.sağ, sağ);
        }
        return ikiliTip(ifade.işleç, sol, sağ, ifade.aralık);
      }
      case "liste": {
        const hedef = beklenen?.tür === "isteğe-bağlı" ? beklenen.temel : beklenen;
        const elemanHedefi =
          hedef?.tür === "liste"
            ? hedef.eleman
            : hedef?.tür === "bilinmeyen"
              ? bilinmeyen
              : undefined;
        const tipler = ifade.elemanlar.map((eleman) =>
          değerTipi(ifadeDenetle(eleman, elemanHedefi), eleman.aralık),
        );
        const elemanTipi = elemanHedefi ?? tipler.find((tip) => tip.tür !== "bilinmeyen");
        if (!elemanTipi || elemanTipi.tür === "yok") {
          if (!tipler.some((tip) => tip.tür === "bilinmeyen"))
            hata(
              "ATA4008",
              "Liste eleman tipi çıkarılamadı; açık bir liste tipi belirtin.",
              ifade.aralık,
            );
          return bilinmeyen;
        }
        let uyumlu = true;
        tipler.forEach((tip, sıra) => {
          if (!atanabilir(tip, elemanTipi)) {
            uyumDenetle(tip, elemanTipi, ifade.elemanlar[sıra]!.aralık);
            uyumlu = false;
          }
        });
        return uyumlu ? { tür: "liste", eleman: elemanTipi } : bilinmeyen;
      }
      case "atama": {
        const sembol = isimler.bağlar.get(ifade);
        const hedef = sembol ? (sembolTipleri.get(sembol) ?? bilinmeyen) : bilinmeyen;
        const sağ = ifadeDenetle(ifade.değer, hedef);
        if (sembol && (sembol.tür !== "değer" || !sembol.değiştirilebilir))
          hata("ATA4003", `'${sembol.ad}' değiştirilemez; bu ada atama yapılamaz.`, ifade.aralık);
        if (ifade.işleç === "=") uyumDenetle(sağ, hedef, ifade.değer.aralık);
        else {
          const işleç = ifade.işleç.slice(0, -1);
          // Atama işleçlerinin karşılıkları yalnızca bu beş matematiksel işleçtir.
          if (işleç === "+" || işleç === "-" || işleç === "*" || işleç === "/" || işleç === "%")
            uyumDenetle(ikiliTip(işleç, hedef, sağ, ifade.aralık), hedef, ifade.aralık);
        }
        if (sembol?.tür === "değer" && sembol.değiştirilebilir) daraltmayıBoz(sembol);
        return hedef;
      }
      case "çağrı": {
        const sembol = bağlıAd(ifade.çağrılan) ? isimler.bağlar.get(ifade.çağrılan) : undefined;
        if (sembol?.tür === "yerleşik") {
          const işlev = sembol.işlev;
          if (!argümanSayısıUygun(işlev, ifade.argümanlar.length)) {
            const enAz = işlev.enAzArgüman ?? işlev.parametreler.length;
            const beklenenSayı =
              enAz === işlev.parametreler.length
                ? String(enAz)
                : `${enAz} veya ${işlev.parametreler.length}`;
            hata(
              "ATA4004",
              `'${işlev.ad}' işlevi ${beklenenSayı} argüman bekliyor; ${ifade.argümanlar.length} verildi.`,
              ifade.aralık,
            );
          }
          const argümanTipleri = ifade.argümanlar.map((argüman, sıra) => {
            const kural = işlev.parametreler[sıra];
            // Eleman tipi uzunluk/gösterim için önemsizdir; yalnızca boş literal bağlam alır.
            const bağlam: Tip | undefined =
              (kural === "uzunluğu-olan" || kural === "gösterilebilir") &&
              argüman.tür === "liste" &&
              argüman.elemanlar.length === 0
                ? { tür: "liste", eleman: bilinmeyen }
                : undefined;
            const verilen = ifadeDenetle(argüman, bağlam);
            if (kural && !parametreKabulEder(kural, verilen))
              hata(
                "ATA4005",
                `'${işlev.ad}' işlevinin ${sıra + 1}. argümanı '${parametreyiGöster(kural)}' olmalıdır; '${tipiGöster(verilen)}' verildi.`,
                argüman.aralık,
              );
            return verilen;
          });
          return yerleşikDönüşTipi(işlev, argümanTipleri);
        }
        const imza = sembol?.tür === "işlev" ? işlevİmzaları.get(sembol) : undefined;
        if (!imza) {
          const hedef = ifadeDenetle(ifade.çağrılan);
          ifade.argümanlar.forEach((argüman) => ifadeDenetle(argüman));
          if (hedef.tür !== "bilinmeyen")
            hata("ATA4009", "Çağrı hedefi bir işlev olmalıdır.", ifade.çağrılan.aralık);
          return bilinmeyen;
        }
        if (ifade.argümanlar.length !== imza.parametreler.length)
          hata(
            "ATA4004",
            `'${sembol!.ad}' işlevi ${imza.parametreler.length} argüman bekliyor; ${ifade.argümanlar.length} verildi.`,
            ifade.aralık,
          );
        ifade.argümanlar.forEach((argüman, sıra) => {
          const hedef = imza.parametreler[sıra];
          const verilen = ifadeDenetle(argüman, hedef);
          if (hedef) uyumDenetle(verilen, hedef, argüman.aralık, "ATA4005");
        });
        globalDaraltmalarıBoz();
        return imza.dönüş;
      }
    }
  }

  function sembolDeğeri(ifade: İfade): Tip {
    const sembol = isimler.bağlar.get(ifade);
    if (!sembol || isimler.engellenenSemboller.has(sembol)) return bilinmeyen;
    if (sembol.tür === "modül") {
      hata(
        "ATA4035",
        `'${sembol.ad}' bir modül ad alanıdır; değer olarak kullanılamaz.`,
        ifade.aralık,
      );
      return bilinmeyen;
    }
    if (sembol.tür === "işlev" || sembol.tür === "yerleşik") {
      hata(
        "ATA4010",
        `İşlev '${sembol.ad}' yalnızca çağrı hedefi olarak kullanılabilir.`,
        ifade.aralık,
      );
      return bilinmeyen;
    }
    return akış.get(sembol) ?? sembolTipleri.get(sembol) ?? bilinmeyen;
  }

  function karşılaştırmaTipi(ifade: İfade, akışTipi: Tip): Tip {
    const sembol = isimler.bağlar.get(ifade);
    const temel = sembol ? sembolTipleri.get(sembol) : undefined;
    return temel?.tür === "isteğe-bağlı" ? temel : akışTipi;
  }

  function koşuluÇözümle(ifade: İfade): KoşulBilgisi {
    if (ifade.tür === "tekli" && ifade.işleç === "değil") {
      const iç = koşuluÇözümle(ifade.ifade);
      const tip = iç.tip.tür === "mantık" ? mantık : bilinmeyen;
      if (iç.tip.tür !== "mantık" && iç.tip.tür !== "bilinmeyen")
        hata(
          "ATA4011",
          `'değil' işleci 'mantık' gerektirir; '${tipiGöster(iç.tip)}' verildi.`,
          ifade.aralık,
        );
      ifadeTipleri.set(ifade, tip);
      return tip.tür === "mantık"
        ? { tip, doğru: iç.yanlış, yanlış: iç.doğru }
        : { tip, doğru: new Map(akış), yanlış: new Map(akış) };
    }
    if (ifade.tür === "ikili" && (ifade.işleç === "ve" || ifade.işleç === "veya")) {
      const önceki = new Map(akış);
      const sol = koşuluÇözümle(ifade.sol);
      const ve = ifade.işleç === "ve";
      const sağ = akışta(ve ? sol.doğru : sol.yanlış, () => koşuluÇözümle(ifade.sağ));
      bozulmalarıUygula(sağ.bozulanlar);
      const tip = ikiliTip(ifade.işleç, sol.tip, sağ.sonuç.tip, ifade.aralık);
      const doğru = ve ? sağ.sonuç.doğru : ortakDaraltmalar(sol.doğru, sağ.sonuç.doğru);
      const yanlış = ve ? ortakDaraltmalar(sol.yanlış, sağ.sonuç.yanlış) : sağ.sonuç.yanlış;
      akış = ortakDaraltmalar(önceki, ortakDaraltmalar(doğru, yanlış));
      ifadeTipleri.set(ifade, tip);
      return tip.tür === "mantık"
        ? { tip, doğru, yanlış }
        : { tip, doğru: new Map(akış), yanlış: new Map(akış) };
    }
    const tip = ifadeDenetle(ifade);
    const doğru = new Map(akış);
    const yanlış = new Map(akış);
    if (
      tip.tür === "mantık" &&
      ifade.tür === "ikili" &&
      (ifade.işleç === "==" || ifade.işleç === "!=")
    ) {
      const hedef =
        bağlıAd(ifade.sol) && ifade.sağ.tür === "yok"
          ? ifade.sol
          : bağlıAd(ifade.sağ) && ifade.sol.tür === "yok"
            ? ifade.sağ
            : undefined;
      const sembol = hedef ? isimler.bağlar.get(hedef) : undefined;
      const temel = sembol ? sembolTipleri.get(sembol) : undefined;
      if (sembol && temel?.tür === "isteğe-bağlı") {
        daraltmaEkle(doğru, sembol, ifade.işleç === "!=" ? temel.temel : { tür: "yok" });
        daraltmaEkle(yanlış, sembol, ifade.işleç === "!=" ? { tür: "yok" } : temel.temel);
      }
    }
    return { tip, doğru, yanlış };
  }

  function koşulDenetle(ifade: İfade): KoşulBilgisi {
    const bilgi = koşuluÇözümle(ifade);
    const tip = bilgi.tip;
    if (tip.tür !== "mantık" && tip.tür !== "bilinmeyen")
      hata("ATA4002", `Koşul 'mantık' olmalıdır; '${tipiGöster(tip)}' verildi.`, ifade.aralık);
    return bilgi;
  }

  function blokDenetle(blok: Blok, dönüş: Tip | null): boolean {
    let kesinDönüş = false;
    for (const bildirim of blok.bildirimler) {
      const döner = bildirimDenetle(bildirim, dönüş);
      kesinDönüş = kesinDönüş || döner;
    }
    return kesinDönüş;
  }

  function bildirimDenetle(bildirim: Bildirim, dönüş: Tip | null): boolean {
    switch (bildirim.tür) {
      case "yapı":
      case "seçenek":
        break;
      case "eşleştir": {
        const hedef = ifadeDenetle(bildirim.hedef);
        const seçenek = hedef.tür === "seçenek" ? isimler.tipBildirimleri.get(hedef.ad) : undefined;
        let geçerli = seçenek?.tür === "seçenek";
        if (hedef.tür !== "seçenek" && hedef.tür !== "bilinmeyen")
          hata(
            "ATA4027",
            `Eşleştir hedefi seçenek olmalıdır; '${tipiGöster(hedef)}' verildi.`,
            bildirim.hedef.aralık,
          );
        const kapsananlar = new Set<string>();
        let diğerSayısı = 0;
        for (const [sıra, kol] of bildirim.kollar.entries()) {
          if (kol.desen.tür === "diğer") {
            diğerSayısı++;
            if (diğerSayısı > 1) {
              hata(
                "ATA4031",
                "Eşleştirmede birden fazla 'diğer' kolu bulunamaz.",
                kol.desen.aralık,
              );
              geçerli = false;
            }
            if (sıra !== bildirim.kollar.length - 1) {
              hata("ATA4032", "'diğer' kolu son kol olmalıdır.", kol.desen.aralık);
              geçerli = false;
            }
            if (
              seçenek?.tür === "seçenek" &&
              seçenek.üyeler.every((üye) => kapsananlar.has(üye.ad))
            ) {
              hata("ATA4033", "'diğer' koluna hiçbir seçenek ulaşamaz.", kol.desen.aralık);
              geçerli = false;
            }
          } else {
            const tip = ifadeDenetle(kol.desen);
            if (tip.tür === "bilinmeyen") geçerli = false;
            if (tip.tür === "seçenek" && hedef.tür === "seçenek") {
              if (!tipEşit(tip, hedef)) {
                hata(
                  "ATA4028",
                  `Eşleştirme kolu '${tip.ad}' yerine '${hedef.ad}' seçeneğinden olmalıdır.`,
                  kol.desen.aralık,
                );
                geçerli = false;
              } else {
                if (kapsananlar.has(kol.desen.üyeAdı)) {
                  hata(
                    "ATA4029",
                    `Yinelenen eşleştirme kolu: '${kol.desen.seçenekAdı}::${kol.desen.üyeAdı}'.`,
                    kol.desen.aralık,
                  );
                  geçerli = false;
                }
                kapsananlar.add(kol.desen.üyeAdı);
              }
            }
          }
        }
        const eksik =
          seçenek?.tür === "seçenek"
            ? seçenek.üyeler.filter((üye) => !kapsananlar.has(üye.ad))
            : [];
        const tam = diğerSayısı > 0 || eksik.length === 0;
        if (seçenek?.tür === "seçenek" && !tam)
          hata(
            "ATA4030",
            `Eşleştirme bütün durumları kapsamıyor. Eksik: ${eksik.map((üye) => üye.ad).join(", ")}.`,
            bildirim.aralık,
          );
        const sonuçlar = bildirim.kollar.map((kol) =>
          akışta(akış, () => blokDenetle(kol.blok, dönüş)),
        );
        for (const sonuç of sonuçlar) bozulmalarıUygula(sonuç.bozulanlar);
        return geçerli && tam && sonuçlar.length > 0 && sonuçlar.every((sonuç) => sonuç.sonuç);
      }
      case "sabit":
      case "değişken": {
        const açık = bildirim.açıkTip ? tipÇöz(bildirim.açıkTip) : undefined;
        const başlangıç = ifadeDenetle(bildirim.başlangıç, açık);
        let tip = açık ?? değerTipi(başlangıç, bildirim.başlangıç.aralık);
        if (açık) uyumDenetle(başlangıç, açık, bildirim.başlangıç.aralık);
        else if (başlangıç.tür === "yok") {
          hata(
            "ATA4008",
            "'yok' değerinden tip çıkarılamadı; açık bir isteğe bağlı tip belirtin.",
            bildirim.aralık,
          );
          tip = bilinmeyen;
        }
        const sembol = isimler.bildirimSembolleri.get(bildirim);
        if (sembol) sembolTipleri.set(sembol, tip);
        break;
      }
      case "işlev": {
        const sembol = isimler.bildirimSembolleri.get(bildirim)!;
        const imza = işlevİmzaları.get(sembol)!;
        bildirim.parametreler.forEach((parametre, sıra) =>
          sembolTipleri.set(isimler.bildirimSembolleri.get(parametre)!, imza.parametreler[sıra]!),
        );
        const döner = akışta(new Map(), () => blokDenetle(bildirim.blok, imza.dönüş)).sonuç;
        if (imza.dönüş.tür !== "hiç" && imza.dönüş.tür !== "bilinmeyen" && !döner)
          hata(
            "ATA4007",
            `'${bildirim.ad}' işlevi bütün yollarda değer döndürmüyor.`,
            bildirim.aralık,
          );
        break;
      }
      case "blok": {
        const blok = akışta(akış, () => blokDenetle(bildirim, dönüş));
        bozulmalarıUygula(blok.bozulanlar);
        return blok.sonuç;
      }
      case "koşul": {
        const bilgi = koşulDenetle(bildirim.koşul);
        const doğru = akışta(bilgi.doğru, () => blokDenetle(bildirim.doğruysa, dönüş));
        const yanlış = akışta(bilgi.yanlış, () =>
          bildirim.değilse ? bildirimDenetle(bildirim.değilse, dönüş) : false,
        );
        bozulmalarıUygula(doğru.bozulanlar);
        bozulmalarıUygula(yanlış.bozulanlar);
        return doğru.sonuç && yanlış.sonuç;
      }
      case "iken": {
        döngüYazmalarınıBoz(bildirim);
        const bilgi = koşulDenetle(bildirim.koşul);
        const gövde = akışta(bilgi.doğru, () => blokDenetle(bildirim.blok, dönüş));
        bozulmalarıUygula(gövde.bozulanlar);
        break;
      }
      case "liste-döngüsü": {
        const liste = ifadeDenetle(bildirim.koleksiyon);
        if (liste.tür !== "liste" && liste.tür !== "bilinmeyen")
          hata(
            "ATA4012",
            `Liste döngüsü 'liste<T>' gerektirir; '${tipiGöster(liste)}' verildi.`,
            bildirim.koleksiyon.aralık,
          );
        sembolTipleri.set(
          isimler.bildirimSembolleri.get(bildirim)!,
          liste.tür === "liste" ? liste.eleman : bilinmeyen,
        );
        döngüYazmalarınıBoz(bildirim.blok);
        const gövde = akışta(akış, () => blokDenetle(bildirim.blok, dönüş));
        bozulmalarıUygula(gövde.bozulanlar);
        break;
      }
      case "yazdır": {
        const tip = ifadeDenetle(bildirim.ifade);
        if (tip.tür === "hiç")
          hata("ATA4015", "'hiç' türündeki ifade yazdırılamaz.", bildirim.ifade.aralık);
        break;
      }
      case "ifade-bildirimi":
        ifadeDenetle(bildirim.ifade);
        break;
      case "döndür": {
        const tip = bildirim.ifade ? ifadeDenetle(bildirim.ifade, dönüş ?? undefined) : null;
        if (!dönüş)
          hata("ATA4013", "'döndür' yalnızca işlev içinde kullanılabilir.", bildirim.aralık);
        else if (dönüş.tür === "hiç") {
          if (tip) hata("ATA4006", "'hiç' döndüren işlev bir değer döndüremez.", bildirim.aralık);
        } else if (!tip) {
          if (dönüş.tür !== "bilinmeyen")
            hata("ATA4006", "Bu işlev bir dönüş değeri gerektirir.", bildirim.aralık);
        } else uyumDenetle(tip, dönüş, bildirim.ifade!.aralık, "ATA4006");
        return true;
      }
    }
    return false;
  }

  for (const bildirim of program.bildirimler) {
    if (bildirim.tür !== "yapı") continue;
    const alanlar = new Map<string, Tip>();
    for (const alan of bildirim.alanlar) {
      const tip = tipÇöz(alan.tip);
      if (alanlar.has(alan.ad)) hata("ATA4018", `Yinelenen alan: '${alan.ad}'.`, alan.aralık);
      else alanlar.set(alan.ad, tip);
    }
    if (isimler.tipBildirimleri.get(bildirim.ad) === bildirim)
      yapıAlanları.set(bildirim.ad, alanlar);
  }
  for (const bildirim of program.bildirimler) {
    if (bildirim.tür !== "seçenek") continue;
    if (bildirim.üyeler.length === 0)
      hata("ATA4023", `Seçenek '${bildirim.ad}' en az bir üye taşımalıdır.`, bildirim.aralık);
    const üyeler = new Set<string>();
    for (const üye of bildirim.üyeler) {
      if (üyeler.has(üye.ad)) hata("ATA4024", `Yinelenen seçenek üyesi: '${üye.ad}'.`, üye.aralık);
      üyeler.add(üye.ad);
    }
  }
  for (const sembol of isimler.bildirimSembolleri.values()) {
    if (sembol.tür === "işlev")
      işlevİmzaları.set(sembol, {
        parametreler: sembol.bildirim.parametreler.map((parametre) => tipÇöz(parametre.tip)),
        dönüş: tipÇöz(sembol.bildirim.dönüşTipi, "işlev-dönüşü"),
      });
  }
  for (const bildirim of program.bildirimler) bildirimDenetle(bildirim, null);
  return { tanılar, ifadeTipleri, sembolTipleri, işlevİmzaları, yapıAlanları };
}
