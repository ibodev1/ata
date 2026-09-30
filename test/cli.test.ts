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
  expect(komutÇalıştır("sürüm")).toEqual({ kod: 0, çıktı: "Ata Dil 0.1.0-dev.6\n", hata: "" });
});

test("CLI yapı örneğini denetler ve alan/indeks zincirlerini çalıştırır", () => {
  const yol = Bun.file(new URL("../örnekler/yapılar.ata", import.meta.url)).name!;
  expect(komutÇalıştır("denetle", yol)).toEqual({ kod: 0, çıktı: "Denetim başarılı.\n", hata: "" });
  expect(komutÇalıştır("çalıştır", yol)).toEqual({
    kod: 0,
    çıktı: "İbrahim, Konya\nAyşe\n",
    hata: "",
  });
});

test.each([
  { metin: "sabit k: Olmayan = 1", kod: "ATA3004", komut: "denetle" },
  { metin: "yapı K { ad: yazı }; K {}", kod: "ATA4017", komut: "denetle" },
  { metin: "yapı K {}; K { x: 1 }", kod: "ATA4019", komut: "denetle" },
  { metin: "yapı K { ad: yazı }; K { ad: 1 }", kod: "ATA4001", komut: "denetle" },
  { metin: "[1][1.5] yazdır", kod: "ATA5008", komut: "çalıştır" },
  { metin: "[1][1] yazdır", kod: "ATA5009", komut: "çalıştır" },
])("CLI yapı/indeks hatasını tanılar ve çıkış kodu 1 verir: %j", async ({ metin, kod, komut }) => {
  const yol = `${örnekYolu}.${crypto.randomUUID()}.ata`;
  try {
    await Bun.write(yol, metin);
    const sonuç = komutÇalıştır(komut, yol);
    expect(sonuç.kod).toBe(1);
    expect(sonuç.hata).toContain(`${kod} (hata):`);
    expect(sonuç.hata).toContain(":1:");
    expect(sonuç.hata).not.toContain("Error:");
    expect(sonuç.çıktı).toBe("");
    if (komut === "çalıştır")
      expect(komutÇalıştır("denetle", yol)).toEqual({
        kod: 0,
        çıktı: "Denetim başarılı.\n",
        hata: "",
      });
  } finally {
    await Bun.file(yol).delete();
  }
});

test("CLI yardımı ve argümansız kullanım Türkçedir", () => {
  for (const argümanlar of [["yardım"], []]) {
    const sonuç = komutÇalıştır(...argümanlar);
    expect(sonuç.kod).toBe(0);
    expect(sonuç.çıktı).toContain("Kullanım:");
    expect(sonuç.çıktı).toContain("çalıştır <dosya>");
    expect(sonuç.çıktı).toContain("denetle <dosya>");
  }
});

test("CLI denetle örneği çalıştırmadan başarılı denetim bildirir", () => {
  expect(komutÇalıştır("denetle", örnekYolu)).toEqual({
    kod: 0,
    çıktı: "Denetim başarılı.\n",
    hata: "",
  });
});

test.each([
  { metin: "1 / 0 yazdır", kod: undefined },
  { metin: 'girdi("Ad: ") yazdır', kod: undefined },
  { metin: "sabit a = @", kod: "ATA1001" },
  { metin: "eğer doğru {}", kod: "ATA2001" },
  { metin: "olmayan yazdır", kod: "ATA3001" },
  { metin: "büyük_harf(42)", kod: "ATA4005" },
])("CLI denetle ortak ön yüzü kullanır, runtime'a girmez: %j", async ({ metin, kod }) => {
  const yol = `${örnekYolu}.${crypto.randomUUID()}.ata`;
  try {
    await Bun.write(yol, metin);
    const sonuç = komutÇalıştır("denetle", yol);
    expect(sonuç.kod).toBe(kod ? 1 : 0);
    expect(sonuç.çıktı).toBe(kod ? "" : "Denetim başarılı.\n");
    if (kod) expect(sonuç.hata).toContain(`${kod} (hata):`);
    else expect(sonuç.hata).toBe("");
  } finally {
    await Bun.file(yol).delete();
  }
});

