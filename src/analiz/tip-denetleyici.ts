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
} from "../standart/yerleşikler.ts";

const bilinmeyen: Tip = { tür: "bilinmeyen" };
const sayı: Tip = { tür: "sayı" };
const mantık: Tip = { tür: "mantık" };

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
  const yapıAlanları = new Map<string, ReadonlyMap<string, Tip>>();

  function hata(kod: Tanı["kod"], mesaj: string, aralık: KaynakAralığı): void {
    tanılar.push({ kod, seviye: "hata", mesaj, aralık, yol });
  }

  function tipÇöz(ifade: Tipİfadesi): Tip {
    switch (ifade.tür) {
      case "adlandırılmış-tip":
        if (isimler.yapılar.has(ifade.ad)) return { tür: "yapı", ad: ifade.ad };
        hata("ATA3004", `Tanımlanmamış tip: '${ifade.ad}'.`, ifade.aralık);
        return bilinmeyen;
      case "temel-tip":
        return { tür: ifade.ad };
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
    const tip = ifadeTipi(ifade, beklenen);
    ifadeTipleri.set(ifade, tip);
    return tip;
  }

  function ifadeTipi(ifade: İfade, beklenen?: Tip): Tip {
    switch (ifade.tür) {
      case "yapı-oluşturma": {
        const alanlar = yapıAlanları.get(ifade.yapıAdı);
        if (!alanlar) hata("ATA3004", `Tanımlanmamış tip: '${ifade.yapıAdı}'.`, ifade.aralık);
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
        const sembol = isimler.bağlar.get(ifade);
        if (sembol?.tür === "işlev" || sembol?.tür === "yerleşik") {
          hata(
            "ATA4010",
            `İşlev '${sembol.ad}' yalnızca çağrı hedefi olarak kullanılabilir.`,
            ifade.aralık,
          );
          return bilinmeyen;
        }
        return sembol ? (sembolTipleri.get(sembol) ?? bilinmeyen) : bilinmeyen;
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
      case "ikili":
        return ikiliTip(
          ifade.işleç,
          ifadeDenetle(ifade.sol),
          ifadeDenetle(ifade.sağ),
          ifade.aralık,
        );
      case "liste": {
        const hedef = beklenen?.tür === "isteğe-bağlı" ? beklenen.temel : beklenen;
        const elemanHedefi = hedef?.tür === "liste" ? hedef.eleman : undefined;
        const tipler = ifade.elemanlar.map((eleman) => ifadeDenetle(eleman, elemanHedefi));
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
        return hedef;
      }
      case "çağrı": {
        const sembol =
          ifade.çağrılan.tür === "tanımlayıcı" ? isimler.bağlar.get(ifade.çağrılan) : undefined;
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
          ifade.argümanlar.forEach((argüman, sıra) => {
            const kural = işlev.parametreler[sıra];
            // Eleman tipi uzunluk/gösterim için önemsizdir; yalnızca boş literal bağlam alır.
            const bağlam: Tip | undefined =
              kural && kural !== "yazı" && argüman.tür === "liste" && argüman.elemanlar.length === 0
                ? { tür: "liste", eleman: bilinmeyen }
                : undefined;
            const verilen = ifadeDenetle(argüman, bağlam);
            if (kural && !parametreKabulEder(kural, verilen))
              hata(
                "ATA4005",
                `'${işlev.ad}' işlevinin ${sıra + 1}. argümanı '${parametreyiGöster(kural)}' olmalıdır; '${tipiGöster(verilen)}' verildi.`,
                argüman.aralık,
              );
          });
          return işlev.dönüş;
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
        return imza.dönüş;
      }
    }
  }

  function koşulDenetle(ifade: İfade): void {
    const tip = ifadeDenetle(ifade);
    if (tip.tür !== "mantık" && tip.tür !== "bilinmeyen")
      hata("ATA4002", `Koşul 'mantık' olmalıdır; '${tipiGöster(tip)}' verildi.`, ifade.aralık);
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
        break;
      case "sabit":
      case "değişken": {
        const açık = bildirim.açıkTip ? tipÇöz(bildirim.açıkTip) : undefined;
        const başlangıç = ifadeDenetle(bildirim.başlangıç, açık);
        let tip = açık ?? başlangıç;
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
        const döner = blokDenetle(bildirim.blok, imza.dönüş);
        if (imza.dönüş.tür !== "hiç" && imza.dönüş.tür !== "bilinmeyen" && !döner)
          hata(
            "ATA4007",
            `'${bildirim.ad}' işlevi bütün yollarda değer döndürmüyor.`,
            bildirim.aralık,
          );
        break;
      }
      case "blok":
        return blokDenetle(bildirim, dönüş);
      case "koşul": {
        koşulDenetle(bildirim.koşul);
        const doğru = blokDenetle(bildirim.doğruysa, dönüş);
        const yanlış = bildirim.değilse ? bildirimDenetle(bildirim.değilse, dönüş) : false;
        return doğru && yanlış;
      }
      case "iken":
        koşulDenetle(bildirim.koşul);
        blokDenetle(bildirim.blok, dönüş);
        break;
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
        blokDenetle(bildirim.blok, dönüş);
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
    if (isimler.yapılar.get(bildirim.ad) === bildirim) yapıAlanları.set(bildirim.ad, alanlar);
  }
  for (const sembol of isimler.bildirimSembolleri.values()) {
    if (sembol.tür === "işlev")
      işlevİmzaları.set(sembol, {
        parametreler: sembol.bildirim.parametreler.map((parametre) => tipÇöz(parametre.tip)),
        dönüş: tipÇöz(sembol.bildirim.dönüşTipi),
      });
  }
  for (const bildirim of program.bildirimler) bildirimDenetle(bildirim, null);
  return { tanılar, ifadeTipleri, sembolTipleri, işlevİmzaları, yapıAlanları };
}
