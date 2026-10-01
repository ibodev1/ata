import { expect, test } from "bun:test";
import { mkdtemp, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { modülleriYükle } from "../src/modüller/yükleyici.ts";
import { modülGörünenYolu } from "../src/modüller/yol.ts";
import { modülleriAnalizEt } from "../src/analiz/modüller.ts";
import { modülleriYorumla } from "../src/çalışma/modüller.ts";
import { tanıyıGöster } from "../src/tanılama/göster.ts";
import type { Kaynak } from "../src/kaynak/kaynak.ts";
import type { Tanı } from "../src/tanılama/tanı.ts";

async function proje(dosyalar: Record<string, string>, sınama: (kök: string) => Promise<void>) {
  const kök = await mkdtemp(join(tmpdir(), "ata sağlamlık Ölçü & (proje)-"));
  try {
    await Promise.all(
      Object.entries(dosyalar).map(([ad, metin]) => Bun.write(join(kök, ad), metin)),
    );
    await sınama(kök);
  } finally {
    await rm(kök, { recursive: true, force: true });
  }
}

function göster(kaynaklar: ReadonlyMap<string, Kaynak>, giriş: string, tanı: Tanı) {
  const kaynak = kaynaklar.get(tanı.yol);
  if (!kaynak) throw new Error("Tanının gerçek kaynağı bekleniyordu.");
  return tanıyıGöster(kaynak, tanı, modülGörünenYolu(giriş, tanı.yol));
}

test("junction entry ve diamond aynı canonical nominal kimliği ve private state'i bir kez yürütür", async () => {
  await proje(
    {
      "gerçek/ana.ata": '"a" kullan\n"b" kullan\nb::oku(a::üret()) yazdır',
      "gerçek/a.ata": '"ortak/m" o olarak kullan\nişlev üret(): o::K { o::üret() döndür }',
      "gerçek/b.ata":
        '"../görünen/ortak/m" içinden K, üret kullan\nişlev oku(k: K): sayı { k.n + üret().n döndür }',
      "gerçek/ortak/m.ata":
        '"ortak" yazdır\nyapı K { n: sayı }\ndeğişken sayaç = 0\nişlev üret(): K { sayaç += 1; K { n: sayaç } döndür }',
      "gerçek/ulaşılmayan.ata": "@",
    },
    async (kök) => {
      await symlink(
        join(kök, "gerçek"),
        join(kök, "görünen"),
        process.platform === "win32" ? "junction" : "dir",
      );
      const yükleme = await modülleriYükle(join(kök, "görünen/ana.ata"));
      expect(yükleme.tanılar).toEqual([]);
      const grafik = yükleme.grafik;
      if (!grafik) throw new Error("Graph bekleniyordu.");
      expect(grafik.giriş.kanonikYol).toBe(await realpath(join(kök, "gerçek/ana.ata")));
      expect(grafik.modüller.size).toBe(4);
      expect(yükleme.kaynaklar.size).toBe(4);
      const analiz = modülleriAnalizEt(grafik);
      expect(analiz.tanılar).toEqual([]);
      for (let i = 0; i < 2; i++) {
        const çıktı: string[] = [];
        expect(
          modülleriYorumla(grafik, analiz, { çıktıYaz: (s) => çıktı.push(s) }).tanılar,
        ).toEqual([]);
        expect(çıktı).toEqual(["ortak", "3"]);
      }
    },
  );
});

test("harf büyüklüğü host realpath politikasına uyar; global lowercase veya dosya taraması yoktur", async () => {
  await proje(
    {
      "ana.ata":
        '"OlCu" o olarak kullan\n"oLcU" içinden artır kullan\no::artır() yazdır\nartır() yazdır',
      "OlCu.ata": "değişken n = 0\nişlev artır(): sayı { n += 1; n döndür }",
    },
    async (kök) => {
      const gerçek = await realpath(join(kök, "OlCu.ata"));
      const varyant = await realpath(join(kök, "oLcU.ata")).catch((hata: unknown) => {
        expect(hata).toMatchObject({ code: "ENOENT" });
        return null;
      });
      const yükleme = await modülleriYükle(join(kök, "ana.ata"));
      if (varyant !== null) {
        expect(yükleme.tanılar).toEqual([]);
        expect(yükleme.grafik?.modüller.size).toBe(varyant === gerçek ? 2 : 3);
        if (!yükleme.grafik) throw new Error("Graph bekleniyordu.");
        const çıktı: string[] = [];
        expect(
          modülleriYorumla(yükleme.grafik, modülleriAnalizEt(yükleme.grafik), {
            çıktıYaz: (s) => çıktı.push(s),
          }).tanılar,
        ).toEqual([]);
        expect(çıktı).toEqual(varyant === gerçek ? ["1", "2"] : ["1", "1"]);
      } else {
        expect(varyant).toBeNull();
        expect(yükleme.tanılar.map((t) => t.kod)).toEqual(["ATA6001"]);
        await Bun.write(join(kök, "oLcU.ata"), "işlev artır(): sayı { 10 döndür }");
        const ayrı = await modülleriYükle(join(kök, "ana.ata"));
        expect(ayrı.tanılar).toEqual([]);
        expect(ayrı.grafik?.modüller.size).toBe(3);
        expect(await realpath(join(kök, "oLcU.ata"))).not.toBe(gerçek);
      }
    },
  );
});

test("kaynak NFC olur; filesystem NFD dosya adına alternatif arama yapılmaz", async () => {
  const nfd = "o\u0308lc\u0327u\u0308";
  await proje({ "ana.ata": `"${nfd}" kullan`, [`${nfd}.ata`]: `sabit ${nfd} = 1` }, async (kök) => {
    const nfcYol = await realpath(join(kök, "ölçü.ata")).catch((hata: unknown) => {
      expect(hata).toMatchObject({ code: "ENOENT" });
      return null;
    });
    const yükleme = await modülleriYükle(join(kök, "ana.ata"));
    if (nfcYol === null) {
      expect(yükleme.tanılar.map((t) => t.kod)).toEqual(["ATA6001"]);
      expect(yükleme.kaynaklar.size).toBe(1);
    } else {
      expect(yükleme.tanılar).toEqual([]);
      expect(yükleme.grafik?.sıra[0]?.kanonikYol).toBe(nfcYol);
    }
    const doğrudan = await modülleriYükle(join(kök, `${nfd}.ata`));
    expect(doğrudan.tanılar).toEqual([]);
    expect(doğrudan.grafik?.giriş.kanonikYol).toBe(await realpath(join(kök, `${nfd}.ata`)));
    expect(doğrudan.grafik?.giriş.kaynak.içerik).toBe("sabit ölçü = 1");
  });
});

test("bozuk dosya symlink ve dizin junction missing tanısını importer literalinde üretir", async () => {
  await proje({ "ana.ata": '"bozuk" kullan\n"kopuk/m" kullan' }, async (kök) => {
    await symlink(join(kök, "olmayan.ata"), join(kök, "bozuk.ata"), "file");
    await symlink(
      join(kök, "olmayan"),
      join(kök, "kopuk"),
      process.platform === "win32" ? "junction" : "dir",
    );
    const yükleme = await modülleriYükle(join(kök, "ana.ata"));
    expect(yükleme.grafik).toBeNull();
    expect(yükleme.tanılar.map((t) => [t.kod, basename(t.yol), t.aralık.başlangıç])).toEqual([
      ["ATA6001", "ana.ata", { ofset: 0, satır: 1, sütun: 1 }],
      ["ATA6001", "ana.ata", { ofset: 15, satır: 2, sütun: 1 }],
    ]);
  });
});

test("aynı basename lexer/parser tanıları CRLF satırını ve silinmiş dosyaların cached kaynağını korur", async () => {
  await proje(
    {
      "ana.ata": '"a/m" a olarak kullan\n"b/m" b olarak kullan',
      "a/m.ata": "// o\u0308lc\u0327u\u0308\r\n@",
      "b/m.ata": "// şĞ🌍\r\nsabit = 1",
    },
    async (kök) => {
      const yükleme = await modülleriYükle(join(kök, "ana.ata"));
      expect(yükleme.grafik).toBeNull();
      expect(
        yükleme.tanılar.map((t) => [t.kod, t.aralık.başlangıç.satır, t.aralık.başlangıç.sütun]),
      ).toEqual([
        ["ATA1001", 2, 1],
        ["ATA2001", 2, 7],
      ]);
      await Promise.all([rm(join(kök, "a/m.ata")), rm(join(kök, "b/m.ata"))]);
      const giriş = await realpath(join(kök, "ana.ata"));
      const metinler = yükleme.tanılar.map((t) => göster(yükleme.kaynaklar, giriş, t));
      expect(metinler[0]).toContain("--> a/m.ata:2:1\n\n2 │ @\n    ^");
      expect(metinler[1]).toContain("--> b/m.ata:2:7\n\n2 │ sabit = 1\n          ^");
      expect(yükleme.kaynaklar.get(yükleme.tanılar[0]!.yol)?.içerik).toBe("// ölçü\r\n@");
    },
  );
});

test("same-basename name/type hataları dependency-first sırada gerçek Unicode kaynaklarında kalır", async () => {
  await proje(
    {
      "ana.ata": '"a/m" a olarak kullan\n"b/m" b olarak kullan\na::ölçü yazdır',
      "a/m.ata": "// ad\r\nbilinmeyen yazdır",
      "b/m.ata": '\uFEFF// tip\r\nsabit o\u0308lc\u0327u\u0308: sayı = "yanlış"',
    },
    async (kök) => {
      const yükleme = await modülleriYükle(join(kök, "ana.ata"));
      if (!yükleme.grafik) throw new Error("Graph bekleniyordu.");
      const analiz = modülleriAnalizEt(yükleme.grafik);
      expect(
        analiz.tanılar.map((t) => [t.kod, t.aralık.başlangıç.satır, t.aralık.başlangıç.sütun]),
      ).toEqual([
        ["ATA3001", 2, 1],
        ["ATA4001", 2, 20],
      ]);
      const metinler = analiz.tanılar.map((t) =>
        göster(yükleme.kaynaklar, yükleme.grafik!.giriş.kanonikYol, t),
      );
      expect(metinler[0]).toContain("--> a/m.ata:2:1\n\n2 │ bilinmeyen yazdır\n    ^^^^^^^^^^");
      expect(metinler[1]).toContain(
        ' --> b/m.ata:2:20\n\n2 │ sabit ölçü: sayı = "yanlış"\n                       ^^^^^^^^',
      );
      const çıktı: string[] = [];
      expect(
        modülleriYorumla(yükleme.grafik, analiz, { çıktıYaz: (s) => çıktı.push(s) }).tanılar,
      ).toEqual(analiz.tanılar);
      expect(çıktı).toEqual([]);
    },
  );
});

test("same-basename nominal tip kökenleri entry-relative tam dizinleriyle ayırt edilir", async () => {
  await proje(
    {
      "uygulama/ana.ata":
        '"../a/m" a olarak kullan\n"../b/m" b olarak kullan\nsabit x: a::K = b::K {}',
      "a/m.ata": "yapı K {}",
      "b/m.ata": "yapı K {}",
    },
    async (kök) => {
      const yükleme = await modülleriYükle(join(kök, "uygulama/ana.ata"));
      if (!yükleme.grafik) throw new Error("Graph bekleniyordu.");
      const analiz = modülleriAnalizEt(yükleme.grafik);
      expect(analiz.tanılar).toHaveLength(1);
      expect(analiz.tanılar[0]?.kod).toBe("ATA4001");
      expect(analiz.tanılar[0]?.mesaj).toContain("../a/m.ata içindeki K");
      expect(analiz.tanılar[0]?.mesaj).toContain("../b/m.ata içindeki K");
      expect(
        göster(yükleme.kaynaklar, yükleme.grafik.giriş.kanonikYol, analiz.tanılar[0]!),
      ).toContain("--> ana.ata:3:");
    },
  );
});

test("dependency ATA6004/6005/6007 tanıları doğru seçili ad, literal ve ikinci alias span'ını gösterir", async () => {
  await Promise.all(
    (
      [
        {
          metin: '"../data/foo-bar" içinden olmayan kullan',
          kod: "ATA6004",
          satır: 1,
          parça: "olmayan",
        },
        {
          metin: '"../data/foo-bar" mat olarak kullan\r\nmat::olmayan()',
          kod: "ATA6004",
          satır: 2,
          parça: "olmayan",
        },
        { metin: '"../data/foo-bar" kullan', kod: "ATA6005", satır: 1, parça: '"../data/foo-bar"' },
        {
          metin: '"../data/foo-bar" mat olarak kullan\r\n"../data/./foo-bar" y olarak kullan',
          kod: "ATA6007",
          satır: 2,
          parça: "y",
        },
      ] as const
    ).map(async ({ metin, kod, satır, parça }) => {
      await proje(
        { "ana.ata": '"dir/m" kullan', "dir/m.ata": metin, "data/foo-bar.ata": "sabit değer = 1" },
        async (kök) => {
          const yükleme = await modülleriYükle(join(kök, "ana.ata"));
          if (!yükleme.grafik) throw new Error("Graph bekleniyordu.");
          const analiz = modülleriAnalizEt(yükleme.grafik);
          expect(analiz.tanılar).toHaveLength(1);
          const tanı = analiz.tanılar[0]!;
          const kaynak = yükleme.kaynaklar.get(tanı.yol)!;
          expect(tanı.kod).toBe(kod);
          expect(tanı.yol).toBe(await realpath(join(kök, "dir/m.ata")));
          expect(tanı.aralık.başlangıç.satır).toBe(satır);
          expect(kaynak.içerik.slice(tanı.aralık.başlangıç.ofset, tanı.aralık.bitiş.ofset)).toBe(
            parça,
          );
          expect(göster(yükleme.kaynaklar, yükleme.grafik.giriş.kanonikYol, tanı)).toContain(
            `--> dir/m.ata:${satır}:`,
          );
        },
      );
    }),
  );
});

test("transitive runtime hatası caller kaynaklarıyla overwrite edilmez ve cached CRLF snippet'ten gösterilir", async () => {
  await proje(
    {
      "ana.ata": '"a/m" a olarak kullan\na::çağır() yazdır',
      "a/m.ata": '"../b/m" b olarak kullan\nişlev çağır(): sayı { b::böl(1) döndür }',
      "b/m.ata": "// ölçü 🌍\r\nişlev böl(x: sayı): sayı { x / 0 döndür }",
    },
    async (kök) => {
      const yükleme = await modülleriYükle(join(kök, "ana.ata"));
      if (!yükleme.grafik) throw new Error("Graph bekleniyordu.");
      const analiz = modülleriAnalizEt(yükleme.grafik);
      expect(analiz.tanılar).toEqual([]);
      await rm(join(kök, "b/m.ata"));
      const çıktı: string[] = [];
      const sonuç = modülleriYorumla(yükleme.grafik, analiz, { çıktıYaz: (s) => çıktı.push(s) });
      expect(çıktı).toEqual([]);
      expect(sonuç.tanılar).toHaveLength(1);
      expect(sonuç.tanılar[0]).toMatchObject({
        kod: "ATA5001",
        aralık: { başlangıç: { satır: 2, sütun: 28 } },
      });
      expect(
        göster(yükleme.kaynaklar, yükleme.grafik.giriş.kanonikYol, sonuç.tanılar[0]!),
      ).toContain(
        "--> b/m.ata:2:28\n\n2 │ işlev böl(x: sayı): sayı { x / 0 döndür }\n                               ^^^^^",
      );
    },
  );
});

test("hatalı invocation sonrası yeni graph'ın kaynak, tip, input/output, private state ve derinlik bütçesi ayrıdır", async () => {
  await proje(
    {
      "ana.ata": '"m" kullan\ngirdi("ilk") yazdır\nm::artır() yazdır\nm::f(256) yazdır',
      "m.ata":
        "yapı K {}\ndeğişken n = 0\nişlev artır(): sayı { n += 1; n döndür }\nişlev f(n: sayı): sayı { eğer n == 0 ise { 0 döndür }; f(n - 1) + 1 döndür }",
    },
    async (kök) => {
      const ilk = await modülleriYükle(join(kök, "ana.ata"));
      if (!ilk.grafik) throw new Error("Graph bekleniyordu.");
      const ilkAnaliz = modülleriAnalizEt(ilk.grafik);
      expect(ilkAnaliz.tanılar).toEqual([]);
      const ilkÇıktı: string[] = [];
      const ilkİstem: string[] = [];
      const hata = modülleriYorumla(ilk.grafik, ilkAnaliz, {
        çıktıYaz: (s) => ilkÇıktı.push(s),
        girdiOku: (istem) => {
          ilkİstem.push(istem);
          return "bir";
        },
      });
      expect(hata.tanılar.map((t) => t.kod)).toEqual(["ATA5006"]);
      expect(ilkÇıktı).toEqual(["bir", "1"]);
      expect(ilkİstem).toEqual(["ilk"]);
      await Bun.write(
        join(kök, "ana.ata"),
        '"m" kullan\ngirdi("ikinci") yazdır\nm::artır() yazdır\nm::f(255) yazdır',
      );
      const ikinci = await modülleriYükle(join(kök, "ana.ata"));
      if (!ikinci.grafik) throw new Error("Graph bekleniyordu.");
      const ikinciAnaliz = modülleriAnalizEt(ikinci.grafik);
      expect(ikinciAnaliz.tanılar).toEqual([]);
      const ikinciÇıktı: string[] = [];
      const ikinciİstem: string[] = [];
      expect(
        modülleriYorumla(ikinci.grafik, ikinciAnaliz, {
          çıktıYaz: (s) => ikinciÇıktı.push(s),
          girdiOku: (istem) => {
            ikinciİstem.push(istem);
            return "iki";
          },
        }).tanılar,
      ).toEqual([]);
      expect(ikinciÇıktı).toEqual(["iki", "1", "255"]);
      expect(ikinciİstem).toEqual(["ikinci"]);
      expect(ilkÇıktı).toEqual(["bir", "1"]);
      expect(ilkİstem).toEqual(["ilk"]);
      const modül = await realpath(join(kök, "m.ata"));
      const ilkKimlik = ilkAnaliz.analizler.get(modül)?.isimler.tipBildirimleri.get("K");
      const ikinciKimlik = ikinciAnaliz.analizler.get(modül)?.isimler.tipBildirimleri.get("K");
      expect(ilkKimlik).toBeDefined();
      expect(ikinciKimlik).toBeDefined();
      expect(ikinciKimlik).not.toBe(ilkKimlik);
      expect(ilk.kaynaklar).not.toBe(ikinci.kaynaklar);
      expect(ilk.grafik.giriş.kaynak.içerik).toContain("f(256)");
      expect(ikinci.grafik.giriş.kaynak.içerik).toContain("f(255)");
    },
  );
});