test.each([
  { argümanlar: ["denetle"] },
  { argümanlar: ["denetle", "bir.ata", "iki.ata"] },
  { argümanlar: ["denetle", "örnek.txt"] },
  { argümanlar: ["denetle", "bulunmayan.ata"] },
])("CLI denetle yanlış çağrıyı reddeder: %j", ({ argümanlar }) => {
  const sonuç = komutÇalıştır(...argümanlar);
  expect(sonuç.kod).toBe(1);
  expect(sonuç.çıktı).toBe("");
  expect(sonuç.hata.length).toBeGreaterThan(0);
});

test("CLI yerleşik çağrı zincirini yürütür", async () => {
  const yol = `${örnekYolu}.${crypto.randomUUID()}.ata`;
  try {
    await Bun.write(
      yol,
      'sabit ad = büyük_harf("ata"); sabit boyut = uzunluk(ad); "{ad}: {boyut}" yazdır',
    );
    expect(komutÇalıştır("çalıştır", yol)).toEqual({ kod: 0, çıktı: "ATA: 3\n", hata: "" });
  } finally {
    await Bun.file(yol).delete();
  }
});

test("CLI istemsiz ve ardışık girdilerde satırları karıştırmaz", async () => {
  const yol = `${örnekYolu}.${crypto.randomUUID()}.ata`;
  try {
    await Bun.write(yol, 'girdi() yazdır; girdi("İkinci:") yazdır');
    const sonuç = Bun.spawnSync([process.execPath, "run", cliYolu, "çalıştır", yol], {
      stdin: Buffer.from("😊\r\nAta\n"),
    });
    expect(sonuç.exitCode).toBe(0);
    expect(sonuç.stdout.toString()).toBe("😊\nİkinci:Ata\n");
    expect(sonuç.stderr.toString()).toBe("");
  } finally {
    await Bun.file(yol).delete();
  }
});

test("CLI bozuk UTF-8 girdisini ham exception sızdırmadan tanılar", () => {
  const yol = Bun.file(new URL("../örnekler/girdi.ata", import.meta.url)).name!;
  const sonuç = Bun.spawnSync([process.execPath, "run", cliYolu, "çalıştır", yol], {
    stdin: new Uint8Array([0xc3, 0x28, 10]),
  });
  expect(sonuç.exitCode).toBe(1);
  expect(sonuç.stderr.toString()).toContain("ATA5007 (hata): Girdi okunamadı.");
  expect(sonuç.stderr.toString()).not.toContain("TypeError");
});

test.each([
  { girdi: "İbrahim\n", kod: 0, çıktı: "Adınız: Merhaba İBRAHİM!\n" },
  { girdi: "  ısparta  \r\n", kod: 0, çıktı: "Adınız: Merhaba ISPARTA!\n" },
  { girdi: "\n", kod: 0, çıktı: "Adınız: Merhaba !\n" },
  { girdi: "Ata", kod: 0, çıktı: "Adınız: Merhaba ATA!\n" },
  { girdi: "", kod: 1, çıktı: "Adınız: " },
])("CLI istemi aynen gösterir, UTF-8 satırı okur ve EOF'u tanılar: %j", ({ girdi, kod, çıktı }) => {
  const yol = Bun.file(new URL("../örnekler/girdi.ata", import.meta.url)).name!;
  const sonuç = Bun.spawnSync([process.execPath, "run", cliYolu, "çalıştır", yol], {
    stdin: Buffer.from(girdi),
  });
  expect(sonuç.exitCode).toBe(kod);
  expect(sonuç.stdout.toString()).toBe(çıktı);
  if (kod) {
    expect(sonuç.stderr.toString()).toContain("ATA5007 (hata): Girdi okunamadı.");
    expect(sonuç.stderr.toString()).not.toContain("Error:");
  } else expect(sonuç.stderr.toString()).toBe("");
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
