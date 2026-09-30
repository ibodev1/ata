import { expect, test } from "bun:test";
import { kaynakOluştur } from "../src/index.ts";
import { ayrıştır } from "../src/ayrıştırıcı/ayrıştırıcı.ts";

test("sabit bildirimi AST'de değer, ad ve kaynak aralığı taşır", () => {
  const sonuç = ayrıştır(kaynakOluştur("örnek.ata", 'sabit ad = "Ata"'));
  expect(sonuç.tanılar).toEqual([]);
  expect(sonuç.program?.bildirimler[0]).toEqual({
    tür: "sabit",
    ad: "ad",
    açıkTip: null,
    başlangıç: {
      tür: "yazı",
      değer: "Ata",
      aralık: {
        başlangıç: { satır: 1, sütun: 12, ofset: 11 },
        bitiş: { satır: 1, sütun: 17, ofset: 16 },
      },
    },
    aralık: {
      başlangıç: { satır: 1, sütun: 1, ofset: 0 },
      bitiş: { satır: 1, sütun: 17, ofset: 16 },
    },
  });
});

test.each(["9".repeat(400), "9007199254740993"])(
  "sayı güvenli biçimde temsil edilemiyorsa tanı döndürülür",
  (sayı) => {
    const sonuç = ayrıştır(kaynakOluştur("sayı.ata", sayı));
    expect(sonuç.program).toBeNull();
    expect(sonuç.tanılar[0]?.kod).toBe("ATA2002");
  },
);

test("işlev parametreleri, dönüş tipi ve blok aralıkları korunur", () => {
  const sonuç = ayrıştır(
    kaynakOluştur(
      "işlev.ata",
      "işlev topla(a: sayı, b: sayı): sayı { a + b döndür }\nişlev başlat(): hiç {}",
    ),
  );
  expect(sonuç.tanılar).toEqual([]);
  expect(sonuç.program?.bildirimler[0]).toMatchObject({
    tür: "işlev",
    ad: "topla",
    dönüşTipi: { tür: "temel-tip", ad: "sayı" },
    parametreler: [
      { tür: "parametre", ad: "a", tip: { ad: "sayı" } },
      { tür: "parametre", ad: "b", tip: { ad: "sayı" } },
    ],
    blok: { tür: "blok", bildirimler: [{ tür: "döndür", ifade: { işleç: "+" } }] },
  });
  expect(sonuç.program?.bildirimler[1]).toMatchObject({
    tür: "işlev",
    parametreler: [],
    dönüşTipi: { ad: "hiç" },
    blok: { bildirimler: [] },
  });
});

test("parantez ve iç içe isteğe bağlı liste tipi aralıklarını korur", () => {
  const ifade = ifadeyiAl("(1 + 2) * 3");
  expect(ifade.aralık).toMatchObject({ başlangıç: { ofset: 0 }, bitiş: { ofset: 11 } });
  if (ifade.tür !== "ikili") throw new Error("İkili ifade bekleniyordu.");
  expect(ifade.sol.aralık).toMatchObject({ başlangıç: { ofset: 0 }, bitiş: { ofset: 7 } });
  const sonuç = ayrıştır(kaynakOluştur("tip.ata", "sabit x: liste<yazı?>? = yok"));
  expect(sonuç.program?.bildirimler[0]).toMatchObject({
    açıkTip: {
      tür: "isteğe-bağlı-tip",
      temel: {
        tür: "liste-tipi",
        eleman: { tür: "isteğe-bağlı-tip", temel: { tür: "temel-tip", ad: "yazı" } },
      },
    },
  });
});

test("isteğe bağlı tipin temel aralığı soru işaretinden önceki boşluğu içermez", () => {
  const sonuç = ayrıştır(kaynakOluştur("tip.ata", "sabit x: yazı ? = yok"));
  expect(sonuç.tanılar).toEqual([]);
  expect(sonuç.program?.bildirimler[0]).toMatchObject({
    açıkTip: {
      tür: "isteğe-bağlı-tip",
      aralık: { başlangıç: { ofset: 9 }, bitiş: { ofset: 15 } },
      temel: { aralık: { başlangıç: { ofset: 9 }, bitiş: { ofset: 13 } } },
    },
  });
});

test.each(["\n", "\r\n", ";", ";\n\n", ";\r\n"])("%j bildirim ayırıcısıdır", (ayırıcı) => {
  const sonuç = ayrıştır(kaynakOluştur("ayırıcı.ata", `sabit a = 1${ayırıcı}sabit b = 2;`));
  expect(sonuç.tanılar).toEqual([]);
  expect(sonuç.program?.bildirimler).toHaveLength(2);
});

