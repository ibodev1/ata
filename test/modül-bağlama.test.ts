import { expect, test } from "bun:test";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ENTEGRASYON_ZAMAN_ASIMI_MS } from "./entegrasyon.ts";
import { modülleriYükle } from "../src/modüller/yükleyici.ts";
import { modülleriAnalizEt } from "../src/analiz/modüller.ts";

async function proje(
  dosyalar: Record<string, string>,
  sınama: (sonuç: ReturnType<typeof modülleriAnalizEt>, kök: string) => void | Promise<void>,
) {
  const kök = await mkdtemp(join(tmpdir(), "ata-bağlama-"));
  try {
    await Promise.all(
      Object.entries(dosyalar).map(([ad, metin]) => Bun.write(join(kök, ad), metin)),
    );
    const yükleme = await modülleriYükle(join(kök, "ana.ata"));
    expect(yükleme.tanılar).toEqual([]);
    if (!yükleme.grafik) throw new Error("Graph bekleniyordu.");
    await sınama(modülleriAnalizEt(yükleme.grafik), kök);
  } finally {
    await rm(kök, { recursive: true, force: true });
  }
}

const matematik = "sabit pi = 3.14\nişlev topla(a: sayı, b: sayı): sayı { a + b döndür }";

test("namespace ve selective işlevler aynı argüman sayı/tip kurallarını kullanır", async () => {
  for (const [ön, ad] of [
    ['"matematik" kullan', "matematik::topla"],
    ['"matematik" içinden topla kullan', "topla"],
  ]) {
    // eslint-disable-next-line no-await-in-loop -- İki import biçimi ayrı graph'larda doğrulanır.
    await proje(
      {
        "ana.ata": `${ön}\n${ad}(1) yazdır\n${ad}("yanlış", 2) yazdır`,
        "matematik.ata": matematik,
      },
      (sonuç) => expect(sonuç.tanılar.map((tanı) => tanı.kod)).toEqual(["ATA4004", "ATA4005"]),
    );
  }
});

test("module-safe sabit ve imzalar optional/liste/hiç tiplerini yeniden çözmeden aktarır", async () => {
  const dep = `sabit n = 1
sabit s = "yazı"
sabit b = doğru
sabit o: sayı? = yok
sabit l = [1, 2]
işlev isteğe(x: sayı?): sayı? { x döndür }
işlev listele(x: liste<sayı>): liste<sayı> { x döndür }
işlev sessiz(): hiç {}
işlev özyinele(x: sayı): sayı { eğer x == 0 ise { 0 döndür }; özyinele(x - 1) döndür }`;
  for (const [ön, önek] of [
    ['"m" kullan', "m::"],
    ['"m" içinden n, s, b, o, l, isteğe, listele, sessiz, özyinele kullan', ""],
  ]) {
    // eslint-disable-next-line no-await-in-loop -- Namespace ve selective aynı public tip yüzeyini kullanır.
    await proje(
      {
        "ana.ata": `${ön}\nsabit a = ${önek}n\nsabit z = ${önek}s\nsabit c = ${önek}b\nsabit d = ${önek}o\nsabit e = ${önek}l\nsabit f = ${önek}isteğe(yok)\nsabit g = ${önek}listele([1])\n${önek}sessiz()\n${önek}özyinele(2) yazdır`,
        "m.ata": dep,
      },
      (sonuç) => {
        expect(sonuç.tanılar).toEqual([]);
        expect(sonuç.engeller).toEqual([]);
        const ana = [...sonuç.analizler.values()].at(-1)!;
        const tipler = [...ana.sembolTipleri]
          .filter(([sembol]) => ["a", "z", "c", "d", "e", "f", "g"].includes(sembol.ad))
          .map(([, tip]) => tip);
        expect(tipler).toEqual([
          { tür: "sayı" },
          { tür: "yazı" },
          { tür: "mantık" },
          { tür: "isteğe-bağlı", temel: { tür: "sayı" } },
          { tür: "liste", eleman: { tür: "sayı" } },
          { tür: "isteğe-bağlı", temel: { tür: "sayı" } },
          { tür: "liste", eleman: { tür: "sayı" } },
        ]);
      },
    );
  }
});

