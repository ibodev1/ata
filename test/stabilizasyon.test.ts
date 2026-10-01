import { expect, test } from "bun:test";
import { analizEt, ayrıştır, kaynakOluştur, sözcüklereAyır, yorumla } from "../src/index.ts";

function program(metin: string) {
  const sonuç = ayrıştır(kaynakOluştur("stabilizasyon.ata", metin));
  expect(sonuç.tanılar).toEqual([]);
  if (!sonuç.program) throw new Error("Program bekleniyordu.");
  return sonuç.program;
}

function çalıştır(metin: string) {
  const ast = program(metin);
  expect(analizEt(ast).tanılar).toEqual([]);
  const çıktı: string[] = [];
  const sonuç = yorumla(ast, { çıktıYaz: (satır) => çıktı.push(satır) });
  return { çıktı, kodlar: sonuç.tanılar.map((tanı) => tanı.kod) };
}

test("keyword önekleri ve combining mark içeren adlar bölünmez", () => {
  const adlar = [
    "sabitlik",
    "değişkenim",
    "yapılar",
    "seçenekler",
    "eşleştirme",
    "doğruluk",
    "yokluk",
    "veyaşı",
    "hiçlik",
    "sabit\u0307lik",
  ];
  const sonuç = sözcüklereAyır(kaynakOluştur("adlar.ata", adlar.join(" ")));
  expect(sonuç.tanılar).toEqual([]);
  expect(sonuç.tokenlar.map((token) => [token.tokenType.name, token.image])).toEqual(
    adlar.map((ad) => ["Tanımlayıcı", ad.normalize("NFC")]),
  );
});

test("Türkçe adlar ayrı kimliklerini, NFC eşdeğerleri aynı kimliği korur", () => {
  expect(çalıştır("sabit İ = 1; sabit I = 2; sabit ı = 3; sabit i = 4; [İ,I,ı,i] yazdır")).toEqual({
    çıktı: ["[1, 2, 3, 4]"],
    kodlar: [],
  });
  expect(
    analizEt(program("sabit ş = 1; sabit s\u0327 = 2")).tanılar.map((tanı) => tanı.kod),
  ).toEqual(["ATA3002"]);
  expect(
    çalıştır('büyük_harf("İIıiĞğŞşÖöÜüÇç🌍") yazdır; küçük_harf("İIıiĞğŞşÖöÜüÇç🌍") yazdır'),
  ).toEqual({ çıktı: ["İIIİĞĞŞŞÖÖÜÜÇÇ🌍", "iııiğğşşööüüçç🌍"], kodlar: [] });
});

test("hatalı-source corpus ham exception üretmez ve sonraki parse temizdir", () => {
  for (const metin of ["", "// yorum", "/* yorum */", "\n\r\n"]) {
    expect(ayrıştır(kaynakOluştur("boş.ata", metin)).tanılar).toEqual([]);
  }
  for (const metin of [
    "(",
    "[",
    "{",
    ")",
    "]",
    "}",
    "::",
    "x::",
    "x.",
    ",",
    ":",
    "işlev f(",
    "yapı K { a:",
    "seçenek S {",
    "x eşleştir { S::a ise",
    '"{',
    "/*",
    '"son',
  ] as const) {
    const sonuç = ayrıştır(kaynakOluştur("bozuk.ata", metin));
    expect(sonuç.program).toBeNull();
    expect(sonuç.tanılar.length).toBeGreaterThan(0);
    expect(sonuç.tanılar.length).toBeLessThanOrEqual(2);
  }
  expect(çalıştır("1 + 2 yazdır")).toEqual({ çıktı: ["3"], kodlar: [] });
});

test("sabit seed ile 120 küçük token corpus örneği parser'ı kilitlemez", () => {
  const parçalar = [
    "sabit",
    "x",
    "=",
    "1",
    "(",
    ")",
    "[",
    "]",
    "{",
    "}",
    "::",
    ".",
    ":",
    ",",
    ";",
    "eşleştir",
    "ise",
    "\n",
  ];
  let seed = 0xa7a;
  for (let sıra = 0; sıra < 120; sıra++) {
    const öğeler: string[] = [];
    for (let i = 0; i < 12; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      öğeler.push(parçalar[seed % parçalar.length]!);
    }
    const sonuç = ayrıştır(kaynakOluştur("corpus.ata", öğeler.join(" ")));
    expect(sonuç.program !== null || sonuç.tanılar.length > 0).toBe(true);
  }
});