test.each([
  "sayı",
  "yazı",
  "mantık",
  "hiç",
  "liste<sayı>",
  "liste<yazı>",
  "yazı?",
  "liste<yazı>?",
  "liste<liste<sayı?>>",
  "hiç?",
])("%s tip sözdizimi anlamsal denetim yapılmadan AST'ye taşınır", (tip) => {
  const sonuç = ayrıştır(kaynakOluştur("tip.ata", `sabit x: ${tip} = yok`));
  expect(sonuç.tanılar).toEqual([]);
  const bildirim = sonuç.program?.bildirimler[0];
  if (bildirim?.tür !== "sabit") throw new Error("Sabit bildirimi bekleniyordu.");
  expect(bildirim.açıkTip).not.toBeNull();
});

function ifadeyiAl(metin: string) {
  const sonuç = ayrıştır(kaynakOluştur("ifade.ata", metin));
  expect(sonuç.tanılar).toEqual([]);
  const bildirim = sonuç.program?.bildirimler[0];
  if (bildirim?.tür !== "ifade-bildirimi") throw new Error("İfade bildirimi bekleniyordu.");
  return bildirim.ifade;
}

test.each([
  {
    metin: "1 + 2 * 3",
    beklenen: {
      tür: "ikili",
      işleç: "+",
      sol: { değer: 1 },
      sağ: { işleç: "*", sol: { değer: 2 }, sağ: { değer: 3 } },
    },
  },
  { metin: "1 * 2 + 3", beklenen: { işleç: "+", sol: { işleç: "*" }, sağ: { değer: 3 } } },
  { metin: "a ve b veya c", beklenen: { işleç: "veya", sol: { işleç: "ve" }, sağ: { ad: "c" } } },
  {
    metin: "a == b ve c != d",
    beklenen: { işleç: "ve", sol: { işleç: "==" }, sağ: { işleç: "!=" } },
  },
  {
    metin: "1 - 2 - 3",
    beklenen: {
      işleç: "-",
      sol: { işleç: "-", sol: { değer: 1 }, sağ: { değer: 2 } },
      sağ: { değer: 3 },
    },
  },
  { metin: "a < b == c", beklenen: { işleç: "==", sol: { işleç: "<" } } },
  { metin: "(1 + 2) * 3", beklenen: { işleç: "*", sol: { işleç: "+" } } },
  {
    metin: "-sayı",
    beklenen: { tür: "tekli", işleç: "-", ifade: { tür: "tanımlayıcı", ad: "sayı" } },
  },
  { metin: "aktif değil", beklenen: { tür: "tekli", işleç: "değil", ifade: { ad: "aktif" } } },
  { metin: "kare(2) değil", beklenen: { tür: "tekli", işleç: "değil", ifade: { tür: "çağrı" } } },
])("%s öncelik ve birleşim yapısı doğrudur", ({ metin, beklenen }) => {
  expect(ifadeyiAl(metin)).toMatchObject(beklenen);
});

test.each(["=", "+=", "-=", "*=", "/=", "%="])("%s ataması tanımlayıcı hedefini taşır", (işleç) => {
  expect(ifadeyiAl(`sayaç ${işleç} 2`)).toMatchObject({
    tür: "atama",
    ad: "sayaç",
    işleç,
    değer: { tür: "sayı", değer: 2 },
  });
});

test("atama sağ birleşimlidir", () => {
  expect(ifadeyiAl("a = b = 1 + 2")).toMatchObject({
    tür: "atama",
    ad: "a",
    değer: { tür: "atama", ad: "b", değer: { işleç: "+" } },
  });
});

test.each([
  { metin: "topla()", beklenen: { tür: "çağrı", çağrılan: { ad: "topla" }, argümanlar: [] } },
  { metin: "topla(1, 2)", beklenen: { tür: "çağrı", argümanlar: [{ değer: 1 }, { değer: 2 }] } },
  {
    metin: "topla(kare(2), 3)",
    beklenen: {
      tür: "çağrı",
      argümanlar: [{ tür: "çağrı", argümanlar: [{ değer: 2 }] }, { değer: 3 }],
    },
  },
  { metin: "[]", beklenen: { tür: "liste", elemanlar: [] } },
  {
    metin: "[1, 2, 3]",
    beklenen: { tür: "liste", elemanlar: [{ değer: 1 }, { değer: 2 }, { değer: 3 }] },
  },
  { metin: '["a", "b"]', beklenen: { tür: "liste", elemanlar: [{ değer: "a" }, { değer: "b" }] } },
  {
    metin: "[topla(1, 2), 3]",
    beklenen: { tür: "liste", elemanlar: [{ tür: "çağrı" }, { değer: 3 }] },
  },
])("%s çağrı veya liste yapısını korur", ({ metin, beklenen }) => {
  expect(ifadeyiAl(metin)).toMatchObject(beklenen);
});