test("namespace ve selective optional sabit aynı flow identity ile daralır; çağrı immutable fact'i bozmaz", async () => {
  await proje(
    {
      "ana.ata": `"ayarlar" kullan
"ayarlar" içinden değer, dokun kullan
eğer ayarlar::değer != yok ise {
  dokun()
  değer + 1 yazdır
  ayarlar::değer + 2 yazdır
  eğer ayarlar::değer != yok ise { değer + 3 yazdır }
}
eğer değer != yok ise { ayarlar::değer + 1 yazdır }`,
      "ayarlar.ata": "sabit değer: sayı? = 1\nişlev dokun(): hiç {}",
    },
    (sonuç) => {
      expect(sonuç.tanılar).toEqual([]);
      expect(sonuç.engeller).toEqual([]);
    },
  );
  await proje(
    {
      "ana.ata": '"ayarlar" içinden değer kullan\ndeğer = 10',
      "ayarlar.ata": "sabit değer: sayı? = 1",
    },
    (sonuç) => expect(sonuç.tanılar.map((tanı) => tanı.kod)).toEqual(["ATA4003"]),
  );
});

test("import edilmiş adlar ve builtin'ler re-export edilmez", async () => {
  await proje(
    {
      "ana.ata": '"a" kullan\na::x yazdır',
      "a.ata": '"b" içinden x kullan',
      "b.ata": "sabit x = 1",
    },
    (sonuç) => {
      expect(sonuç.tanılar.map((tanı) => tanı.kod)).toEqual(["ATA6004"]);
      const a = [...sonuç.kataloglar.values()].find((katalog) =>
        katalog.modülYolu.endsWith("a.ata"),
      )!;
      expect(a.değerler.size).toBe(0);
    },
  );
});

test("hatalı dependency geçerli katalog üretmez; importer missing-name cascade'i üretmez", async () => {
  await proje(
    {
      "ana.ata": '"m" içinden olmayan kullan\nolmayan() yazdır',
      "m.ata": 'sabit x: sayı = "yanlış"',
    },
    (sonuç) => {
      expect(sonuç.tanılar.map((tanı) => tanı.kod)).toEqual(["ATA4001"]);
      expect(sonuç.kataloglar.size).toBe(0);
      expect(sonuç.analizler.size).toBe(1);
    },
  );
});

test("diamond shared export ve analysis bir kez üretilir; importer kapsamları ayrı kalır", async () => {
  await proje(
    {
      "ana.ata": '"a" kullan\n"b" kullan\na::bir() + b::iki() yazdır',
      "a.ata": '"ortak" içinden değer kullan\nişlev bir(): sayı { değer döndür }',
      "b.ata": '"ortak" kullan\nişlev iki(): sayı { ortak::değer döndür }',
      "ortak.ata": "sabit değer = 1",
    },
    (sonuç) => {
      expect(sonuç.tanılar).toEqual([]);
      expect(sonuç.analizler.size).toBe(4);
      expect(sonuç.kataloglar.size).toBe(4);
      const analizler = [...sonuç.analizler.values()];
      const ortakSembol = [...analizler[0]!.isimler.bildirimSembolleri.values()][0];
      expect(
        [...analizler[1]!.isimler.bağlar.values()].find((sembol) => sembol.ad === "değer"),
      ).toBe(ortakSembol);
      expect(
        [...analizler[2]!.isimler.bağlar.values()].find((sembol) => sembol.ad === "değer"),
      ).toBe(ortakSembol);
    },
  );
});

const modeller = `yapı K { n: sayı }
seçenek D { açık }
sabit kişi = K { n: 1 }
sabit kişiler = [K { n: 1 }]
sabit belki: K? = yok
sabit durum = D::açık
sabit bileşik: liste<K?> = [K { n: 1 }, yok]
işlev kişi_al(): K { K { n: 1 } döndür }
işlev kişi_ver(k: K): sayı { k.n döndür }
işlev güvenli(x: sayı): sayı { sabit k = K { n: x }; k.n döndür }`;

