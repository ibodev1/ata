import { expect, test } from "bun:test";
import { kaynakOluştur, ayrıştır, analizEt, yorumla, sözcüklereAyır } from "../src/index.ts";

function programıAl(metin: string) {
  const sonuç = ayrıştır(kaynakOluştur("yapı.ata", metin));
  expect(sonuç.tanılar).toEqual([]);
  if (!sonuç.program) throw new Error("Program bekleniyordu.");
  return sonuç.program;
}

function çalıştır(metin: string) {
  const program = programıAl(metin);
  expect(analizEt(program).tanılar).toEqual([]);
  const çıktı: string[] = [];
  const sonuç = yorumla(program, { çıktıYaz: (satır) => çıktı.push(satır) });
  return { çıktı, tanılar: sonuç.tanılar };
}

test("yapı oluşturma, liste indeksleme, alan zinciri ve ortak gösterim tam pipeline'da çalışır", () => {
  const sonuç = çalıştır(
    'yapı Adres { şehir: yazı }; yapı Kullanıcı { ad: yazı, adres: Adres }; işlev getir(): liste<Kullanıcı> { [Kullanıcı { ad: "İbrahim", adres: Adres { şehir: "Konya" } }] döndür }; sabit k = getir()[0]; "{k.ad}, {k.adres.şehir}" yazdır; k yazdır; yazıya(k) yazdır; "{k}" yazdır',
  );
  expect(sonuç.tanılar).toEqual([]);
  expect(sonuç.çıktı).toEqual([
    "İbrahim, Konya",
    'Kullanıcı { ad: "İbrahim", adres: Adres { şehir: "Konya" } }',
    'Kullanıcı { ad: "İbrahim", adres: Adres { şehir: "Konya" } }',
    'Kullanıcı { ad: "İbrahim", adres: Adres { şehir: "Konya" } }',
  ]);
});

test.each([
  { metin: "yapı İşaret {}; İşaret {} yazdır", çıktı: ["İşaret {}"] },
  { metin: 'yapı küçük { ad: yazı }; küçük { ad: "Ata" }.ad yazdır', çıktı: ["Ata"] },
  {
    metin: 'yapı K { ad: yazı\nyaş: sayı\n}; K { yaş: 21\nad: "Ata"\n}.yaş + 1 yazdır',
    çıktı: ["22"],
  },
  { metin: 'yapı K { ad: yazı, yaş: sayı, }; K { ad: "Ata", yaş: 21, }.ad yazdır', çıktı: ["Ata"] },
  { metin: "yapı K { ad: yazı? }; K { ad: yok } yazdır", çıktı: ["K { ad: yok }"] },
  {
    metin:
      'yapı K { ad: yazı }; değişken k: K? = yok; k = K { ad: "Ata" }; yazıya(k) yazdır; k != yok yazdır',
    çıktı: ['K { ad: "Ata" }', "doğru"],
  },
  {
    metin:
      'yapı K { ad: yazı }; değişken k = K { ad: "Ata" }; sabit eski = k; k = K { ad: "Dil" }; eski.ad yazdır; k.ad yazdır',
    çıktı: ["Ata", "Dil"],
  },
  {
    metin:
      "yapı Düğüm { değer: sayı, sonraki: Düğüm? }; Düğüm { değer: 1, sonraki: Düğüm { değer: 2, sonraki: yok } } yazdır",
    çıktı: ["Düğüm { değer: 1, sonraki: Düğüm { değer: 2, sonraki: yok } }"],
  },
  {
    metin: "yapı K { ad: yazı }; yapı Takım { üyeler: liste<K> }; Takım { üyeler: [] } yazdır",
    çıktı: ["Takım { üyeler: [] }"],
  },
  {
    metin: 'yapı K { ad: yazı }; [K { ad: "İbrahim" }, K { ad: "Ayşe" }][1].ad yazdır',
    çıktı: ["Ayşe"],
  },
  {
    metin:
      'yapı K { ad: yazı }; yapı Takım { üyeler: liste<K> }; Takım { üyeler: [K { ad: "Ata" }] }.üyeler[0].ad yazdır',
    çıktı: ["Ata"],
  },
  { metin: "[[10, 20], [30, 40]][1][0] yazdır", çıktı: ["30"] },
  { metin: "[10, 20, 30][0] yazdır; [10, 20, 30][2] yazdır", çıktı: ["10", "30"] },
  { metin: '["Ata", "Dil"][1] yazdır', çıktı: ["Dil"] },
  { metin: 'yapı K { ad: yazı }; büyük_harf(K { ad: "istanbul" }.ad) yazdır', çıktı: ["İSTANBUL"] },
  { metin: 'yapı K { ad: yazı }; "{K { ad: "Ata" }.ad}" yazdır', çıktı: ["Ata"] },
  {
    metin: 'yapı K { ad: yazı }; işlev f(k: K): K { k döndür }; f(K { ad: "Ata" }).ad yazdır',
    çıktı: ["Ata"],
  },
  {
    metin: 'yapı K { ad: yazı }; [K { ad: "Ata" }] içindeki her k için { k.ad yazdır }',
    çıktı: ["Ata"],
  },
  {
    metin: 'yapı uzunluk {}; uzunluk("Ata") yazdır; uzunluk {} yazdır',
    çıktı: ["3", "uzunluk {}"],
  },
  {
    metin:
      'yapı K { ad: yazı }; işlev K(): sayı { 42 döndür }; K() yazdır; K { ad: "Ata" }.ad yazdır',
    çıktı: ["42", "Ata"],
  },
])("yapı ve indeks geçerli kullanımını tam pipeline'da yürütür: %j", ({ metin, çıktı }) => {
  expect(çalıştır(metin)).toEqual({ çıktı: [...çıktı], tanılar: [] });
});

