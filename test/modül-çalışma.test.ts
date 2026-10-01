import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ENTEGRASYON_ZAMAN_ASIMI_MS } from "./entegrasyon.ts";
import { modülleriYükle } from "../src/modüller/yükleyici.ts";
import { modülleriAnalizEt } from "../src/analiz/modüller.ts";
import { modülleriYorumla } from "../src/çalışma/modüller.ts";
import type { YorumlamaSeçenekleri } from "../src/çalışma/yorumlayıcı.ts";
import { yorumlayıcıOluştur } from "../src/çalışma/yorumlayıcı.ts";
import { seçenekEşleşir } from "../src/çalışma/değer.ts";
import { ikiliUygula } from "../src/çalışma/işlemler.ts";
import { ÇalışmaZamanıHatası } from "../src/çalışma/hata.ts";

async function hazırla(kök: string) {
  const yükleme = await modülleriYükle(join(kök, "ana.ata"));
  expect(yükleme.tanılar).toEqual([]);
  if (!yükleme.grafik) throw new Error("Graph bekleniyordu.");
  return { grafik: yükleme.grafik, analiz: modülleriAnalizEt(yükleme.grafik) };
}

async function çalıştır(kök: string, seçenekler: Partial<YorumlamaSeçenekleri> = {}) {
  const { grafik, analiz } = await hazırla(kök);
  const çıktı: string[] = [];
  const sonuç = modülleriYorumla(grafik, analiz, {
    çıktıYaz: (satır) => çıktı.push(satır),
    ...seçenekler,
  });
  return { çıktı, tanılar: sonuç.tanılar };
}

async function proje(
  dosyalar: Record<string, string>,
  sınama: (kök: string) => void | Promise<void>,
) {
  const kök = await mkdtemp(join(tmpdir(), "ata-modül-çalışma-"));
  try {
    await Promise.all(
      Object.entries(dosyalar).map(([ad, metin]) => Bun.write(join(kök, ad), metin)),
    );
    await sınama(kök);
  } finally {
    await rm(kök, { recursive: true, force: true });
  }
}

function cli(kök: string, komut = "çalıştır", girdi = "") {
  return Bun.spawnSync(
    [
      process.execPath,
      "run",
      fileURLToPath(new URL("../src/cli/cli.ts", import.meta.url)),
      komut,
      join(kök, "ana.ata"),
    ],
    { cwd: tmpdir(), stdin: Buffer.from(girdi) },
  );
}

test(
  "CLI namespace işlevini defining module ortamında gerçekten çalıştırır",
  async () => {
    await proje(
      {
        "ana.ata": '"matematik" kullan\nmatematik::topla(10, 20) yazdır',
        "matematik.ata": "işlev topla(a: sayı, b: sayı): sayı { a + b döndür }",
      },
      (kök) => {
        const sonuç = cli(kök);
        expect(sonuç.exitCode).toBe(0);
        expect(sonuç.stdout.toString()).toBe("30\n");
        expect(sonuç.stderr.toString()).toBe("");
      },
    );
  },
  ENTEGRASYON_ZAMAN_ASIMI_MS,
);

test("qualified/selective yapılar imported nominal parametre, dönüş, liste ve optional değerlerde çalışır", async () => {
  await proje(
    {
      "ana.ata":
        '"m" kullan\n"./m" içinden K, yenile kullan\nsabit a = m::K { n: 10 }\nsabit b = K { n: 20 }\nyenile(a).n yazdır\nm::yenile(b).n yazdır\nm::kişiler[0].n yazdır\neğer m::belki != yok ise { m::belki.n yazdır }',
      "m.ata":
        "yapı K { n: sayı }\nsabit kişiler = [K { n: 3 }]\nsabit belki: K? = kişiler[0]\nişlev yenile(k: K): K { K { n: k.n + 1 } döndür }",
    },
    async (kök) =>
      expect(await çalıştır(kök)).toEqual({ çıktı: ["11", "21", "3", "3"], tanılar: [] }),
  );
});