test("namespace kullanılmayan nominal export nedeniyle engellenmez; primitive public imzanın nominal gövdesi izinlidir", async () => {
  await proje(
    { "ana.ata": '"modeller" kullan\nmodeller::güvenli(1) yazdır', "modeller.ata": modeller },
    (sonuç) => {
      expect(sonuç.tanılar).toEqual([]);
      expect(sonuç.engeller).toEqual([]);
    },
  );
});

test("nominal içeren sabit ve işlev public yüzeyi recursive guard ile fail-closed kalır", async () => {
  for (const ad of ["kişi", "kişiler", "belki", "durum", "bileşik", "kişi_al", "kişi_ver"]) {
    // eslint-disable-next-line no-await-in-loop -- Her public nominal yüzey kendi kullanım noktasında engellenir.
    await proje(
      { "ana.ata": `"modeller" içinden ${ad} kullan`, "modeller.ata": modeller },
      (sonuç) => {
        expect(sonuç.tanılar).toEqual([]);
        expect(sonuç.engeller.map((engel) => engel.mesaj)).toEqual([
          "Modüller arası kullanıcı tanımlı tipler bu geliştirme sürümünde henüz desteklenmiyor.",
        ]);
      },
    );
  }
  await proje(
    { "ana.ata": '"modeller" kullan\nmodeller::kişi_al() yazdır', "modeller.ata": modeller },
    (sonuç) => {
      expect(sonuç.tanılar).toEqual([]);
      expect(sonuç.engeller).toHaveLength(1);
    },
  );
});

test("gerçek tip export'u ATA6004 almaz; selective ve namespace tip erişimi geliştirme engeli alır", async () => {
  await proje(
    { "ana.ata": '"modeller" içinden K kullan\nsabit k: K? = yok', "modeller.ata": modeller },
    (sonuç) => {
      expect(sonuç.tanılar).toEqual([]);
      expect(sonuç.engeller.map((engel) => engel.mesaj)).toEqual([
        "Modüller arası tip kullanımı bu geliştirme sürümünde henüz desteklenmiyor.",
      ]);
    },
  );
  await proje(
    { "ana.ata": '"modeller" kullan\nmodeller::D::açık yazdır', "modeller.ata": modeller },
    (sonuç) => {
      expect(sonuç.tanılar).toEqual([]);
      expect(sonuç.engeller).toHaveLength(1);
    },
  );
});

test("missing selective body'de cascade üretmez; çok segmentli primitive yol kontrollü reddedilir", async () => {
  await proje(
    {
      "ana.ata": '"matematik" içinden olmayan kullan\nolmayan() yazdır',
      "matematik.ata": matematik,
    },
    (sonuç) => expect(sonuç.tanılar.map((tanı) => tanı.kod)).toEqual(["ATA6004"]),
  );
  await proje(
    { "ana.ata": '"matematik" kullan\nmatematik::pi::x yazdır', "matematik.ata": matematik },
    (sonuç) => expect(sonuç.tanılar.map((tanı) => tanı.kod)).toEqual(["ATA4025"]),
  );
});

test("alias yalnız seçilen namespace'i bağlar; default ad ayrıca eklenmez", async () => {
  await proje(
    {
      "ana.ata": '"yardımcı/../foo-bar" fb olarak kullan\nfb::pi yazdır',
      "foo-bar.ata": matematik,
    },
    (sonuç) => {
      expect(sonuç.tanılar).toEqual([]);
      expect(sonuç.engeller).toEqual([]);
    },
  );
  await proje(
    {
      "ana.ata": '"matematik" mat olarak kullan\nmatematik::pi yazdır',
      "matematik.ata": matematik,
    },
    (sonuç) => expect(sonuç.tanılar.map((tanı) => tanı.kod)).toEqual(["ATA3004"]),
  );
});