test("constructor alanları declaration sırasından bağımsız kaynak sırasıyla değerlendirilir", () => {
  expect(
    çalıştır(
      "yapı Nokta { x: sayı, y: sayı }; işlev değer(n: sayı): sayı { n yazdır; n döndür }; Nokta { y: değer(2), x: değer(1) } yazdır",
    ).çıktı,
  ).toEqual(["2", "1", "Nokta { y: 2, x: 1 }"]);
});

test("indeks hedefi indeksten önce değerlendirilir", () => {
  expect(
    çalıştır(
      'işlev getir(): liste<sayı> { "hedef" yazdır; [42] döndür }; işlev sıra(): sayı { "indeks" yazdır; 0 döndür }; getir()[sıra()] yazdır',
    ).çıktı,
  ).toEqual(["hedef", "indeks", "42"]);
});

test.each(["yapı K { x: sayı,, y: sayı }", "K { x: 1,, y: 2 }"])(
  "tekrarlı virgül alan listesinde reddedilir: %s",
  (metin) => {
    expect(ayrıştır(kaynakOluştur("hata.ata", metin)).tanılar[0]?.kod).toBe("ATA2001");
  },
);

test("postfix düğümleri bütün zinciri, alt düğümleri kendi kısmını kapsar", () => {
  const program = programıAl("getir()[0].ad");
  const bildirim = program.bildirimler[0];
  if (
    bildirim?.tür !== "ifade-bildirimi" ||
    bildirim.ifade.tür !== "alan-erişim" ||
    bildirim.ifade.hedef.tür !== "indeks"
  )
    throw new Error("Postfix zinciri bekleniyordu.");
  expect(bildirim.ifade.aralık).toEqual({
    başlangıç: { ofset: 0, satır: 1, sütun: 1 },
    bitiş: { ofset: 13, satır: 1, sütun: 14 },
  });
  expect(bildirim.ifade.hedef.aralık.bitiş.ofset).toBe(10);
  expect(bildirim.ifade.hedef.hedef.aralık.bitiş.ofset).toBe(7);
});

test.each([
  "sabit l: liste<Olmayan> = [1]",
  "sabit l: liste<liste<Olmayan>> = [[1]]",
  "işlev f(a: liste<Olmayan>): hiç {}; f([1])",
])("tanımsız iç tipten sonra gereksiz uyumsuzluk tanısı üretilmez: %s", (metin) => {
  expect(analizEt(programıAl(metin)).tanılar.map((tanı) => tanı.kod)).toEqual(["ATA3004"]);
});