test("namespace/selective/alias seçenekleri aynı origin eşitliğini ve exhaustive return-flow'u kullanır", async () => {
  await proje(
    {
      "ana.ata":
        '"d" mod olarak kullan\n"./d" içinden Durum, puan kullan\nsabit x = mod::Durum::Aktif\nx == Durum::Aktif yazdır\nx != mod::Durum::Pasif yazdır\npuan(x) yazdır\nmod::ver() eşleştir { Durum::Aktif ise { "aktif" yazdır } mod::Durum::Pasif ise { "pasif" yazdır } }',
      "d.ata":
        "seçenek Durum { Aktif, Pasif }\nsabit durum = Durum::Aktif\nişlev ver(): Durum { durum döndür }\nişlev puan(x: Durum): sayı { x eşleştir { Durum::Aktif ise { 1 döndür } Durum::Pasif ise { 0 döndür } } }",
    },
    async (kök) =>
      expect(await çalıştır(kök)).toEqual({ çıktı: ["doğru", "doğru", "1", "aktif"], tanılar: [] }),
  );
});

test(
  "selective ve alias aynı sabit/closure'ı, origin private state'i ve lexical isolation'ı paylaşır",
  async () => {
    await proje(
      {
        "ana.ata":
          '"sayaç" mat olarak kullan\n"./sayaç" içinden başlangıç, artır kullan\nsabit sayaç = 100\nbaşlangıç yazdır\nmat::başlangıç yazdır\nartır() yazdır\nmat::artır() yazdır\nsayaç yazdır',
        "sayaç.ata":
          "değişken sayaç = 0\nsabit başlangıç = artır()\nişlev artır(): sayı { sayaç += 1; sayaç döndür }",
      },
      (kök) => {
        const sonuç = cli(kök);
        expect(sonuç.exitCode).toBe(0);
        expect(sonuç.stdout.toString()).toBe("1\n1\n2\n3\n100\n");
        expect(sonuç.stderr.toString()).toBe("");
      },
    );
  },
  ENTEGRASYON_ZAMAN_ASIMI_MS,
);

test("diamond dependency source-order postorder'da bir kez çalışır; dallar aynı private state'i kullanır", async () => {
  const dosyalar = {
    "ana.ata": '"a" kullan\n"b" kullan\n"ana" yazdır\na::artır() yazdır\nb::çağır() yazdır',
    "a.ata":
      '"alt/../ortak" o olarak kullan\n"a" yazdır\nişlev artır(): sayı { o::artır() döndür }',
    "b.ata": '"./ortak" içinden artır kullan\n"b" yazdır\nişlev çağır(): sayı { artır() döndür }',
    "ortak.ata":
      '"ortak" yazdır\ndeğişken sayaç = 0\nişlev artır(): sayı { sayaç += 1; sayaç döndür }',
  };
  await proje(dosyalar, async (kök) => {
    const { grafik, analiz } = await hazırla(kök);
    expect(analiz.tanılar).toEqual([]);
    for (let i = 0; i < 2; i++) {
      const çıktı: string[] = [];
      expect(modülleriYorumla(grafik, analiz, { çıktıYaz: (s) => çıktı.push(s) }).tanılar).toEqual(
        [],
      );
      expect(çıktı).toEqual(["ortak", "a", "b", "ana", "1", "2"]);
    }
    await Bun.write(join(kök, "ana.ata"), '"b" kullan\n"a" kullan\n"ana" yazdır');
    expect(await çalıştır(kök)).toEqual({ çıktı: ["ortak", "b", "a", "ana"], tanılar: [] });
  });
});

test("transitive nominal closure ve local forward/mutual recursion root'tan bağımsız çalışır", async () => {
  await proje(
    {
      "ana.ata":
        '"servis" kullan\nişlev çalış(): sayı { servis::ver().i.n döndür }\nçalış() yazdır\nservis::faktöriyel(5) yazdır\nservis::çift(4) yazdır',
      "ortak.ata":
        "yapı Kimlik { n: sayı }\nsabit değer = 7\nişlev oluştur(): Kimlik { Kimlik { n: değer } döndür }",
      "servis.ata":
        '"ortak" o olarak kullan\nyapı K { i: o::Kimlik }\nsabit kayıt = K { i: o::oluştur() }\nişlev ver(): K { kayıt döndür }\nişlev faktöriyel(n: sayı): sayı { eğer n <= 1 ise { 1 döndür }; n * faktöriyel(n - 1) döndür }\nişlev çift(n: sayı): mantık { eğer n == 0 ise { doğru döndür }; tek(n - 1) döndür }\nişlev tek(n: sayı): mantık { eğer n == 0 ise { yanlış döndür }; çift(n - 1) döndür }',
    },
    async (kök) =>
      expect(await çalıştır(kök)).toEqual({ çıktı: ["7", "120", "doğru"], tanılar: [] }),
  );
});

