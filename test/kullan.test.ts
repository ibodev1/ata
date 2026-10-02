import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ENTEGRASYON_ZAMAN_ASIMI_MS } from "./entegrasyon.ts";
import { analizEt, ayrıştır, kaynakOluştur, sözcüklereAyır, yorumla } from "../src/index.ts";

test("kullan keyword'leri ayrılmıştır; identifier önekleri ve içindeki korunur", () => {
  const sonuç = sözcüklereAyır(
    kaynakOluştur("kullan.ata", "kullan içinden olarak kullanıcı içindense olaraklı içindeki"),
  );
  expect(sonuç.tanılar).toEqual([]);
  expect(sonuç.tokenlar.map((token) => token.tokenType.name)).toEqual([
    "kullan",
    "içinden",
    "olarak",
    "Tanımlayıcı",
    "Tanımlayıcı",
    "Tanımlayıcı",
    "içindeki",
  ]);
});

test("kullan yolu decoded statik yazıdır; path semantiği henüz doğrulanmaz", () => {
  for (const [literal, yol] of [
    ['"yardımcı/\\{özel\\}\\\"ad\\\\son\\n"', 'yardımcı/{özel}"ad\\son\n'],
    ['"../matematik"', "../matematik"],
    ['"matematik.ata"', "matematik.ata"],
    ['"C:/proje/modül"', "C:/proje/modül"],
    ['"https://örnek/modül"', "https://örnek/modül"],
    ['""', ""],
  ]) {
    const sonuç = ayrıştır(kaynakOluştur("kullan.ata", `${literal} kullan`));
    expect(sonuç.tanılar).toEqual([]);
    expect(sonuç.program?.kullanBildirimleri[0]?.yol).toBe(yol);
  }
});

test("yorumlar, boş ayırıcılar ve mevcut semicolon import önekini bozmaz", () => {
  for (const ayırıcı of ["\n", "\r\n", "; ", ";\n"]) {
    const sonuç = ayrıştır(
      kaynakOluştur(
        "kullan.ata",
        `// açıklama\n"a" kullan${ayırıcı}/* yorum */ "b" kullan${ayırıcı}sabit x = 1`,
      ),
    );
    expect(sonuç.tanılar).toEqual([]);
    expect(sonuç.program?.kullanBildirimleri.map((kullan) => kullan.yol)).toEqual(["a", "b"]);
    expect(sonuç.program?.bildirimler).toHaveLength(1);
  }
});

test("ilk normal bildirim import önekini kapatır ve geç kullanım ATA6006 alır", () => {
  for (const bildirim of [
    "sabit x = 1",
    "işlev f(): hiç {}",
    "yapı K {}",
    "seçenek D { açık }",
    '"merhaba" yazdır',
  ]) {
    const sonuç = ayrıştır(kaynakOluştur("konum.ata", `"a" kullan\n${bildirim}\n"b" kullan`));
    expect(sonuç.program).toBeNull();
    expect(sonuç.tanılar).toHaveLength(1);
    expect(sonuç.tanılar[0]).toMatchObject({
      kod: "ATA6006",
      yol: "konum.ata",
      mesaj: "'kullan' bildirimi yalnızca dosyanın başında kullanılabilir.",
      aralık: { başlangıç: { satır: 3, sütun: 1 }, bitiş: { satır: 3, sütun: 11 } },
    });
  }
});

test("bütün blok taşıyıcılarında düzgün import syntax'ı ATA6006 alır", () => {
  for (const [baş, son] of [
    ["{", "}"],
    ["işlev f(): hiç {", "}"],
    ["eğer doğru ise {", "}"],
    ["eğer doğru ise {} değilse eğer yanlış ise {} değilse {", "}"],
    ["doğru iken {", "}"],
    ["[1] içindeki her sayı için {", "}"],
    ["Durum::açık eşleştir { diğer ise {", "} }"],
  ]) {
    const sonuç = ayrıştır(kaynakOluştur("blok.ata", `${baş}\n  "m" mat olarak kullan\n${son}`));
    expect(sonuç.program).toBeNull();
    expect(sonuç.tanılar.map((tanı) => tanı.kod)).toEqual(["ATA6006"]);
    expect(sonuç.tanılar[0]?.aralık.başlangıç).toMatchObject({ satır: 2, sütun: 3 });
  }
  expect(ayrıştır(kaynakOluştur("sonraki.ata", '"m" kullan')).tanılar).toEqual([]);
});