test("makul derinlikte parantez, liste, blok ve constructor çökmez", () => {
  const n = 32;
  expect(çalıştır(`${"(".repeat(n)}1${")".repeat(n)} yazdır`)).toEqual({
    çıktı: ["1"],
    kodlar: [],
  });
  expect(çalıştır(`${"[".repeat(n)}1${"]".repeat(n)}${"[0]".repeat(n)} yazdır`)).toEqual({
    çıktı: ["1"],
    kodlar: [],
  });
  expect(çalıştır(`${"{".repeat(n)} 1 yazdır ${"}".repeat(n)}`)).toEqual({
    çıktı: ["1"],
    kodlar: [],
  });
  expect(
    çalıştır(
      `yapı K { sonraki: K? }; sabit k = ${"K { sonraki: ".repeat(n)}yok${" }".repeat(n)}; uzunluk([k]) yazdır`,
    ),
  ).toEqual({ çıktı: ["1"], kodlar: [] });
});

test("mantıksal öncelik ve sağdan atama pipeline boyunca korunur", () => {
  expect(
    çalıştır(
      "sabit a = 1; sabit b = 1; sabit c = 2; sabit d = 3; sabit e = yanlış; a == b veya c == d ve e yazdır; doğru değil veya yanlış değil yazdır; değişken x = 0; değişken y = 0; x = y = 7; [x,y] yazdır",
    ),
  ).toEqual({ çıktı: ["doğru", "doğru", "[7, 7]"], kodlar: [] });
  const ast = program("doğru veya yanlış ve doğru");
  expect(ast.bildirimler[0]).toMatchObject({
    tür: "ifade-bildirimi",
    ifade: { tür: "ikili", işleç: "veya", sağ: { tür: "ikili", işleç: "ve" } },
  });
  expect(çalıştır('"Dış {"İç {1 + 2}"}" yazdır')).toEqual({ çıktı: ["Dış İç 3"], kodlar: [] });
});

test("forward işlev/tip, postfix zinciri ve caller kapsamı birlikte çalışır", () => {
  expect(
    çalıştır(
      "sabit x = 1; getir()[0].alan yazdır; işlev getir(): liste<K> { [K { alan: x }] döndür }; yapı K { alan: sayı }; { sabit x = 2; getir()[0].alan yazdır }",
    ),
  ).toEqual({ çıktı: ["1", "1"], kodlar: [] });
});

test("değerlendirme sırası bütün side-effect sınırlarında kaynak sırasıdır", () => {
  const kod = `
değişken iz = ""
işlev adım(ad: yazı): sayı { iz += ad; 1 döndür }
işlev toplam(a: sayı, b: sayı): sayı { a + b döndür }
yapı K { ilk: sayı, son: sayı }
seçenek S { tek }
işlev listeGetir(): liste<sayı> { iz += "h"; [0,9] döndür }
işlev seçenekGetir(): S { iz += "j"; S::tek döndür }
adım("a") + adım("b")
toplam(adım("c"), adım("d"))
[adım("e"), adım("f")]
K { son: adım("g"), ilk: adım("G") }
listeGetir()[adım("i")]
seçenekGetir() eşleştir { S::tek ise {} }
iz yazdır`;
  expect(çalıştır(kod)).toEqual({ çıktı: ["abcdefgGhij"], kodlar: [] });
});

test("çağrı derinliği 255/256 kabul eder ve 257'de ATA5006 üretir", () => {
  for (const [n, kodlar] of [
    [254, []],
    [255, []],
    [256, ["ATA5006"]],
  ] as const) {
    const sonuç = çalıştır(
      `işlev f(n: sayı): sayı { eğer n == 0 ise { 0 döndür }; f(n - 1) döndür }; f(${n}) yazdır`,
    );
    expect(sonuç.kodlar).toEqual([...kodlar]);
    expect(sonuç.çıktı).toEqual(n < 256 ? ["0"] : []);
  }
  expect(
    çalıştır(
      "işlev çift(n: sayı): mantık { eğer n == 0 ise { doğru döndür }; tek(n-1) döndür }; işlev tek(n: sayı): mantık { eğer n == 0 ise { yanlış döndür }; çift(n-1) döndür }; çift(20) yazdır",
    ),
  ).toEqual({ çıktı: ["doğru"], kodlar: [] });
});

test("kullanıcı çağrısı aynı ifade içindeki sonraki global erişimi daraltamaz", () => {
  const ön =
    "yapı K { alan: sayı }; değişken d: K? = K { alan: 1 }; işlev temizle(): sayı { d = yok; 0 döndür }; ";
  expect(
    analizEt(program(ön + "eğer d != yok ise { temizle() + d.alan yazdır }")).tanılar.map(
      (tanı) => tanı.kod,
    ),
  ).toEqual(["ATA4020"]);
  expect(çalıştır(ön + "eğer d != yok ise { d.alan + temizle() yazdır }")).toEqual({
    çıktı: ["1"],
    kodlar: [],
  });
  expect(
    çalıştır(ön + "eğer d != yok ise { sabit kopya = d; temizle(); kopya.alan yazdır }"),
  ).toEqual({ çıktı: ["1"], kodlar: [] });
});