test("yapı/indeks alan tipleri yan tabloda çıkarılır", () => {
  const program = programıAl(
    'yapı K { ad: yazı, yaş: sayı }; sabit k = K { ad: "Ata", yaş: 21 }; k.ad; k.yaş; [k][0]; [1][0]',
  );
  const analiz = analizEt(program);
  expect(analiz.tanılar).toEqual([]);
  expect(
    program.bildirimler
      .slice(2)
      .map((bildirim) =>
        bildirim.tür === "ifade-bildirimi" ? analiz.ifadeTipleri.get(bildirim.ifade) : null,
      ),
  ).toEqual([{ tür: "yazı" }, { tür: "sayı" }, { tür: "yapı", ad: "K" }, { tür: "sayı" }]);
});

test("yapı tek yeni keyword'dür; yapı adları Unicode tanımlayıcı olarak kalır", () => {
  const sonuç = sözcüklereAyır(kaynakOluştur("ad.ata", "yapı Öğrenci küçük yapısal"));
  expect(sonuç.tanılar).toEqual([]);
  expect(sonuç.tokenlar.map((token) => token.tokenType.name)).toEqual([
    "yapı",
    "Tanımlayıcı",
    "Tanımlayıcı",
    "Tanımlayıcı",
  ]);
});

test("yapı oluşturma bildirimin önünde ve birbirini referanslayan yapı tipleri çalışır", () => {
  expect(
    çalıştır("sabit a: A = A { b: B { a: yok } }; yapı A { b: B }; yapı B { a: A? }; a.b yazdır")
      .çıktı,
  ).toEqual(["B { a: yok }"]);
});

test("Unicode/NFC, CRLF ve açıklama satırları yapı alan sınırlarını korur", () => {
  expect(
    çalıştır(
      'yapı O\u0308ğrenci {\r\nad: yazı /* açıklama\r\n*/ yaş: sayı\r\n}\r\nÖğrenci {\r\nad: "Ata"\r\nyaş: 21\r\n}.yaş yazdır',
    ).çıktı,
  ).toEqual(["21"]);
});

test("parantez/çağrı içindeki constructor alan satırları kaybolmaz", () => {
  expect(
    çalıştır('yapı K { ad: yazı, yaş: sayı }; yazıya((K {\nad: "Ata"\nyaş: 21\n})) yazdır').çıktı,
  ).toEqual(['K { ad: "Ata", yaş: 21 }']);
});

test("yapı yerleştirmesindeki iç yazı yerleştirmesi bütün lexer modlarından geçer", () => {
  expect(
    çalıştır('yapı K { ad: yazı }; sabit a = "Ata"; "{K { ad: "{a} Dil" }.ad}" yazdır').çıktı,
  ).toEqual(["Ata Dil"]);
});

test("indeks hatası önceki çıktıyı korur ve sonraki ifadeleri çalıştırmaz", () => {
  const sonuç = çalıştır('"önce" yazdır; [1][1] yazdır; "sonra" yazdır');
  expect(sonuç.çıktı).toEqual(["önce"]);
  expect(sonuç.tanılar[0]).toMatchObject({
    kod: "ATA5009",
    aralık: { başlangıç: { ofset: 19, satır: 1, sütun: 20 } },
  });
});

test("yapı adları değer olarak tanımlanmış sayılmaz ve alanlar lexical değişken değildir", () => {
  expect(
    analizEt(programıAl("yapı K { x: sayı }; K yazdır")).tanılar.map((tanı) => tanı.kod),
  ).toEqual(["ATA3001"]);
  expect(
    analizEt(programıAl("yapı K { x: sayı }; K { x: x }")).tanılar.map((tanı) => tanı.kod),
  ).toEqual(["ATA3001"]);
});

test("nominal uyumsuzluk liste, parametre, dönüş ve atamada korunur", () => {
  const başlık = "yapı A { x: sayı }; yapı B { x: sayı }; ";
  for (const metin of [
    "sabit a: liste<A> = [B { x: 1 }]",
    "işlev f(a: A): hiç {}; f(B { x: 1 })",
    "işlev f(): A { B { x: 1 } döndür }",
    "değişken a: A = A { x: 1 }; a = B { x: 2 }",
  ])
    expect(analizEt(programıAl(başlık + metin)).tanılar.length).toBeGreaterThan(0);
});

test("alan ve indeks sonucuna çağrı sözdizimi uygulanır, işlev olmayan hedef anlamsal olarak reddedilir", () => {
  for (const metin of ["yapı K { x: sayı }; K { x: 1 }.x()", "[1][0]()"]) {
    expect(analizEt(programıAl(metin)).tanılar.map((tanı) => tanı.kod)).toEqual(["ATA4009"]);
  }
});