test("gerçek literal değerleri ve desteklenen kaçışlar AST'de çözülür", () => {
  const sonuç = ayrıştır(
    kaynakOluştur("literal.ata", '42; 3.14; "ç' + String.raw`\n\r\t\"\\` + '"; doğru; yanlış; yok'),
  );
  expect(sonuç.tanılar).toEqual([]);
  expect(
    sonuç.program?.bildirimler.map(
      (bildirim) => bildirim.tür === "ifade-bildirimi" && bildirim.ifade,
    ),
  ).toMatchObject([
    { tür: "sayı", değer: 42 },
    { tür: "sayı", değer: 3.14 },
    { tür: "yazı", değer: 'ç\n\r\t"\\' },
    { tür: "mantık", değer: true },
    { tür: "mantık", değer: false },
    { tür: "yok", değer: null },
  ]);
});

test("yazdır, değerli döndür ve boş döndür ayrı bildirimlerdir", () => {
  const sonuç = ayrıştır(
    kaynakOluştur("postfix.ata", '"Merhaba" yazdır\nad yazdır\nsonuç döndür\ndöndür'),
  );
  expect(sonuç.tanılar).toEqual([]);
  expect(sonuç.program?.bildirimler).toMatchObject([
    { tür: "yazdır", ifade: { değer: "Merhaba" } },
    { tür: "yazdır", ifade: { ad: "ad" } },
    { tür: "döndür", ifade: { ad: "sonuç" } },
    { tür: "döndür", ifade: null },
  ]);
});

test("çok satırlı çağrı, parantez ve liste içindeki satır sonları ifadeyi bölmez", () => {
  expect(ifadeyiAl("topla(\r\n  (1 +\r\n  2),\r\n  [3,\r\n4]\r\n)")).toMatchObject({
    tür: "çağrı",
    argümanlar: [{ işleç: "+" }, { tür: "liste" }],
  });
});

test("çok satırlı açıklama bildirim sınırını korur", () => {
  const sonuç = ayrıştır(
    kaynakOluştur("açıklama.ata", "sabit a = 1 /* Türkçe\r\naçıklama */ sabit b = 2"),
  );
  expect(sonuç.tanılar).toEqual([]);
  expect(sonuç.program?.bildirimler).toHaveLength(2);
});

test("Unicode adları ve NFC sonrası program aralıkları korunur", () => {
  const sonuç = ayrıştır(
    kaynakOluştur("nfc.ata", "sabit o\u0308lc\u0327u\u0308 = 1\r\nölçü yazdır"),
  );
  expect(sonuç.tanılar).toEqual([]);
  expect(sonuç.program?.bildirimler[0]).toMatchObject({ ad: "ölçü" });
  expect(sonuç.program?.bildirimler[1]!.aralık).toEqual({
    başlangıç: { satır: 2, sütun: 1, ofset: 16 },
    bitiş: { satır: 2, sütun: 12, ofset: 27 },
  });
});

test.each([
  "eğer doğru { }",
  "eğer doğru ise {",
  "topla(1, 2",
  "sabit ad",
  "sabit ad =",
  "işlev f(a): sayı {}",
  "işlev f(): sayı",
  "işlev f() {}",
  "işlev (): sayı {}",
  "sabit a = 1 sabit b = 2",
  "1 = 2",
  "(a) = 2",
  "nesne.alan = 1",
  "liste[0] = 1",
  "{ işlev f(): hiç {} }",
  "?",
  "değil aktif",
  "[1,]",
  "işlev f(a: bilinmeyen): sayı {}",
])("hatalı kaynak çökmeksizin ATA2xxx tanısı döndürür: %s", (metin) => {
  const sonuç = ayrıştır(kaynakOluştur("hata.ata", metin));
  expect(sonuç.program).toBeNull();
  expect(sonuç.tanılar.length).toBeGreaterThan(0);
  expect(sonuç.tanılar[0]!.kod).toMatch(/^ATA2\d{3}$/);
  expect(sonuç.tanılar[0]!.yol).toBe("hata.ata");
});

