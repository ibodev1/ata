import { expect, test } from "bun:test";

const cliYolu = Bun.file(new URL("../src/cli/cli.ts", import.meta.url)).name!;
const örnekYolu = Bun.file(new URL("../örnekler/merhaba.ata", import.meta.url)).name!;

function komutÇalıştır(...argümanlar: string[]) {
  const sonuç = Bun.spawnSync([process.execPath, "run", cliYolu, ...argümanlar]);
  const çözücü = new TextDecoder();
  return {
    kod: sonuç.exitCode,
    çıktı: çözücü.decode(sonuç.stdout),
    hata: çözücü.decode(sonuç.stderr),
  };
}

test("CLI sürümü gösterir", () => {
  expect(komutÇalıştır("sürüm")).toEqual({ kod: 0, çıktı: "Ata Dil 0.1.0-dev.4\n", hata: "" });
});

test("CLI yardımı ve argümansız kullanım Türkçedir", () => {
  for (const argümanlar of [["yardım"], []]) {
    const sonuç = komutÇalıştır(...argümanlar);
    expect(sonuç.kod).toBe(0);
    expect(sonuç.çıktı).toContain("Kullanım:");
    expect(sonuç.çıktı).toContain("çalıştır <dosya>");
  }
});

test("CLI örnek programı yürütür ve yalnızca gerçek çıktısını gösterir", () => {
  const sonuç = komutÇalıştır("çalıştır", örnekYolu);
  expect(sonuç.kod).toBe(0);
  expect(sonuç.hata).toBe("");
  expect(sonuç.çıktı).toBe("Merhaba İbrahim!\nAta Dil çalışıyor.\n");
});

test.each([
  { metin: "1 / 0 yazdır", kod: "ATA5001" },
  { metin: "1 % 0 yazdır", kod: "ATA5002" },
  { metin: 'işlev f(): hiç {}\n"{f()}" yazdır', kod: "ATA4016" },
])(
  "CLI çalışma zamanı ve yerleştirme hatasında tanı ve çıkış kodu 1 verir: %j",
  async ({ metin, kod }) => {
    const yol = `${örnekYolu}.${crypto.randomUUID()}.ata`;
    try {
      await Bun.write(yol, metin);
      const sonuç = komutÇalıştır("çalıştır", yol);
      expect(sonuç.kod).toBe(1);
      expect(sonuç.hata).toContain(`${kod} (hata):`);
      expect(sonuç.hata).not.toContain("Error:");
      expect(sonuç.çıktı).toBe("");
    } finally {
      await Bun.file(yol).delete();
    }
  },
);

test("CLI temeller örneğinde işlevler, liste, iken ve koşul yürütülür", () => {
  const yol = Bun.file(new URL("../örnekler/temeller.ata", import.meta.url)).name!;
  expect(komutÇalıştır("çalıştır", yol)).toEqual({
    kod: 0,
    hata: "",
    çıktı: "Toplam: 15\n1 → 1\n2 → 4\n3 → 9\nSayaç: 0\nSayaç: 1\nSayaç: 2\nTamamlandı.\n",
  });
});

test.each([
  { metin: "olmayan yazdır", kod: "ATA3001" },
  { metin: "sabit sayı = 1\nsabit sayı = 2", kod: "ATA3002" },
  { metin: 'sabit yaş: sayı = "21"', kod: "ATA4001" },
  { metin: "sabit sayı = 1\nsayı = 2", kod: "ATA4003" },
  { metin: "işlev f(a: sayı): sayı { a döndür }\nf()", kod: "ATA4004" },
  { metin: "işlev f(): sayı {}", kod: "ATA4007" },
])("CLI anlamsal hatada %j tanısı ve çıkış kodu 1 döndürür", async ({ metin, kod }) => {
  const yol = `${örnekYolu}.${crypto.randomUUID()}.ata`;
  try {
    await Bun.write(yol, metin);
    const sonuç = komutÇalıştır("çalıştır", yol);
    expect(sonuç.kod).toBe(1);
    expect(sonuç.hata).toContain(`${kod} (hata):`);
    expect(sonuç.çıktı).toBe("");
  } finally {
    await Bun.file(yol).delete();
  }
});

test("CLI ayrıştırma hatasında Türkçe ATA2xxx tanısı ve çıkış kodu 1 döndürür", async () => {
  const yol = `${örnekYolu}.${crypto.randomUUID()}.ata`;
  try {
    await Bun.write(yol, "eğer doğru { }");
    const sonuç = komutÇalıştır("çalıştır", yol);
    expect(sonuç.kod).toBe(1);
    expect(sonuç.hata).toContain("ATA2001 (hata): 'ise' bekleniyordu.");
    expect(sonuç.hata).toContain(":1:12");
    expect(sonuç.çıktı).toBe("");
  } finally {
    await Bun.file(yol).delete();
  }
});

test.each([
  { argümanlar: ["bilinmeyen"], mesaj: "Bilinmeyen komut" },
  { argümanlar: ["çalıştır"], mesaj: "tek bir dosya yolu" },
  { argümanlar: ["çalıştır", "örnek.txt"], mesaj: "uzantısı '.ata'" },
  { argümanlar: ["çalıştır", "bulunmayan.ata"], mesaj: "Dosya UTF-8 olarak okunamadı" },
  { argümanlar: ["sürüm", "fazladan"], mesaj: "ek argüman kabul etmez" },
  { argümanlar: ["yardım", "fazladan"], mesaj: "ek argüman kabul etmez" },
  { argümanlar: ["çalıştır", "bir.ata", "iki.ata"], mesaj: "tek bir dosya yolu" },
])("CLI yanlış çağrıda sıfır olmayan çıkış kodu döndürür: %j", ({ argümanlar, mesaj }) => {
  const sonuç = komutÇalıştır(...argümanlar);
  expect(sonuç.kod).toBe(1);
  expect(sonuç.hata).toContain(mesaj);
});

test("CLI geçersiz Ata kaynağında tanıyı ve doğru çıkış kodunu gösterir", async () => {
  const yol = `${örnekYolu}.${crypto.randomUUID()}.ata`;
  try {
    await Bun.write(yol, "sabit değer = @");
    const sonuç = komutÇalıştır("çalıştır", yol);
    expect(sonuç.kod).toBe(1);
    expect(sonuç.hata).toContain("ATA1001 (hata): Geçersiz karakter");
    expect(sonuç.hata).toContain(":1:15");
    expect(sonuç.çıktı).toBe("");
  } finally {
    await Bun.file(yol).delete();
  }
});

test("CLI bozuk UTF-8 dosyasında Türkçe okuma hatası döndürür", async () => {
  const yol = `${örnekYolu}.${crypto.randomUUID()}.ata`;
  try {
    await Bun.write(yol, new Uint8Array([0xc3, 0x28]));
    const sonuç = komutÇalıştır("çalıştır", yol);
    expect(sonuç.kod).toBe(1);
    expect(sonuç.hata).toContain("UTF-8");
  } finally {
    await Bun.file(yol).delete();
  }
});
