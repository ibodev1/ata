import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { analizEt, ayrıştır, kaynakOluştur, yorumla } from "../src/index.ts";

function denetle(metin: string) {
  const sonuç = ayrıştır(kaynakOluştur("hiç.ata", metin));
  expect(sonuç.tanılar).toEqual([]);
  if (!sonuç.program) throw new Error("Program bekleniyordu.");
  return { program: sonuç.program, analiz: analizEt(sonuç.program, "hiç.ata") };
}

test("hiç? anotasyonu statik olarak tek kök tanıyla reddedilir", () => {
  const { analiz } = denetle("sabit x: hiç? = yok\nx yazdır");
  expect(analiz.tanılar.map((tanı) => tanı.kod)).toEqual(["ATA4034"]);
  expect(analiz.tanılar[0]).toMatchObject({
    mesaj: "'hiç' yalnızca işlev dönüş tipi olarak kullanılabilir.",
    yol: "hiç.ata",
    aralık: {
      başlangıç: { satır: 1, sütun: 10, ofset: 9 },
      bitiş: { satır: 1, sütun: 13, ofset: 12 },
    },
  });
});

test("hiç çağrı sonucu sabit/değişken başlangıç değerinden çıkarılamaz", () => {
  for (const bağ of ["sabit", "değişken"]) {
    const { analiz } = denetle(`işlev f(): hiç {}; ${bağ} x = f(); x yazdır`);
    expect(analiz.tanılar.map((tanı) => tanı.kod)).toEqual(["ATA4034"]);
  }
});

test("hiç çağrı sonucu liste elemanından bileşik değer tipine sızmaz", () => {
  for (const ifade of [
    "[f()] yazdır",
    "[1,f()] yazdır",
    "[f(),1] yazdır",
    "[[f()]] yazdır",
    "ilk([f()]) yazdır",
    "yazıya([f()]) yazdır",
  ]) {
    const { analiz } = denetle(`işlev f(): hiç {}; ${ifade}`);
    expect(analiz.tanılar.map((tanı) => tanı.kod)).toEqual(["ATA4034"]);
  }
});

const geçersizTipler = [
  "hiç",
  "hiç?",
  "liste<hiç>",
  "liste<hiç?>",
  "liste<liste<hiç>>",
  "liste<hiç>?",
];

test("hiç bütün değer anotasyonlarında, optional ve nested liste içinde reddedilir", () => {
  for (const tip of geçersizTipler) {
    for (const bağ of ["sabit", "değişken"]) {
      const başlangıç = tip.startsWith("liste") ? "[]" : "yok";
      const { analiz } = denetle(`${bağ} x: ${tip} = ${başlangıç}; x yazdır`);
      expect(analiz.tanılar.map((tanı) => tanı.kod)).toEqual(["ATA4034"]);
    }
  }
  const { analiz } = denetle("işlev f(): hiç {}; sabit x: hiç? = f(); x yazdır");
  expect(analiz.tanılar.map((tanı) => tanı.kod)).toEqual(["ATA4034"]);
});

test("hiç parametre anotasyonunda reddedilir, gövde ve argümanda hata zinciri oluşmaz", () => {
  for (const tip of geçersizTipler) {
    const { analiz } = denetle(`işlev f(x: ${tip}): sayı { x yazdır; 1 döndür }; f([])`);
    expect(analiz.tanılar.map((tanı) => tanı.kod)).toEqual(["ATA4034"]);
  }
});

test("hiç yapı alanında reddedilir, constructor ve erişimde hata zinciri oluşmaz", () => {
  for (const tip of geçersizTipler) {
    const { analiz } = denetle(
      `yapı A { değer: ${tip} }; sabit a = A { değer: [] }; a.değer[0].alan yazdır`,
    );
    expect(analiz.tanılar.map((tanı) => tanı.kod)).toEqual(["ATA4034"]);
  }
});

test("yalnızca çıplak hiç dönüş anotasyonudur, bileşik dönüşlerde eksik/uyumsuz dönüş zinciri oluşmaz", () => {
  for (const tip of geçersizTipler.filter((aday) => aday !== "hiç")) {
    for (const gövde of ["", "[] döndür"]) {
      const { analiz } = denetle(`işlev f(): ${tip} { ${gövde} }; f() yazdır`);
      expect(analiz.tanılar.map((tanı) => tanı.kod)).toEqual(["ATA4034"]);
    }
  }
});