test("eksik ise ve dosya sonundaki kapanış tanıları doğru konumdadır", () => {
  const sonuç = ayrıştır(kaynakOluştur("hata.ata", "eğer doğru { }"));
  expect(sonuç.tanılar[0]).toMatchObject({
    mesaj: "'ise' bekleniyordu.",
    aralık: { başlangıç: { satır: 1, sütun: 12, ofset: 11 } },
  });
  const son = ayrıştır(kaynakOluştur("son.ata", "topla(1"));
  expect(son.tanılar[0]).toMatchObject({
    mesaj: "')' bekleniyordu.",
    aralık: { başlangıç: { satır: 1, sütun: 8, ofset: 7 }, bitiş: { ofset: 7 } },
  });
});

test("lexer tanısı varsa parser çalışmaz; sonraki çağrı temiz durumdan başlar", () => {
  const hatalı = ayrıştır(kaynakOluştur("hata.ata", "sabit x = @"));
  expect(hatalı.program).toBeNull();
  expect(hatalı.tanılar.map((tanı) => tanı.kod)).toEqual(["ATA1001"]);
  expect(ayrıştır(kaynakOluştur("boş.ata", "// açıklama\n")).program?.bildirimler).toEqual([]);
  expect(ayrıştır(kaynakOluştur("iyi.ata", "sabit x = 1")).tanılar).toEqual([]);
});

test("gerçek Aşama 2 programı tamamen ayrıştırılır", () => {
  const metin = `işlev kare(sayı: sayı): sayı {
    sayı * sayı döndür
}

işlev yetişkin_mi(yaş: sayı): mantık {
    eğer yaş >= 18 ise {
        doğru döndür
    }
    yanlış döndür
}

sabit ad = "İbrahim"
sabit yaş = 21
sabit sayılar = [1, 2, 3, 4, 5]

eğer yetişkin_mi(yaş) ise {
    "{ad} yetişkindir." yazdır
} değilse {
    "{ad} henüz yetişkin değildir." yazdır
}

sayılar içindeki her sayı için {
    kare(sayı) yazdır
}`;
  const sonuç = ayrıştır(kaynakOluştur("gerçek.ata", metin));
  expect(sonuç.tanılar).toEqual([]);
  expect(sonuç.program?.bildirimler).toHaveLength(7);
});

test("işlev, koşul zinciri, döngüler ve postfix bildirimler AST'ye taşınır", () => {
  const sonuç = ayrıştır(
    kaynakOluştur(
      "kontrol.ata",
      `işlev kare(sayı: sayı): sayı {
  sayı * sayı döndür
}
eğer puan >= 90 ise { "Pekiyi" yazdır }
değilse eğer puan >= 70 ise { "İyi" yazdır }
değilse { döndür }
sayaç < 10 iken { sayaç += 1 }
sayılar içindeki her sayı için { kare(sayı) yazdır }`,
    ),
  );
  expect(sonuç.tanılar).toEqual([]);
  expect(sonuç.program?.bildirimler.map((bildirim) => bildirim.tür)).toEqual([
    "işlev",
    "koşul",
    "iken",
    "liste-döngüsü",
  ]);
  expect(sonuç.program?.bildirimler[1]).toMatchObject({
    tür: "koşul",
    değilse: { tür: "koşul", değilse: { tür: "blok" } },
  });
});

test("ikili öncelik, çağrı, liste, tekli ifade ve açık tip birlikte ayrıştırılır", () => {
  const sonuç = ayrıştır(
    kaynakOluştur(
      "ifade.ata",
      `sabit sayılar: liste<sayı>? = [1 + 2 * 3, topla(kare(2), 3)]
değişken aktif: mantık = doğru değil
sayaç += -2`,
    ),
  );
  expect(sonuç.tanılar).toEqual([]);
  expect(sonuç.program?.bildirimler).toHaveLength(3);
  const ilk = sonuç.program!.bildirimler[0]!;
  expect(ilk.tür).toBe("sabit");
  if (ilk.tür !== "sabit") throw new Error("Sabit bildirimi bekleniyordu.");
  expect(ilk.açıkTip?.tür).toBe("isteğe-bağlı-tip");
  expect(ilk.başlangıç.tür).toBe("liste");
  if (ilk.başlangıç.tür !== "liste") throw new Error("Liste bekleniyordu.");
  expect(ilk.başlangıç.elemanlar[0]).toMatchObject({
    tür: "ikili",
    işleç: "+",
    sağ: { tür: "ikili", işleç: "*" },
  });
  expect(ilk.başlangıç.elemanlar[1]).toMatchObject({
    tür: "çağrı",
    argümanlar: [{ tür: "çağrı" }, { tür: "sayı", değer: 3 }],
  });
});