test("desteklenmeyen kullan grammar'ı expression'a veya import'a dönüşmez", () => {
  for (const metin of [
    'kullan "m"',
    '"m" olarak mat kullan',
    '"m" içinden kullan',
    '"m" içinden topla, kullan',
    '"m" içinden * kullan',
    '"m" mat kullan',
    '"m" mat olarak',
    '"m" içinden topla toplam olarak kullan',
    'sabit modül = "m" kullan',
    '("m" kullan) yazdır',
    "modül kullan",
    '("m") kullan',
    "f() kullan",
    '"{modül}" kullan',
    '"yardımcı/{ad}" kullan',
    '"m" içinden\n topla kullan',
    '"m" mat\n olarak kullan',
    '"m"\n kullan',
    '"m" /* iki\nsatır */ kullan',
  ]) {
    const sonuç = ayrıştır(kaynakOluştur("hata.ata", metin));
    expect(sonuç.program, metin).toBeNull();
    expect(
      sonuç.tanılar.map((tanı) => tanı.kod),
      metin,
    ).toEqual(["ATA2001"]);
  }
});

test("yeni keyword'ler ad olamaz; sayı istisnası yalnız eski ad bağlamlarında kalır", () => {
  for (const ad of ["kullan", "içinden", "olarak"])
    expect(
      ayrıştır(kaynakOluştur("hata.ata", `sabit ${ad} = 1`)).tanılar.map((tanı) => tanı.kod),
    ).toEqual(["ATA2001"]);
  for (const ad of ["sayı", "işlev", "kullan", "123"])
    expect(
      ayrıştır(kaynakOluştur("hata.ata", `"m" ${ad} olarak kullan`)).tanılar.map(
        (tanı) => tanı.kod,
      ),
    ).toEqual(["ATA2001"]);
  expect(
    ayrıştır(kaynakOluştur("ad.ata", '"m" içinden sayı kullan\nsabit sayı = 1')).tanılar,
  ).toEqual([]);
});

test("tekrar kullanım parse edilir; kanonik tekrarları modül isim çözümlemesi denetler", () => {
  // Ön yüz bildirimleri saklar; yol kimliği ve bağlama tekrarları burada denetlenmez.
  const sonuç = ayrıştır(
    kaynakOluştur(
      "kullan.ata",
      '"m" kullan; "m" mat olarak kullan; "m" içinden topla, topla kullan',
    ),
  );
  expect(sonuç.tanılar).toEqual([]);
  expect(sonuç.program?.kullanBildirimleri).toHaveLength(3);
});

test("NFC ve CRLF sonrası yol/ad aralıkları normalleştirilmiş kaynakta kalır", () => {
  const kaynak = kaynakOluştur(
    "unicode.ata",
    '// açıklama\r\n"o\u0308lc\u0327u\u0308ler" o\u0308lc\u0327u\u0308 olarak kullan;',
  );
  const sonuç = ayrıştır(kaynak);
  expect(sonuç.tanılar).toEqual([]);
  expect(sonuç.program?.kullanBildirimleri[0]).toMatchObject({
    yol: "ölçüler",
    yolAralığı: { başlangıç: { satır: 2, sütun: 1 }, bitiş: { satır: 2, sütun: 10 } },
    biçim: {
      tür: "namespace",
      takmaAd: {
        ad: "ölçü",
        aralık: { başlangıç: { satır: 2, sütun: 11 }, bitiş: { satır: 2, sütun: 15 } },
      },
    },
    aralık: { başlangıç: { satır: 2, sütun: 1 }, bitiş: { satır: 2, sütun: 29 } },
  });
});

test("normal yazı başlangıçları, içindeki döngüsü ve seçenek :: davranışı korunur", () => {
  const sonuç = ayrıştır(
    kaynakOluştur(
      "regression.ata",
      `"Merhaba" yazdır
"abc" == "abc" yazdır
sabit sayılar = [1, 2]
sayılar içindeki her sayı için { sayı yazdır }
seçenek Durum { Aktif, Pasif }
Durum::Aktif eşleştir {
  Durum::Aktif ise { "Aktif" yazdır }
  Durum::Pasif ise {}
}`,
    ),
  );
  expect(sonuç.tanılar).toEqual([]);
  const program = sonuç.program;
  if (!program) throw new Error("Program bekleniyordu.");
  expect(program.kullanBildirimleri).toEqual([]);
  expect(program.bildirimler[0]).toMatchObject({
    tür: "yazdır",
    ifade: { tür: "yazı", parçalar: [{ tür: "metin", değer: "Merhaba" }] },
  });
  expect(analizEt(program).tanılar).toEqual([]);
  const çıktı: string[] = [];
  expect(yorumla(program, { çıktıYaz: (satır) => çıktı.push(satır) }).tanılar).toEqual([]);
  expect(çıktı).toEqual(["Merhaba", "doğru", "1", "2", "Aktif"]);
});