test("export kataloğu yalnız kendi top-level sabit/işlev ve ayrı tip kategorisini taşır", async () => {
  await proje(
    {
      "ana.ata": '"m" kullan',
      "m.ata":
        "sabit açık = 1\ndeğişken kapalı = 2\n{ sabit iç = 3 }\nyapı K {}\nseçenek D { a }\nişlev f(): sayı { açık döndür }",
    },
    (sonuç) => {
      expect(sonuç.tanılar).toEqual([]);
      const katalog = [...sonuç.kataloglar.values()][0]!;
      expect([...katalog.değerler.keys()]).toEqual(["açık", "f"]);
      expect([...katalog.tipler.keys()]).toEqual(["K", "D"]);
      const aktarım = katalog.değerler.get("açık")!;
      expect(aktarım.sembol.aralık.başlangıç.satır).toBe(1);
      expect(aktarım.modülYolu).toBe(katalog.modülYolu);
    },
  );
});

test("missing, mutable ve builtin export erişimleri member/seçili ad üzerinde ATA6004 alır", async () => {
  for (const [ana, ad, sütun] of [
    ['"matematik" içinden olmayan kullan', "olmayan", 21],
    ['"matematik" kullan\nmatematik::olmayan yazdır', "olmayan", 12],
    ['"matematik" içinden sayaç kullan', "sayaç", 21],
    ['"matematik" kullan\nmatematik::sayaç yazdır', "sayaç", 12],
    ['"matematik" içinden uzunluk kullan', "uzunluk", 21],
    ['"matematik" kullan\nmatematik::uzunluk([1]) yazdır', "uzunluk", 12],
  ] as const) {
    // eslint-disable-next-line no-await-in-loop -- Her ayrı semantic senaryo kendi fixture'ıyla doğrulanır.
    await proje(
      { "ana.ata": ana, "matematik.ata": `${matematik}\ndeğişken sayaç = 0` },
      (sonuç) => {
        expect(sonuç.tanılar).toHaveLength(1);
        expect(sonuç.tanılar[0]).toMatchObject({
          kod: "ATA6004",
          mesaj: `'matematik' modülünde erişilebilir '${ad}' adı bulunamadı.`,
          aralık: { başlangıç: { satır: ana.includes("\n") ? 2 : 1, sütun } },
        });
      },
    );
  }
});

test("geçersiz/keyword basename ATA6005 alır; alias ve selective basename'e bağlı değildir", async () => {
  for (const ad of ["foo-bar", "123", "işlev", "sayı", "foo bar"]) {
    // eslint-disable-next-line no-await-in-loop -- Geçersiz basename örnekleri tek tek doğrulanır.
    await proje({ "ana.ata": `"${ad}" kullan`, [`${ad}.ata`]: matematik }, (sonuç) => {
      expect(sonuç.tanılar.map((tanı) => tanı.kod)).toEqual(["ATA6005"]);
      expect(sonuç.tanılar[0]?.mesaj).toBe(
        `'${ad}' geçerli bir modül ad alanı değildir; açık bir takma ad kullanın.`,
      );
    });
  }
  await proje(
    { "ana.ata": '"foo-bar" fb olarak kullan\nfb::pi yazdır', "foo-bar.ata": matematik },
    (sonuç) => expect(sonuç.tanılar).toEqual([]),
  );
  await proje(
    { "ana.ata": '"foo-bar" içinden topla kullan\ntopla(1, 2) yazdır', "foo-bar.ata": matematik },
    (sonuç) => expect(sonuç.tanılar).toEqual([]),
  );
});

test("canonical modül başına ikinci namespace ATA6007 alır; alias'lar kuralı aşamaz", async () => {
  for (const [ilk, ikinci] of [
    ['"matematik" kullan', '"matematik" kullan'],
    ['"matematik" kullan', '"./matematik" mat olarak kullan'],
    ['"matematik" mat olarak kullan', '"alt/../matematik" hesap olarak kullan'],
  ]) {
    // eslint-disable-next-line no-await-in-loop -- Canonical tekrar biçimleri sırayla doğrulanır.
    await proje({ "ana.ata": `${ilk}\n${ikinci}`, "matematik.ata": matematik }, (sonuç) => {
      expect(sonuç.tanılar).toHaveLength(1);
      expect(sonuç.tanılar[0]?.kod).toBe("ATA6007");
      expect(sonuç.tanılar[0]?.aralık.başlangıç.satır).toBe(2);
    });
  }
});