test("doğrudan hiç dönüşü, bare return ve standalone çağrı çalışır", () => {
  const { program, analiz } = denetle(
    'yaz(); erken(); işlev yaz(): hiç { "Ata" yazdır }; işlev erken(): hiç { eğer doğru ise { döndür }; "ulaşılmaz" yazdır }; işlev boş(): hiç {}; boş()',
  );
  expect(analiz.tanılar).toEqual([]);
  const çıktı: string[] = [];
  expect(yorumla(program, { çıktıYaz: (satır) => çıktı.push(satır) }).tanılar).toEqual([]);
  expect(çıktı).toEqual(["Ata"]);
  expect([...analiz.işlevİmzaları.values()].map((imza) => imza.dönüş)).toEqual([
    { tür: "hiç" },
    { tür: "hiç" },
    { tür: "hiç" },
  ]);
});

test("zaten reddedilen hiç değer konumlarının kararlı tanıları korunur", () => {
  for (const [kod, beklenenTanı] of [
    ["f() yazdır", "ATA4015"],
    ['"{f()}" yazdır', "ATA4016"],
    ["yazıya(f())", "ATA4005"],
    ["sabit x: sayı = f()", "ATA4001"],
    ["değişken x = 1; x = f()", "ATA4001"],
    ["işlev g(x: sayı): hiç {}; g(f())", "ATA4005"],
    ["yapı A { x: sayı }; A { x: f() }", "ATA4001"],
    ["işlev g(): sayı { f() döndür }", "ATA4006"],
    ["işlev g(): hiç { f() döndür }", "ATA4006"],
    ["f() == f()", "ATA4011"],
  ] as const) {
    const { analiz } = denetle(`işlev f(): hiç {}; ${kod}`);
    expect(analiz.tanılar.map((tanı) => tanı.kod)).toEqual([beklenenTanı]);
  }
});

test("hiç dönüşü yanında optional/yok, daraltma ve builtin liste dönüşleri korunur", () => {
  const { program, analiz } = denetle(`
yapı Kullanıcı { ad: yazı }
değişken ad: yazı? = yok
değişken sayı_değeri: sayı? = yok
değişken kullanıcı: Kullanıcı? = yok
işlev tamamla(): hiç { ad = "Ata"; sayı_değeri = sayıya("23"); kullanıcı = Kullanıcı { ad: "İbrahim" } }
tamamla()
eğer ad != yok ise { büyük_harf(ad) yazdır }
eğer sayı_değeri != yok ise { sayı_değeri + 1 yazdır }
eğer kullanıcı != yok ise { kullanıcı.ad yazdır }
sabit elemanlar: liste<sayı?> = [1, yok]
[al(elemanlar,0), ilk(elemanlar), son(elemanlar)] yazdır
mantığa("doğru") yazdır
`);
  expect(analiz.tanılar).toEqual([]);
  const çıktı: string[] = [];
  expect(yorumla(program, { çıktıYaz: (satır) => çıktı.push(satır) }).tanılar).toEqual([]);
  expect(çıktı).toEqual(["ATA", "24", "İbrahim", "[1, 1, yok]", "doğru"]);
});

test("CLI geçersiz hiç kaynağını denetle/çalıştır sırasında yürütmeden reddeder", async () => {
  const geçici = await mkdtemp(join(tmpdir(), "ata-hiç-"));
  try {
    const yol = join(geçici, "hiç.ata");
    await Bun.write(yol, 'işlev f(): hiç { "çağrılmamalı" yazdır }; sabit x: hiç? = f(); x yazdır');
    for (const komut of ["denetle", "çalıştır"]) {
      const sonuç = Bun.spawnSync(
        [process.execPath, "run", resolve(import.meta.dir, "../src/cli/cli.ts"), komut, yol],
        { cwd: geçici },
      );
      expect(sonuç.exitCode).toBe(1);
      expect(sonuç.stdout.toString()).toBe("");
      expect(sonuç.stderr.toString()).toContain(
        "ATA4034 (hata): 'hiç' yalnızca işlev dönüş tipi olarak kullanılabilir.",
      );
      expect(sonuç.stderr.toString()).not.toContain("ATA5005");
    }
  } finally {
    await rm(geçici, { recursive: true, force: true });
  }
});

test("geçersiz liste<hiç> anotasyonu nested boş listeler için ikinci çıkarım hatası üretmez", () => {
  for (const kod of [
    "sabit x: liste<hiç> = []",
    "sabit x: liste<liste<hiç>> = [[]]",
    "işlev f(x: liste<liste<hiç>>): hiç {}; f([[]])",
    "işlev f(): liste<liste<hiç>> { [[]] döndür }",
  ]) {
    const { analiz } = denetle(kod);
    expect(analiz.tanılar.map((tanı) => tanı.kod)).toEqual(["ATA4034"]);
  }
});