test(
  "CLI geçerli kullan graph'ını denetlerken gövdeleri çalıştırmaz; çalıştır sırasında dependency input'unu okur",
  async () => {
    const geçici = await mkdtemp(join(tmpdir(), "ata-kullan-"));
    try {
      const dosya = join(geçici, "ana.ata");
      await Bun.write(dosya, '"yardımcı" kullan\n"ana" yazdır');
      await Bun.write(join(geçici, "yardımcı.ata"), 'girdi("DEPENDENCY ÇALIŞTI") yazdır');
      const cli = fileURLToPath(new URL("../src/cli/cli.ts", import.meta.url));
      for (const komut of ["denetle", "çalıştır"]) {
        const sonuç = Bun.spawnSync([process.execPath, "run", cli, komut, dosya], {
          cwd: geçici,
          stdin: Buffer.from("Ata\n"),
        });
        expect(sonuç.exitCode).toBe(0);
        expect(sonuç.stdout.toString()).toBe(
          komut === "denetle" ? "Denetim başarılı.\n" : "DEPENDENCY ÇALIŞTIAta\nana\n",
        );
        expect(sonuç.stderr.toString()).toBe("");
      }
    } finally {
      await rm(geçici, { recursive: true, force: true });
    }
  },
  ENTEGRASYON_ZAMAN_ASIMI_MS,
);

test("namespace kullan bildirimi statik yoluyla normal gövdeden ayrılır", () => {
  const sonuç = ayrıştır(kaynakOluştur("kullan.ata", '"matematik" kullan\nsabit x = 1'));
  expect(sonuç.tanılar).toEqual([]);
  expect(sonuç.program).toMatchObject({
    kullanBildirimleri: [
      { tür: "kullan", yol: "matematik", biçim: { tür: "namespace", takmaAd: null } },
    ],
    bildirimler: [{ tür: "sabit", ad: "x" }],
  });
});

test("namespace takma adı doğal sırayla ve kendi kaynak aralığıyla taşınır", () => {
  const sonuç = ayrıştır(kaynakOluştur("kullan.ata", '"yardımcı/matematik" mat olarak kullan'));
  expect(sonuç.tanılar).toEqual([]);
  expect(sonuç.program?.kullanBildirimleri[0]).toMatchObject({
    yol: "yardımcı/matematik",
    yolAralığı: { başlangıç: { ofset: 0 }, bitiş: { ofset: 20 } },
    aralık: { başlangıç: { ofset: 0 }, bitiş: { ofset: 38 } },
    biçim: {
      tür: "namespace",
      takmaAd: { ad: "mat", aralık: { başlangıç: { ofset: 21 }, bitiş: { ofset: 24 } } },
    },
  });
});

test("seçici kullanım boş olmayan ad listesini ve her adın aralığını korur", () => {
  for (const metin of ['"m" içinden topla kullan', '"m" içinden topla, çıkar, çarp kullan']) {
    const sonuç = ayrıştır(kaynakOluştur("kullan.ata", metin));
    expect(sonuç.tanılar).toEqual([]);
    const kullan = sonuç.program?.kullanBildirimleri[0];
    expect(kullan?.biçim.tür).toBe("seçici");
    if (kullan?.biçim.tür !== "seçici") throw new Error("Seçici kullanım bekleniyordu.");
    expect(kullan.biçim.adlar.map((ad) => ad.ad)).toEqual(
      metin.includes(",") ? ["topla", "çıkar", "çarp"] : ["topla"],
    );
    expect(kullan.biçim.adlar[0].aralık).toMatchObject({
      başlangıç: { ofset: 12 },
      bitiş: { ofset: 17 },
    });
    for (const ad of kullan.biçim.adlar)
      expect(metin.slice(ad.aralık.başlangıç.ofset, ad.aralık.bitiş.ofset)).toBe(ad.ad);
  }
});