test("selective aynı origin tekrarları ATA6007 alır; farklı isimler ve namespace+selective izinlidir", async () => {
  await proje(
    { "ana.ata": '"matematik" içinden pi, pi kullan', "matematik.ata": matematik },
    (sonuç) => {
      expect(sonuç.tanılar.map((tanı) => tanı.kod)).toEqual(["ATA6007"]);
      expect(sonuç.tanılar[0]?.aralık.başlangıç.sütun).toBe(25);
    },
  );
  await proje(
    {
      "ana.ata": '"matematik" içinden topla kullan\n"./matematik" içinden topla kullan',
      "matematik.ata": matematik,
    },
    (sonuç) => expect(sonuç.tanılar.map((tanı) => tanı.kod)).toEqual(["ATA6007"]),
  );
  await proje(
    {
      "ana.ata":
        '"matematik" kullan\n"matematik" içinden pi kullan\n"./matematik" içinden topla kullan\npi + matematik::topla(1, 2) yazdır',
      "matematik.ata": matematik,
    },
    (sonuç) => expect(sonuç.tanılar).toEqual([]),
  );
});

test("farklı sembollerin normal kapsam/builtin çakışmaları ATA3002 alır", async () => {
  for (const ana of [
    '"a" içinden x kullan\n"b" içinden x kullan',
    '"a" içinden x kullan\nsabit x = 2',
    '"a" içinden f kullan\nişlev f(): sayı { 2 döndür }',
    '"a" x olarak kullan\nsabit x = 2',
    '"a" uzunluk olarak kullan',
  ]) {
    // eslint-disable-next-line no-await-in-loop -- Normal çakışma türleri module duplicate'den ayrı test edilir.
    await proje(
      {
        "ana.ata": ana,
        "a.ata": "sabit x = 1\nişlev f(): sayı { 1 döndür }",
        "b.ata": "sabit x = 2",
      },
      (sonuç) => expect(sonuç.tanılar.map((tanı) => tanı.kod)).toEqual(["ATA3002"]),
    );
  }
});

test("namespace/type çakışması ATA3005; sıradan value/type aynı adı kullanmaya devam eder", async () => {
  await proje(
    { "ana.ata": '"matematik" kullan\nyapı matematik {}', "matematik.ata": matematik },
    (sonuç) => expect(sonuç.tanılar.map((tanı) => tanı.kod)).toEqual(["ATA3005"]),
  );
  await proje({ "ana.ata": "sabit D = 1\nseçenek D { a }\nD yazdır\nD::a yazdır" }, (sonuç) =>
    expect(sonuç.tanılar).toEqual([]),
  );
});

test("namespace normal değer/çağrı/argüman/liste olamaz; işlev first-class hale gelmez", async () => {
  for (const [gövde, kod] of [
    ["matematik yazdır", "ATA4035"],
    ["sabit x = matematik", "ATA4035"],
    ["matematik()", "ATA4035"],
    ["uzunluk([matematik]) yazdır", "ATA4035"],
    ["işlev tüket(x: sayı): hiç {}\ntüket(matematik)", "ATA4035"],
    ["sabit f = matematik::topla", "ATA4010"],
  ] as const) {
    // eslint-disable-next-line no-await-in-loop -- Değer bağlamları aynı namespace fixture'ında ayrı çalıştırılır.
    await proje(
      { "ana.ata": `"matematik" kullan\n${gövde}`, "matematik.ata": matematik },
      (sonuç) => expect(sonuç.tanılar.map((tanı) => tanı.kod)).toEqual([kod]),
    );
  }
});