test.each(["K", "K?", "liste<K>", "liste<K?>", "liste<K>?"])(
  "adlandırılmış tip bütün açıklama biçimlerinde çözülür: %s",
  (tip) => {
    expect(
      analizEt(programıAl(`yapı K {}; işlev f(a: ${tip}): ${tip} { a döndür }`)).tanılar,
    ).toEqual([]);
  },
);

test.each([
  { metin: "sabit k: Olmayan = 1", kodlar: ["ATA3004"] },
  { metin: 'Olmayan { ad: "Ata" }', kodlar: ["ATA3004"] },
  { metin: "yapı K {}; yapı K {}", kodlar: ["ATA3005"] },
  { metin: "yapı K { ad: yazı, ad: sayı }", kodlar: ["ATA4018"] },
  { metin: "yapı K { ad: yazı }; K {}", kodlar: ["ATA4017"] },
  { metin: 'yapı K { ad: yazı }; K { ad: "Ata", yaş: 21 }', kodlar: ["ATA4019"] },
  { metin: 'yapı K { ad: yazı }; K { ad: "Ata", ad: "Dil" }', kodlar: ["ATA4018"] },
  { metin: "yapı K { ad: yazı }; K { ad: 21 }", kodlar: ["ATA4001"] },
  { metin: "yapı K { ad: yazı? }; K {}", kodlar: ["ATA4017"] },
  { metin: 'yapı K { ad: yazı }; K { ad: "Ata" }.olmayan', kodlar: ["ATA4019"] },
  { metin: "42.ad", kodlar: ["ATA4020"] },
  { metin: '"Ata".uzunluk', kodlar: ["ATA4020"] },
  { metin: "[1, 2].değer", kodlar: ["ATA4020"] },
  { metin: "yapı K { ad: yazı }; değişken k: K? = yok; k.ad", kodlar: ["ATA4020"] },
  { metin: "yapı K {}; K {}[0]", kodlar: ["ATA4021"] },
  { metin: '"Ata"[0]', kodlar: ["ATA4021"] },
  { metin: '[1]["0"]', kodlar: ["ATA4022"] },
  { metin: "değişken l: liste<sayı>? = yok; l[0]", kodlar: ["ATA4021"] },
  { metin: "yapı K {}; K {} == K {}", kodlar: ["ATA4011"] },
  { metin: "yapı K {}; değişken k: K? = yok; k == k", kodlar: ["ATA4011"] },
  { metin: "yapı K {}; uzunluk(K {})", kodlar: ["ATA4005"] },
  { metin: "olmayan.ad", kodlar: ["ATA3001"] },
  { metin: "olmayan[0]", kodlar: ["ATA3001"] },
  { metin: "[1][olmayan]", kodlar: ["ATA3001"] },
  { metin: "yapı K { ad: yazı }; K { ad: olmayan }", kodlar: ["ATA3001"] },
])("yapı/indeks semantiği güvenli Türkçe tanılar üretir: %j", ({ metin, kodlar }) => {
  expect(analizEt(programıAl(metin)).tanılar.map((tanı) => tanı.kod)).toEqual([...kodlar]);
});

test.each([
  { metin: "[10][1.5]", kod: "ATA5008" },
  { metin: "[10][-1]", kod: "ATA5009" },
  { metin: "[10][1]", kod: "ATA5009" },
  { metin: "sabit l: liste<sayı> = []; l[0]", kod: "ATA5009" },
  { metin: "[10][9007199254740991 + 1]", kod: "ATA5008" },
])("geçerli sayı tipi runtime indeks güvenliğini aşamaz: %j", ({ metin, kod }) => {
  const sonuç = çalıştır(metin);
  expect(sonuç.tanılar.map((tanı) => tanı.kod)).toEqual([kod]);
});

test.each([
  "42.ad",
  '"Ata"[0]',
  '[1]["0"]',
  "Olmayan {}",
  "yapı K { ad: yazı }; K {}",
  "yapı K {}; K { x: 1 }",
  "yapı K { x: sayı }; K { x: 1, x: 2 }",
  "yapı K {}; K {}.x",
  "yapı K {}; K {} == K {}",
  "yapı K {}; yapı K {}",
  "yapı K { x: sayı, x: yazı }",
])("analiz atlandığında yapı/indeks invariant ihlali ham JS hatası sızdırmaz: %s", (metin) => {
  expect(
    yorumla(programıAl(metin), { çıktıYaz: () => {} }).tanılar.map((tanı) => tanı.kod),
  ).toEqual(["ATA5005"]);
});