test("dependency top-level ve imported function aynı output/input servislerini ve builtin'leri kullanır", async () => {
  await proje(
    {
      "ana.ata": '"m" içinden oku, yaz kullan\noku() yazdır\nyaz()\ngirdi("ana") yazdır',
      "m.ata":
        'girdi("dependency") yazdır\nişlev oku(): yazı { büyük_harf(girdi("işlev")) döndür }\nişlev yaz(): hiç { uzunluk([1, 2, 3]) yazdır; döndür }',
    },
    async (kök) => {
      const istemler: string[] = [];
      const satırlar = ["bir", "iki", "üç"];
      expect(
        await çalıştır(kök, {
          girdiOku: (istem) => {
            istemler.push(istem);
            return satırlar.shift() ?? null;
          },
        }),
      ).toEqual({ çıktı: ["bir", "İKİ", "3", "üç"], tanılar: [] });
      expect(istemler).toEqual(["dependency", "işlev", "ana"]);
    },
  );
});

test(
  "statik graph hatasında runner ve CLI hiçbir dependency çıktısı/girdisi üretmez",
  async () => {
    await proje(
      {
        "ana.ata": '"a" kullan\n"b" kullan\n"ana" yazdır',
        "a.ata": '"ÇALIŞTI" yazdır\ngirdi("okuma") yazdır',
        "b.ata": 'sabit x: sayı = "yanlış"',
      },
      async (kök) => {
        let okundu = false;
        const sonuç = await çalıştır(kök, {
          girdiOku: () => {
            okundu = true;
            return "yanlış";
          },
        });
        expect(sonuç.çıktı).toEqual([]);
        expect(sonuç.tanılar.map((t) => t.kod)).toEqual(["ATA4001"]);
        expect(okundu).toBe(false);
        const dış = cli(kök);
        expect(dış.exitCode).toBe(1);
        expect(dış.stdout.toString()).toBe("");
        expect(dış.stderr.toString()).toContain("b.ata:1:17");
      },
    );
  },
  ENTEGRASYON_ZAMAN_ASIMI_MS,
);

test("dependency initialization hatası önceki çıktıyı korur; sonraki modüller ve root çalışmaz", async () => {
  await proje(
    {
      "ana.ata": '"a" kullan\n"b" kullan\n"ana" yazdır',
      "a.ata": '"ortak" kullan\n1 / 0 yazdır',
      "b.ata": '"b" yazdır',
      "ortak.ata": '"ortak" yazdır',
    },
    async (kök) => {
      const sonuç = await çalıştır(kök);
      expect(sonuç.çıktı).toEqual(["ortak"]);
      expect(sonuç.tanılar).toMatchObject([
        { kod: "ATA5001", yol: join(kök, "a.ata"), aralık: { başlangıç: { satır: 2, sütun: 1 } } },
      ]);
    },
  );
});

test("callee body hatası dependency'de, argument evaluation hatası caller'da raporlanır", async () => {
  await proje(
    {
      "ana.ata": '"m" kullan\nişlev çağır(): sayı { m::boz(1) döndür }\nçağır() yazdır',
      "m.ata": "işlev boz(x: sayı): sayı { x / 0 döndür }",
    },
    async (kök) => {
      let sonuç = await çalıştır(kök);
      expect(sonuç.tanılar).toMatchObject([
        { kod: "ATA5001", yol: join(kök, "m.ata"), aralık: { başlangıç: { satır: 1, sütun: 28 } } },
      ]);
      await Bun.write(join(kök, "ana.ata"), '"m" kullan\nm::boz(1 / 0) yazdır');
      sonuç = await çalıştır(kök);
      expect(sonuç.tanılar).toMatchObject([
        {
          kod: "ATA5001",
          yol: join(kök, "ana.ata"),
          aralık: { başlangıç: { satır: 2, sütun: 8 } },
        },
      ]);
    },
  );
});

test("module boundary çağrı derinliğini sıfırlamaz; 256 bütçesi tek oturuma aittir", async () => {
  await proje(
    {
      "ana.ata": '"m" kullan\nişlev kök(): sayı { m::f(254) döndür }\nkök() yazdır',
      "m.ata": "işlev f(n: sayı): sayı { eğer n == 0 ise { 0 döndür }; f(n - 1) + 1 döndür }",
    },
    async (kök) => {
      expect(await çalıştır(kök)).toEqual({ çıktı: ["254"], tanılar: [] });
      await Bun.write(
        join(kök, "ana.ata"),
        '"m" kullan\nişlev kök(): sayı { m::f(255) döndür }\nkök() yazdır',
      );
      const sonuç = await çalıştır(kök);
      expect(sonuç.çıktı).toEqual([]);
      expect(sonuç.tanılar).toMatchObject([{ kod: "ATA5006", yol: join(kök, "m.ata") }]);
    },
  );
});