test("default namespace logical specifier'dan gelir; canonical dosya basename'i kullanılmaz", async () => {
  const kök = await mkdtemp(join(tmpdir(), "ata-logical-"));
  try {
    const ad = process.platform === "win32" ? "HESAP" : "bağ";
    await Bun.write(join(kök, "ana.ata"), `"${ad}" kullan\n${ad}::pi yazdır`);
    await Bun.write(
      join(kök, process.platform === "win32" ? "hesap.ata" : "gerçek.ata"),
      matematik,
    );
    if (process.platform !== "win32")
      await symlink(join(kök, "gerçek.ata"), join(kök, "bağ.ata"), "file");
    const yükleme = await modülleriYükle(join(kök, "ana.ata"));
    expect(yükleme.tanılar).toEqual([]);
    if (!yükleme.grafik) throw new Error("Graph bekleniyordu.");
    expect(modülleriAnalizEt(yükleme.grafik).tanılar).toEqual([]);
  } finally {
    await rm(kök, { recursive: true, force: true });
  }
});

test("iç value/parametre outer namespace'i gizler; qualified lookup outer'a atlamaz", async () => {
  await proje(
    {
      "ana.ata":
        '"matematik" kullan\nişlev f(matematik: sayı): sayı { matematik döndür }\n{ sabit matematik = 1; matematik yazdır }',
      "matematik.ata": matematik,
    },
    (sonuç) => expect(sonuç.tanılar).toEqual([]),
  );
  await proje(
    {
      "ana.ata": '"matematik" kullan\nişlev f(matematik: sayı): hiç { matematik::pi yazdır }',
      "matematik.ata": matematik,
    },
    (sonuç) => expect(sonuç.tanılar.map((tanı) => tanı.kod)).toEqual(["ATA4025"]),
  );
});

test("namespace ve selective erişim aynı gerçek export sembolünü ve çözülen imzayı kullanır", async () => {
  await proje(
    {
      "ana.ata":
        '"matematik" kullan\n"./matematik" içinden pi, topla kullan\nsabit a = matematik::pi\nsabit b = pi\nsabit c = matematik::topla(1, 2)\nsabit d = topla(3, 4)',
      "matematik.ata": matematik,
    },
    (sonuç) => {
      expect(sonuç.tanılar).toEqual([]);
      expect(sonuç.engeller).toEqual([]);
      const analizler = [...sonuç.analizler.values()];
      expect(analizler).toHaveLength(2);
      const ana = analizler[1]!;
      expect(
        [...ana.sembolTipleri]
          .filter(([sembol]) => ["a", "b", "c", "d"].includes(sembol.ad))
          .map(([, tip]) => tip),
      ).toEqual([{ tür: "sayı" }, { tür: "sayı" }, { tür: "sayı" }, { tür: "sayı" }]);
      const piBağları = [...ana.isimler.bağlar.values()].filter((sembol) => sembol.ad === "pi");
      expect(piBağları).toHaveLength(2);
      expect(piBağları[0]).toBe(piBağları[1]);
      expect(piBağları[0]).toBe(
        [...analizler[0]!.isimler.bildirimSembolleri.values()].find((sembol) => sembol.ad === "pi"),
      );
    },
  );
});

test(
  "CLI namespace statik çağrısını denetler; doğru program runtime'a geçmez",
  async () => {
    await proje(
      {
        "ana.ata": '"matematik" kullan\nmatematik::topla(10, 20) yazdır',
        "matematik.ata": matematik,
      },
      (_sonuç, kök) => {
        const cli = fileURLToPath(new URL("../src/cli/cli.ts", import.meta.url));
        for (const komut of ["denetle", "çalıştır"]) {
          const sonuç = Bun.spawnSync([process.execPath, "run", cli, komut, join(kök, "ana.ata")], {
            cwd: tmpdir(),
          });
          expect(sonuç.exitCode).toBe(komut === "denetle" ? 0 : 1);
          expect(sonuç.stdout.toString()).toBe(komut === "denetle" ? "Denetim başarılı.\n" : "");
          expect(sonuç.stderr.toString()).toBe(
            komut === "denetle"
              ? ""
              : "Modül çalışma zamanı bu geliştirme sürümünde henüz desteklenmiyor.\n",
          );
        }
      },
    );
  },
  ENTEGRASYON_ZAMAN_ASIMI_MS,
);