test.each([
  "yapı {}",
  "yapı K { ad }",
  "yapı K { ad: }",
  "yapı K { ad: yazı",
  "K { ad }",
  "K { ad: }",
  'K { ad: "Ata" @ }',
  'K { ad: "Ata" 1 }',
  'K { ad: "Ata"',
  'yapı K { ad: yazı = "Ata" }',
  "eğer doğru ise { yapı K {} }",
  "işlev f(): hiç { yapı K {} }",
  'K {}.ad = "Ayşe"',
  "[1][0] = 2",
  'K {}.ad += "Ayşe"',
  "[1][0] += 2",
])("hatalı yapı veya mutasyon sözdizimi çökmeksizin reddedilir: %s", (metin) => {
  const sonuç = ayrıştır(kaynakOluştur("hata.ata", metin));
  expect(sonuç.program).toBeNull();
  expect(sonuç.tanılar.length).toBeGreaterThan(0);
  expect(sonuç.tanılar.every((tanı) => /^ATA[12]/.test(tanı.kod))).toBe(true);
});

test("yapı bildirimi alanları ve adlandırılmış tipleri açık AST düğümlerinde taşır", () => {
  const program = programıAl("yapı Öğrenci { ad: yazı, arkadaş: Öğrenci? }");
  const yapı = program.bildirimler[0];
  expect(yapı?.tür).toBe("yapı");
  if (yapı?.tür !== "yapı") throw new Error("Yapı bekleniyordu.");
  expect(yapı.ad).toBe("Öğrenci");
  expect(yapı.alanlar.map((alan) => alan.ad)).toEqual(["ad", "arkadaş"]);
  expect(yapı.alanlar[1]?.tip.tür).toBe("isteğe-bağlı-tip");
});

test("ileri ve recursive yapı tipleri ayrı tip ad alanında çözülür ve nominaldir", () => {
  const program = programıAl(
    'yapı Sipariş { kişi: Kullanıcı }\nyapı Kullanıcı { ad: yazı, sonraki: Kullanıcı? }\nsabit Kullanıcı = 42\nsabit kişi: Kullanıcı = Kullanıcı { sonraki: yok, ad: "Ata" }\nsabit kişiler: liste<Kullanıcı?> = [kişi, yok]',
  );
  const analiz = analizEt(program);
  expect(analiz.tanılar).toEqual([]);
  const kişi = program.bildirimler[3];
  if (kişi?.tür !== "sabit") throw new Error("Değer bekleniyordu.");
  expect(analiz.ifadeTipleri.get(kişi.başlangıç)).toEqual({ tür: "yapı", ad: "Kullanıcı" });
  expect(
    analizEt(
      programıAl("yapı A { x: sayı }; yapı B { x: sayı }; sabit a: A = B { x: 1 }"),
    ).tanılar.map((tanı) => tanı.kod),
  ).toEqual(["ATA4001"]);
});

test("yerleştirme içindeki iç içe constructor süslüleri yazı modunu erken kapatmaz", () => {
  const program = programıAl(
    'yapı A { b: B }\nyapı B { ad: yazı }\n"{A { b: B { ad: "Ata" } }.b.ad}" yazdır',
  );
  expect(program.bildirimler[2]?.tür).toBe("yazdır");
});

test("constructor, çağrı, indeks ve alan erişimi kaynak sırasıyla postfix AST zinciri kurar", () => {
  const program = programıAl(
    'yapı K { ad: yazı }\nsabit kişiler = [K {\nad: "İbrahim"\n}]\ngetir()[0].ad + 1 yazdır',
  );
  const son = program.bildirimler[2];
  expect(son?.tür).toBe("yazdır");
  if (son?.tür !== "yazdır" || son.ifade.tür !== "ikili")
    throw new Error("İkili ifade bekleniyordu.");
  expect(son.ifade.sol.tür).toBe("alan-erişim");
  if (son.ifade.sol.tür !== "alan-erişim") throw new Error("Alan bekleniyordu.");
  expect(son.ifade.sol.hedef.tür).toBe("indeks");
});