test("nested mantıksal koşul yalnızca bütün yollarda güvenli bağı daraltır", () => {
  const ön =
    "yapı K { alan: sayı }; sabit a: K? = K { alan: 1 }; sabit b: K? = yok; sabit c: K? = yok; ";
  expect(çalıştır(ön + "eğer a != yok ve (b == yok veya c != yok) ise { a.alan yazdır }")).toEqual({
    çıktı: ["1"],
    kodlar: [],
  });
  expect(
    analizEt(
      program(ön + "eğer a != yok ve (b == yok veya c != yok) ise { c.alan yazdır }"),
    ).tanılar.map((tanı) => tanı.kod),
  ).toEqual(["ATA4020"]);
});

test("hiç/yok dönüş, yazdırma, interpolation ve equality'de karışmaz", () => {
  expect(
    çalıştır(
      "işlev boş(): hiç { döndür }; işlev eksik(): sayı? { yok döndür }; boş(); eksik() yazdır; sabit x: sayı? = yok; x == yok yazdır",
    ),
  ).toEqual({ çıktı: ["yok", "doğru"], kodlar: [] });
  for (const [kod, beklenen] of [
    ["boş() yazdır", "ATA4015"],
    ['"{boş()}" yazdır', "ATA4016"],
    ["yazıya(boş())", "ATA4005"],
    ["boş() == boş()", "ATA4011"],
  ] as const) {
    expect(
      analizEt(program(`işlev boş(): hiç {}; ${kod}`)).tanılar.map((tanı) => tanı.kod),
    ).toEqual([beklenen]);
  }
});

test("nominal yapı/seçenek kimliği ve kök hata suppression korunur", () => {
  const durumlar = [
    ["yapı A { x: sayı }; yapı B { x: sayı }; sabit a: A = B { x: 1 }", "ATA4001"],
    ["seçenek A { tek }; seçenek B { tek }; A::tek == B::tek", "ATA4011"],
    ["olmayan[0].alan yazdır", "ATA3001"],
    ["Bilinmeyen::üye yazdır", "ATA3004"],
    ["seçenek S { tek }; S::yokÜye yazdır", "ATA4026"],
    ["yapı K { x: sayı }; K { x: 1 }.olmayan[0].alan yazdır", "ATA4019"],
    ["seçenek S { tek }; 1 eşleştir { S::tek ise {} }", "ATA4027"],
  ] as const;
  for (const [kod, beklenen] of durumlar)
    expect(analizEt(program(kod)).tanılar.map((tanı) => tanı.kod)).toEqual([beklenen]);
});

test("tek üyeli exhaustive eşleştirme döner ve redundant diğer reddedilir", () => {
  expect(
    çalıştır(
      "seçenek S { tek }; işlev oku(s: S): sayı { s eşleştir { S::tek ise { 42 döndür } } }; oku(S::tek) yazdır",
    ),
  ).toEqual({ çıktı: ["42"], kodlar: [] });
  expect(
    analizEt(
      program("seçenek S { tek }; S::tek eşleştir { S::tek ise {} diğer ise {} }"),
    ).tanılar.map((tanı) => tanı.kod),
  ).toEqual(["ATA4033"]);
});

test("Unicode/CRLF tanı aralığı UTF-16 ve end-exclusive sözleşmesindedir", () => {
  const ast = program('// 🌍\r\nsabit değer = "ğ"\r\nolmayan yazdır');
  expect(analizEt(ast).tanılar[0]).toMatchObject({
    kod: "ATA3001",
    aralık: {
      başlangıç: { satır: 3, sütun: 1, ofset: 26 },
      bitiş: { satır: 3, sütun: 8, ofset: 33 },
    },
  });
});

test("makul büyüklükte liste/döngü ve dönüşüm edge case'leri sonlu kalır", () => {
  const liste = Array.from({ length: 2048 }, (_, i) => i).join(",");
  expect(
    çalıştır(
      `sabit l = [${liste}]; değişken toplam = 0; l içindeki her x için { toplam += x }; toplam yazdır; al(l, -1) yazdır; l[2047] yazdır`,
    ),
  ).toEqual({ çıktı: ["2096128", "yok", "2047"], kodlar: [] });
  for (const [metin, beklenen] of [
    ["0000", "0"],
    ["000.000", "0"],
    ["\t+0\n", "0"],
    ["1\n2", "yok"],
    ["1\t2", "yok"],
  ]) {
    expect(çalıştır(`sayıya(${JSON.stringify(metin)}) yazdır`)).toEqual({
      çıktı: [beklenen!],
      kodlar: [],
    });
  }
});