test(
  "denetle dependency yazdır/girdi side effect'lerini yürütmez; çalıştır input'u paylaşır",
  async () => {
    await proje(
      {
        "ana.ata": '"m" kullan\n"ana" yazdır',
        "m.ata": '"dependency" yazdır\ngirdi("istem: ") yazdır',
      },
      (kök) => {
        const denetim = cli(kök, "denetle");
        expect(denetim.exitCode).toBe(0);
        expect(denetim.stdout.toString()).toBe("Denetim başarılı.\n");
        expect(denetim.stderr.toString()).toBe("");
        const yürütme = cli(kök, "çalıştır", "Ata\n");
        expect(yürütme.exitCode).toBe(0);
        expect(yürütme.stdout.toString()).toBe("dependency\nistem: Ata\nana\n");
        expect(yürütme.stderr.toString()).toBe("");
      },
    );
  },
  ENTEGRASYON_ZAMAN_ASIMI_MS,
);

test("runtime yapı/seçenek kimliği gerçek TipSembolü'dür; same-name kökenler equality/match'te karışmaz", async () => {
  await proje(
    {
      "ana.ata":
        '"a" m olarak kullan\n"./a" içinden K, D kullan\n"b" kullan\nsabit k1 = m::K {}\nsabit k2 = K {}\nsabit k3 = b::K {}\nsabit d1 = m::D::Aktif\nsabit d2 = D::Aktif\nsabit d3 = b::D::Aktif',
      "a.ata": "yapı K {}\nseçenek D { Aktif }",
      "b.ata": "yapı K {}\nseçenek D { Aktif }",
    },
    async (kök) => {
      const { grafik, analiz } = await hazırla(kök);
      expect(analiz.tanılar).toEqual([]);
      const semantik = analiz.analizler.get(grafik.giriş.kanonikYol);
      if (!semantik) throw new Error("Analiz bekleniyordu.");
      const ortam = yorumlayıcıOluştur({ çıktıYaz: () => {} })(grafik.giriş.program, {
        yol: grafik.giriş.kanonikYol,
        isimler: semantik.isimler,
        tipler: semantik.isimler.tipBildirimleri,
        aktarımlar: new Map(),
      });
      const değer = (ad: string) => {
        const bağ = ortam.bul(ad, grafik.giriş.program.aralık);
        if (bağ.tür !== "değer") throw new Error("Değer bekleniyordu.");
        return bağ.değer;
      };
      const k1 = değer("k1"),
        k2 = değer("k2"),
        k3 = değer("k3");
      const d1 = değer("d1"),
        d2 = değer("d2"),
        d3 = değer("d3");
      if (
        k1.tür !== "yapı" ||
        k2.tür !== "yapı" ||
        k3.tür !== "yapı" ||
        d1.tür !== "seçenek" ||
        d2.tür !== "seçenek" ||
        d3.tür !== "seçenek"
      )
        throw new Error("Nominal değer bekleniyordu.");
      const kTipi = semantik.isimler.tipBildirimleri.get("K");
      const dTipi = semantik.isimler.tipBildirimleri.get("D");
      if (!kTipi || !dTipi) throw new Error("Tip sembolü bekleniyordu.");
      expect(k1.kimlik).toBe(kTipi);
      expect(k1.kimlik).toBe(k2.kimlik);
      expect(k1.kimlik).not.toBe(k3.kimlik);
      expect(d1.kimlik).toBe(dTipi);
      expect(d1.kimlik).toBe(d2.kimlik);
      expect(d1.kimlik).not.toBe(d3.kimlik);
      expect(seçenekEşleşir(d1, d2)).toBe(true);
      expect(seçenekEşleşir(d1, d3)).toBe(false);
      expect(ikiliUygula("==", d1, d2, grafik.giriş.program.aralık)).toEqual({
        tür: "mantık",
        değer: true,
      });
      expect(() => ikiliUygula("==", d1, d3, grafik.giriş.program.aralık)).toThrow(
        ÇalışmaZamanıHatası,
      );
    },
  );
});