test(
  "CLI alias ve selective denetle başarılıdır; static hatalar runtime engelinden önce doğru span'da gösterilir",
  async () => {
    await proje(
      { "ana.ata": '"matematik" kullan', "matematik.ata": matematik, "foo-bar.ata": matematik },
      async (_sonuç, kök) => {
        const cli = fileURLToPath(new URL("../src/cli/cli.ts", import.meta.url));
        const çalıştır = (komut: string) =>
          Bun.spawnSync([process.execPath, "run", cli, komut, join(kök, "ana.ata")], {
            cwd: tmpdir(),
          });
        for (const gövde of [
          '"matematik" mat olarak kullan\nmat::topla(1, 2) yazdır',
          '"matematik" içinden pi, topla kullan\npi + topla(1, 2) yazdır',
          '"foo-bar" fb olarak kullan\nfb::pi yazdır',
        ]) {
          // eslint-disable-next-line no-await-in-loop -- Aynı entry dosyası her CLI çağrısından önce değiştirilir.
          await Bun.write(join(kök, "ana.ata"), gövde);
          const sonuç = çalıştır("denetle");
          expect(sonuç.exitCode).toBe(0);
          expect(sonuç.stdout.toString()).toBe("Denetim başarılı.\n");
          expect(sonuç.stderr.toString()).toBe("");
        }
        for (const [gövde, kod, konum] of [
          ['"matematik" kullan\nmatematik::olmayan()', "ATA6004", "ana.ata:2:12"],
          ['"foo-bar" kullan', "ATA6005", "ana.ata:1:1"],
          ['"matematik" kullan\n"./matematik" mat olarak kullan', "ATA6007", "ana.ata:2:15"],
          ['"matematik" kullan\nmatematik yazdır', "ATA4035", "ana.ata:2:1"],
        ] as const) {
          // eslint-disable-next-line no-await-in-loop -- Aynı entry üzerinde kontrollü negatif CLI smoke senaryoları.
          await Bun.write(join(kök, "ana.ata"), gövde);
          const sonuç = çalıştır("çalıştır");
          expect(sonuç.exitCode).toBe(1);
          expect(sonuç.stdout.toString()).toBe("");
          const hata = sonuç.stderr.toString();
          expect(hata).toContain(kod);
          expect(hata).toContain(konum);
          expect(hata).not.toContain("Modül çalışma zamanı");
          expect(hata).not.toMatch(/Error:|\bat .+\(.*:\d+:\d+\)/);
        }
      },
    );
  },
  ENTEGRASYON_ZAMAN_ASIMI_MS,
);

test(
  "CLI nominal public yüzey ve gerçek type import'u kodsuz geliştirme mesajıyla fail-closed tutar",
  async () => {
    await proje(
      { "ana.ata": '"modeller" kullan', "modeller.ata": modeller },
      async (_sonuç, kök) => {
        const cli = fileURLToPath(new URL("../src/cli/cli.ts", import.meta.url));
        for (const [gövde, mesaj] of [
          [
            '"modeller" kullan\nmodeller::kişi_al() yazdır',
            "Modüller arası kullanıcı tanımlı tipler bu geliştirme sürümünde henüz desteklenmiyor.",
          ],
          [
            '"modeller" içinden K kullan',
            "Modüller arası tip kullanımı bu geliştirme sürümünde henüz desteklenmiyor.",
          ],
        ]) {
          // eslint-disable-next-line no-await-in-loop -- Geliştirme guard'ları ayrı CLI çağrılarında doğrulanır.
          await Bun.write(join(kök, "ana.ata"), gövde!);
          const sonuç = Bun.spawnSync(
            [process.execPath, "run", cli, "denetle", join(kök, "ana.ata")],
            { cwd: tmpdir() },
          );
          expect(sonuç.exitCode).toBe(1);
          expect(sonuç.stdout.toString()).toBe("");
          expect(sonuç.stderr.toString()).toContain(mesaj!);
          expect(sonuç.stderr.toString()).not.toContain("ATA6004");
          expect(sonuç.stderr.toString()).not.toContain("Error:");
        }
      },
    );
  },
  ENTEGRASYON_ZAMAN_ASIMI_MS,
);
