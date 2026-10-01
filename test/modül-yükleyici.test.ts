import { expect, test } from "bun:test";
import { basename } from "node:path";
import { mkdir, mkdtemp, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { modülleriYükle } from "../src/modüller/yükleyici.ts";
import { ENTEGRASYON_ZAMAN_ASIMI_MS } from "./entegrasyon.ts";

const fixture = (yol: string) =>
  fileURLToPath(new URL(`./fixtures/moduller/${yol}`, import.meta.url));

test("elmas graph dört modülü bir kez yükler, dört edge ve dependency-first sıra taşır", async () => {
  const sonuç = await modülleriYükle(fixture("elmas/ana.ata"));
  expect(sonuç.tanılar).toEqual([]);
  const grafik = sonuç.grafik;
  if (!grafik) throw new Error("Başarılı graph bekleniyordu.");
  expect(grafik.modüller.size).toBe(4);
  expect(grafik.sıra.map((modül) => basename(modül.kanonikYol))).toEqual([
    "ortak.ata",
    "a.ata",
    "b.ata",
    "ana.ata",
  ]);
  expect(grafik.giriş.bağımlılıklar.map((kenar) => kenar.bildirim.yol)).toEqual(["a", "b"]);
  expect(grafik.sıra.flatMap((modül) => modül.bağımlılıklar)).toHaveLength(4);
  const [ortak, a, b, ana] = grafik.sıra;
  expect(ana).toBe(grafik.giriş);
  expect(grafik.modüller.get(a!.bağımlılıklar[0]!.hedefYol)).toBe(ortak);
  expect(grafik.modüller.get(b!.bağımlılıklar[0]!.hedefYol)).toBe(ortak);
});

test("iç içe yollar her importerin canonical dizinine göre çözülür", async () => {
  const sonuç = await modülleriYükle(fixture("ic-ice/ana.ata"));
  expect(sonuç.tanılar).toEqual([]);
  expect(sonuç.grafik?.sıra.map((modül) => basename(modül.kanonikYol))).toEqual([
    "ortak.ata",
    "işlem.ata",
    "ana.ata",
  ]);
});

test("aynı canonical hedefin textual varyasyonları ayrı AST kenarlarıyla tek kayda bağlanır", async () => {
  await geçiciProje(
    {
      "ana.ata":
        '"matematik" kullan\n"./matematik" içinden x kullan\n"alt/../matematik" mat olarak kullan',
      "matematik.ata": "sabit x = 1",
    },
    async (kök) => {
      const sonuç = await modülleriYükle(join(kök, "ana.ata"));
      expect(sonuç.tanılar).toEqual([]);
      const grafik = sonuç.grafik!;
      expect(grafik.modüller.size).toBe(2);
      const kenarlar = grafik.giriş.bağımlılıklar;
      expect(kenarlar).toHaveLength(3);
      expect(new Set(kenarlar.map((kenar) => kenar.hedefYol)).size).toBe(1);
      for (const [i, kenar] of kenarlar.entries())
        expect(kenar.bildirim).toBe(grafik.giriş.program.kullanBildirimleri[i]!);
    },
  );
});

test("cache çağrıya özeldir; dosya değişikliği sonraki yüklemede yeniden okunur", async () => {
  await geçiciProje({ "ana.ata": '"m" kullan', "m.ata": "sabit x = 1" }, async (kök) => {
    const önce = await modülleriYükle(join(kök, "ana.ata"));
    await Bun.write(join(kök, "m.ata"), "sabit x = 2");
    const sonra = await modülleriYükle(join(kök, "ana.ata"));
    expect(önce.grafik?.sıra[0]?.kaynak.içerik).toBe("sabit x = 1");
    expect(sonra.grafik?.sıra[0]?.kaynak.içerik).toBe("sabit x = 2");
    expect(sonra.grafik?.sıra[0]).not.toBe(önce.grafik?.sıra[0]);
  });
});

test("Unicode, boşluk ve noktalı parent dizinleri kaynak NFC davranışıyla yüklenir", async () => {
  await geçiciProje(
    {
      "ana.ata": '"v1.0/yardımcı dosyalar/ölçüler" mat olarak kullan',
      "v1.0/yardımcı dosyalar/ölçüler.ata": "sabit o\u0308lc\u0327u\u0308 = 1",
    },
    async (kök) => {
      const sonuç = await modülleriYükle(join(kök, "ana.ata"));
      expect(sonuç.tanılar).toEqual([]);
      expect(sonuç.grafik?.sıra[0]?.kaynak.içerik).toBe("sabit ölçü = 1");
      expect(basename(sonuç.grafik!.sıra[0]!.kanonikYol)).toBe("ölçüler.ata");
    },
  );
});

test("junction/symlink entry canonical base'i ve ortak dependency kimliğini korur", async () => {
  await geçiciProje(
    {
      "gerçek/ana.ata": '"lib/yardımcı" kullan\n"../alias/görünen/lib/yardımcı" mat olarak kullan',
      "gerçek/lib/yardımcı.ata": '"../ortak" kullan',
      "gerçek/ortak.ata": "sabit x = 1",
    },
    async (kök) => {
      await mkdir(join(kök, "alias"));
      await symlink(
        join(kök, "gerçek"),
        join(kök, "alias/görünen"),
        process.platform === "win32" ? "junction" : "dir",
      );
      const sonuç = await modülleriYükle(join(kök, "alias/görünen/ana.ata"));
      expect(sonuç.tanılar).toEqual([]);
      const grafik = sonuç.grafik!;
      expect(grafik.giriş.kanonikYol).toBe(await realpath(join(kök, "gerçek/ana.ata")));
      expect(grafik.modüller.size).toBe(3);
      expect(grafik.giriş.bağımlılıklar[0]?.hedefYol).toBe(grafik.giriş.bağımlılıklar[1]?.hedefYol);
      expect(grafik.sıra.map((modül) => basename(modül.kanonikYol))).toEqual([
        "ortak.ata",
        "yardımcı.ata",
        "ana.ata",
      ]);
    },
  );
});

test("self-cycle normalleştirilmiş ve symlink yolu üzerinden de reddedilir", async () => {
  await geçiciProje({ "gerçek/a.ata": '"../görünen/alt/../a" kullan' }, async (kök) => {
    await symlink(
      join(kök, "gerçek"),
      join(kök, "görünen"),
      process.platform === "win32" ? "junction" : "dir",
    );
    const sonuç = await modülleriYükle(join(kök, "gerçek/a.ata"));
    expect(sonuç.grafik).toBeNull();
    expect(sonuç.tanılar.map((tanı) => [tanı.kod, tanı.mesaj])).toEqual([
      ["ATA6003", "Döngüsel modül bağımlılığı: a.ata -> a.ata"],
    ]);
  });
});

test("eksik, dizin, decoded geçersiz yol ve bozuk UTF-8 import literalinde tanılanır", async () => {
  for (const [literal, kod, mesaj] of [
    ['"metin"', "ATA6001", "Modül dosyası bulunamadı: 'metin.ata'."],
    ['"dizin"', "ATA6002", "Modül hedefi normal dosya değil: 'dizin.ata'."],
    ['"m.ata"', "ATA6002", "Modül yolu açık dosya uzantısı içermemelidir."],
    ['"a\\\\b"', "ATA6002", "Modül yolunda yalnız '/' ayırıcı kullanılabilir."],
    ['"a\\nb"', "ATA6002", "Modül yolunda kontrol karakteri kullanılamaz."],
    [
      '"bozuk"',
      "ATA6008",
      "Modül okunamadı veya kanonikleştirilemedi: 'bozuk.ata'. Dosyanın okuma iznini ve UTF-8 kodlamasını kontrol edin.",
    ],
  ] as const) {
    // eslint-disable-next-line no-await-in-loop -- Her hata senaryosu tamamen temizlendikten sonra diğeri kurulur.
    await geçiciProje(
      { "ana.ata": `// başlık\n${literal} kullan`, "bozuk.ata": new Uint8Array([0xc3, 0x28]) },
      async (kök) => {
        await mkdir(join(kök, "dizin.ata"));
        const sonuç = await modülleriYükle(join(kök, "ana.ata"));
        expect(sonuç.grafik).toBeNull();
        expect(sonuç.tanılar).toHaveLength(1);
        expect(sonuç.tanılar[0]).toMatchObject({
          kod,
          mesaj,
          aralık: {
            başlangıç: { satır: 2, sütun: 1 },
            bitiş: { satır: 2, sütun: literal.length + 1 },
          },
        });
        expect(sonuç.tanılar[0]?.yol).toBe(await realpath(join(kök, "ana.ata")));
      },
    );
  }
});

test("hatalı ortak dependency bir kez parse edilir; bağımsız dalların tanı sırası stabildir", async () => {
  await geçiciProje(
    {
      "ana.ata": '"a" kullan\n"b" kullan\n"c" kullan',
      "a.ata": '"bozuk" kullan',
      "b.ata": '"./bozuk" kullan',
      "bozuk.ata": "sabit = 1",
      "c.ata": "@",
      "kullanılmayan.ata": "@",
    },
    async (kök) => {
      const sonuç = await modülleriYükle(join(kök, "ana.ata"));
      expect(sonuç.grafik).toBeNull();
      expect(sonuç.tanılar.map((tanı) => [basename(tanı.yol), tanı.kod])).toEqual([
        ["bozuk.ata", "ATA2001"],
        ["c.ata", "ATA1001"],
      ]);
      expect(sonuç.kaynaklar.size).toBe(5);
    },
  );
});

test("entry okuma hataları dependency kodlarına dönüştürülmez", async () => {
  await geçiciProje({ "bozuk.ata": new Uint8Array([0xc3, 0x28]) }, async (kök) => {
    await mkdir(join(kök, "dizin.ata"));
    for (const ad of ["olmayan.ata", "bozuk.ata", "dizin.ata"]) {
      // eslint-disable-next-line no-await-in-loop -- Aynı fixture üzerindeki entry sonuçları sırayla doğrulanır.
      const sonuç = await modülleriYükle(join(kök, ad));
      expect(sonuç.grafik).toBeNull();
      expect(sonuç.girişOkunamadı).toBe(true);
      expect(sonuç.tanılar).toEqual([]);
    }
  });
});

const cli = fileURLToPath(new URL("../src/cli/cli.ts", import.meta.url));

test(
  "CLI modül kapsamlarını birleştirmez; dependency-first bütün statik tanıları toplar",
  async () => {
    await geçiciProje(
      {
        "ana.ata": '"a" kullan\n"b" kullan\nsabit x = 1',
        "a.ata": 'sabit x = "a"',
        "b.ata": 'sabit x = "b"',
      },
      async (kök) => {
        const args = [process.execPath, "run", cli, "denetle", join(kök, "ana.ata")];
        expect(Bun.spawnSync(args, { cwd: kök }).exitCode).toBe(0);
        await Bun.write(join(kök, "ana.ata"), '"a" kullan\n"b" kullan\nx yazdır');
        const görünmeyen = Bun.spawnSync(args, { cwd: kök });
        expect(görünmeyen.exitCode).toBe(1);
        expect(görünmeyen.stderr.toString()).toContain("ATA3001");
        await Bun.write(join(kök, "a.ata"), 'sabit x: sayı = "a"');
        await Bun.write(join(kök, "b.ata"), 'sabit x: sayı = "b"');
        const sonuç = Bun.spawnSync(args, { cwd: kök });
        expect(sonuç.exitCode).toBe(1);
        expect(sonuç.stdout.toString()).toBe("");
        const hata = sonuç.stderr.toString();
        expect([...hata.matchAll(/--> (.+):\d+:\d+/g)].map((eşleşme) => eşleşme[1])).toEqual([
          "a.ata",
          "b.ata",
        ]);
        expect(hata.match(/ATA4001/g)).toHaveLength(2);
        expect(hata).not.toContain("ATA3001");
      },
    );
  },
  ENTEGRASYON_ZAMAN_ASIMI_MS,
);

test(
  "CLI repo dışında göreli/absolute entry ile nested Unicode graph'ı denetler",
  async () => {
    await geçiciProje(
      {
        "proje/ana.ata": '"yardımcı dosyalar/ölçüler" mat olarak kullan\n"ana" yazdır',
        "proje/yardımcı dosyalar/ölçüler.ata": "uzunluk([1, 2]) yazdır",
      },
      async (kök) => {
        for (const yol of ["proje/ana.ata", join(kök, "proje/ana.ata")]) {
          const sonuç = Bun.spawnSync([process.execPath, "run", cli, "denetle", yol], { cwd: kök });
          expect(sonuç.exitCode).toBe(0);
          expect(sonuç.stdout.toString()).toBe("Denetim başarılı.\n");
          expect(sonuç.stderr.toString()).toBe("");
        }
      },
    );
  },
  ENTEGRASYON_ZAMAN_ASIMI_MS,
);

test(
  "CLI dependency parser ve tip hatalarını gerçek kaynak satırında gösterir; runtime engeli hatayı gizlemez",
  async () => {
    await geçiciProje(
      { "ana.ata": '"yardımcı/m" kullan\n"ana" yazdır', "yardımcı/m.ata": "" },
      async (kök) => {
        for (const [metin, kod, sütun] of [
          ["sabit = 1", "ATA2001", 7],
          ['sabit x: sayı = "yanlış"', "ATA4001", 17],
        ] as const) {
          // eslint-disable-next-line no-await-in-loop -- Aynı dependency sonraki CLI çağrısından önce değiştirilir.
          await Bun.write(join(kök, "yardımcı/m.ata"), `// bir\n// iki\n// üç\n${metin}`);
          for (const komut of ["denetle", "çalıştır"]) {
            const sonuç = Bun.spawnSync(
              [process.execPath, "run", cli, komut, join(kök, "ana.ata")],
              { cwd: kök },
            );
            expect(sonuç.exitCode).toBe(1);
            expect(sonuç.stdout.toString()).toBe("");
            expect(sonuç.stderr.toString()).toContain(kod);
            expect(sonuç.stderr.toString()).toContain(`yardımcı/m.ata:4:${sütun}`);
            expect(sonuç.stderr.toString()).toContain(`4 │ ${metin}`);
            expect(sonuç.stderr.toString()).not.toContain("henüz desteklenmiyor");
            expect(sonuç.stderr.toString()).not.toContain("Error:");
          }
        }
      },
    );
  },
  ENTEGRASYON_ZAMAN_ASIMI_MS,
);

test(
  "CLI missing dependency ve cycle'ı stacksiz, doğru path span'ıyla gösterir",
  async () => {
    await geçiciProje({ "ana.ata": '"olmayan" kullan' }, async (kök) => {
      const args = [process.execPath, "run", cli, "denetle", join(kök, "ana.ata")];
      const eksik = Bun.spawnSync(args, { cwd: kök });
      expect(eksik.exitCode).toBe(1);
      expect(eksik.stdout.toString()).toBe("");
      expect(eksik.stderr.toString()).toContain("ATA6001");
      expect(eksik.stderr.toString()).toContain("ana.ata:1:1");
      await Bun.write(join(kök, "ana.ata"), '"b" kullan');
      await Bun.write(join(kök, "b.ata"), '"ana" kullan');
      const döngü = Bun.spawnSync(args, { cwd: kök });
      expect(döngü.exitCode).toBe(1);
      expect(döngü.stdout.toString()).toBe("");
      expect(döngü.stderr.toString()).toContain("ATA6003");
      expect(döngü.stderr.toString()).toContain("ana.ata -> b.ata -> ana.ata");
      expect(döngü.stderr.toString()).toContain("b.ata:1:1");
      for (const sonuç of [eksik, döngü])
        expect(sonuç.stderr.toString()).not.toMatch(/Error:|\bat .+\(.*:\d+:\d+\)/);
    });
  },
  ENTEGRASYON_ZAMAN_ASIMI_MS,
);

test("canonical kimlik cycle'ı kapatan yol aralığında zincirli ATA6003 üretir", async () => {
  await geçiciProje(
    { "a.ata": '"alt/../b" kullan', "b.ata": '// kapanış\n"./a" kullan' },
    async (kök) => {
      const sonuç = await modülleriYükle(join(kök, "a.ata"));
      expect(sonuç.grafik).toBeNull();
      expect(sonuç.tanılar).toHaveLength(1);
      expect(sonuç.tanılar[0]).toMatchObject({
        kod: "ATA6003",
        mesaj: "Döngüsel modül bağımlılığı: a.ata -> b.ata -> a.ata",
        aralık: { başlangıç: { satır: 2, sütun: 1 }, bitiş: { satır: 2, sütun: 6 } },
      });
      expect(basename(sonuç.tanılar[0]!.yol)).toBe("b.ata");
    },
  );
});

async function geçiciProje(
  dosyalar: Record<string, string | Uint8Array>,
  sınama: (kök: string) => Promise<void>,
) {
  const kök = await mkdtemp(join(tmpdir(), "ata-modül-"));
  try {
    await Promise.all(
      Object.entries(dosyalar).map(([ad, metin]) => Bun.write(join(kök, ad), metin)),
    );
    await sınama(kök);
  } finally {
    await rm(kök, { recursive: true, force: true });
  }
}

test("dependency parse hatası kendi kaynağında kalır; hatalı AST graph'a alınmaz", async () => {
  await geçiciProje(
    { "ana.ata": '"bozuk" kullan\n"ana" yazdır', "bozuk.ata": "// yardımcı\nsabit = 1" },
    async (kök) => {
      const sonuç = await modülleriYükle(join(kök, "ana.ata"));
      expect(sonuç.grafik).toBeNull();
      expect(sonuç.girişOkunamadı).toBe(false);
      expect(sonuç.tanılar).toHaveLength(1);
      expect(sonuç.tanılar[0]).toMatchObject({
        kod: "ATA2001",
        aralık: { başlangıç: { satır: 2, sütun: 7 } },
      });
      const tanı = sonuç.tanılar[0]!;
      expect(basename(tanı.yol)).toBe("bozuk.ata");
      expect(sonuç.kaynaklar.get(tanı.yol)?.içerik).toBe("// yardımcı\nsabit = 1");
    },
  );
});
