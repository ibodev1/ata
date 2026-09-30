import { expect, test } from "bun:test";
import { kaynakOluştur, ayrıştır, analizEt, yorumla } from "../src/index.ts";

function programıAl(metin: string) {
  const sonuç = ayrıştır(kaynakOluştur("güvenli.ata", metin));
  expect(sonuç.tanılar).toEqual([]);
  if (!sonuç.program) throw new Error("Program bekleniyordu.");
  return sonuç.program;
}

function çalıştır(metin: string, girdiOku?: (istem: string) => string | null) {
  const program = programıAl(metin);
  expect(analizEt(program).tanılar).toEqual([]);
  const çıktı: string[] = [];
  const sonuç = yorumla(program, {
    çıktıYaz: (satır) => çıktı.push(satır),
    ...(girdiOku ? { girdiOku } : {}),
  });
  expect(sonuç.tanılar).toEqual([]);
  return çıktı;
}

test("sayıya optional sayı üretir ve daraltmayla aritmetikte kullanılabilir", () => {
  expect(çalıştır('sabit yaş = sayıya("21"); eğer yaş != yok ise { yaş + 1 yazdır }')).toEqual([
    "22",
  ]);
});

test("mantığa Türkçe büyük harfli değeri optional mantığa dönüştürür", () => {
  expect(
    çalıştır('sabit cevap = mantığa("YANLIŞ"); eğer cevap != yok ise { cevap yazdır }'),
  ).toEqual(["yanlış"]);
});

test("al optional eleman tipini çıkarır ve güvenli indekslemeyle değeri döndürür", () => {
  expect(
    çalıştır("sabit değer = al([10,20], 1); eğer değer != yok ise { değer + 1 yazdır }"),
  ).toEqual(["21"]);
});

test.each(["ilk", "son"])("%s liste elemanının optional tipini çıkarır", (ad) => {
  expect(çalıştır(`sabit değer = ${ad}([10]); eğer değer != yok ise { değer + 1 yazdır }`)).toEqual(
    ["11"],
  );
});

test.each([
  ["42", "42"],
  ["-42", "-42"],
  ["+42", "42"],
  ["3.14", "3.14"],
  ["-3.14", "-3.14"],
  ["+3.14", "3.14"],
  ["  -3.14  ", "-3.14"],
  ["0", "0"],
  ["-0", "0"],
  ["+0", "0"],
  ["0.5", "0.5"],
  ["001", "1"],
  ["001.50", "1.5"],
  ["\u00a0\u2003+42\u202f", "42"],
  ["9007199254740992", "9007199254740992"],
])("sayıya izin verilen sonlu decimal metni dönüştürür: %s", (metin, çıktı) => {
  expect(çalıştır(`sayıya(${JSON.stringify(metin)}) yazdır`)).toEqual([çıktı]);
});

test.each([
  "",
  " ",
  "abc",
  "12abc",
  "1e3",
  "1E3",
  "0x10",
  "0b10",
  "0o10",
  "NaN",
  "Infinity",
  "+Infinity",
  "-Infinity",
  "1,5",
  "3,14",
  ".5",
  "1.",
  "+",
  "-",
  "1 2",
  "1_000",
  "--1",
  "1.2.3",
  "４２",
  "٤٢",
  "9".repeat(400),
])("sayıya geçersiz veya sonsuza taşan metinde tanısız yok döndürür: %s", (metin) => {
  expect(çalıştır(`sayıya(${JSON.stringify(metin)}) yazdır`)).toEqual(["yok"]);
});

test.each([
  ["doğru", "doğru"],
  ["DOĞRU", "doğru"],
  ["Doğru", "doğru"],
  ["yanlış", "yanlış"],
  ["YANLIŞ", "yanlış"],
  ["Yanlış", "yanlış"],
  [" \u00a0DOĞRU\u2003 ", "doğru"],
  [" \u202fYANLIŞ ", "yanlış"],
])("mantığa Türkçe locale ve Unicode boşlukları kullanır: %s", (metin, çıktı) => {
  expect(çalıştır(`mantığa(${JSON.stringify(metin)}) yazdır`)).toEqual([çıktı]);
});

test.each([
  "true",
  "false",
  "1",
  "0",
  "evet",
  "hayır",
  "",
  " ",
  "YANLİŞ",
  "yanlis",
  "dogru",
  "DOĞRU!",
  "do ğru",
])("mantığa başka metni tanısız reddeder: %s", (metin) => {
  expect(çalıştır(`mantığa(${JSON.stringify(metin)}) yazdır`)).toEqual(["yok"]);
});

test.each([
  ["0", "10"],
  ["1", "20"],
  ["-0", "10"],
  ["2", "yok"],
  ["-1", "yok"],
  ["1.5", "yok"],
  ["-0.5", "yok"],
  ["9007199254740991", "yok"],
  ["9007199254740991 + 1", "yok"],
])("al indeks için tanısız güvenli erişim sağlar: %s", (indeks, çıktı) => {
  expect(çalıştır(`al([10,20], ${indeks}) yazdır`)).toEqual([çıktı]);
});

test("al başarısızlığı yok döndürürken doğrudan indeksleme strict kalır", () => {
  expect(çalıştır("al([10], 5) yazdır")).toEqual(["yok"]);
  const program = programıAl("[10][5] yazdır");
  expect(analizEt(program).tanılar).toEqual([]);
  expect(yorumla(program, { çıktıYaz: () => {} }).tanılar.map((tanı) => tanı.kod)).toEqual([
    "ATA5009",
  ]);
  const kesirli = programıAl("[10][0.5] yazdır");
  expect(yorumla(kesirli, { çıktıYaz: () => {} }).tanılar.map((tanı) => tanı.kod)).toEqual([
    "ATA5008",
  ]);
});

for (const ad of ["al", "ilk", "son"]) {
  test.each([
    { tip: "sayı", başlangıç: "[10]", temel: { tür: "sayı" }, çıktı: "10", ön: "" },
    { tip: "yazı", başlangıç: '["Ata"]', temel: { tür: "yazı" }, çıktı: "Ata", ön: "" },
    { tip: "mantık", başlangıç: "[yanlış]", temel: { tür: "mantık" }, çıktı: "yanlış", ön: "" },
    {
      tip: "K",
      başlangıç: ' [K { ad: "İbrahim" }]',
      temel: { tür: "yapı", ad: "K" },
      çıktı: 'K { ad: "İbrahim" }',
      ön: "yapı K { ad: yazı };",
    },
    {
      tip: "liste<sayı>",
      başlangıç: "[[1,2]]",
      temel: { tür: "liste", eleman: { tür: "sayı" } },
      çıktı: "[1, 2]",
      ön: "",
    },
    { tip: "sayı?", başlangıç: "[10]", temel: { tür: "sayı" }, çıktı: "10", ön: "" },
    {
      tip: "yazı?",
      başlangıç: '["Ata", yok]',
      temel: { tür: "yazı" },
      çıktı: ad === "son" ? "yok" : "Ata",
      ön: "",
    },
    {
      tip: "K?",
      başlangıç: "[yok]",
      temel: { tür: "yapı", ad: "K" },
      çıktı: "yok",
      ön: "yapı K { ad: yazı };",
    },
    {
      tip: "liste<sayı>?",
      başlangıç: "[yok]",
      temel: { tür: "liste", eleman: { tür: "sayı" } },
      çıktı: "yok",
      ön: "",
    },
    { tip: "sayı", başlangıç: "[]", temel: { tür: "sayı" }, çıktı: "yok", ön: "" },
    { tip: "yazı?", başlangıç: "[]", temel: { tür: "yazı" }, çıktı: "yok", ön: "" },
  ])(
    `${ad} eleman tipini korur ve optional sonucu tek katmana indirir: %j`,
    ({ tip, başlangıç, temel, çıktı, ön }) => {
      const çağrı = `${ad}(l${ad === "al" ? ", 0" : ""})`;
      const metin = `${ön} sabit l: liste<${tip}> = ${başlangıç}; sabit sonuç = ${çağrı}; sonuç yazdır`;
      const program = programıAl(metin);
      const analiz = analizEt(program);
      expect(analiz.tanılar).toEqual([]);
      const bildirim = program.bildirimler.at(-2);
      if (bildirim?.tür !== "sabit") throw new Error("Sabit bekleniyordu.");
      expect(analiz.ifadeTipleri.get(bildirim.başlangıç)).toEqual({ tür: "isteğe-bağlı", temel });
      const sembol = [...analiz.sembolTipleri.keys()].find((aday) => aday.ad === "sonuç");
      expect(sembol).toBeDefined();
      expect(sembol && analiz.sembolTipleri.get(sembol)).toEqual({ tür: "isteğe-bağlı", temel });
      expect(çalıştır(metin)).toEqual([çıktı]);
    },
  );
}

test("ilk ve son farklı uçları okur; iki sonuç birlikte daraltılır", () => {
  expect(
    çalıştır(
      'sabit l = [10,20,30]; sabit baş = ilk(l); sabit bitiş = son(l); eğer baş != yok ve bitiş != yok ise { "{baş} - {bitiş}" yazdır }',
    ),
  ).toEqual(["10 - 30"]);
});

test.each(["al", "ilk", "son"])("%s yapı sonucunun alanına daraltmadan sonra erişilir", (ad) => {
  expect(
    çalıştır(
      `yapı K { ad: yazı }; sabit kişi = ${ad}([K { ad: "İbrahim" }]${ad === "al" ? ", 0" : ""}); eğer kişi != yok ise { kişi.ad yazdır }`,
    ),
  ).toEqual(["İbrahim"]);
});

test.each([
  "sayıya(42)",
  "sayıya(doğru)",
  "sayıya(yok)",
  "mantığa(doğru)",
  "mantığa(42)",
  'al("Ata",0)',
  "al(42,0)",
  "al(doğru,0)",
  "al(yok,0)",
  'al([1],"0")',
  "al([1],doğru)",
  'ilk("Ata")',
  "ilk(42)",
  "son(doğru)",
  "son(42)",
  "sabit l: liste<sayı>? = [1]; ilk(l)",
  "sabit i: sayı? = 0; al([1],i)",
  'sabit y: yazı? = "21"; sayıya(y)',
])("yeni işlev yanlış veya daraltılmamış argümanı statik reddeder: %s", (metin) => {
  expect(analizEt(programıAl(metin)).tanılar.map((tanı) => tanı.kod)).toEqual(["ATA4005"]);
});

test.each([
  "sayıya()",
  'sayıya("1","2")',
  "mantığa()",
  'mantığa("doğru","yanlış")',
  "al([1])",
  "al([1],0,1)",
  "ilk()",
  "ilk([1],[2])",
  "son()",
  "son([1],[2])",
])("yeni işlev argüman sayısını analizde ve çalışma zamanında korur: %s", (metin) => {
  const program = programıAl(metin);
  expect(analizEt(program).tanılar.map((tanı) => tanı.kod)).toEqual(["ATA4004"]);
  expect(yorumla(program, { çıktıYaz: () => {} }).tanılar.map((tanı) => tanı.kod)).toEqual([
    "ATA5005",
  ]);
});

test.each(["al([],0)", "ilk([])", "son([])"])(
  "%s boş eleman tipi çıkarımını gevşetmez",
  (metin) => {
    expect(analizEt(programıAl(metin)).tanılar.map((tanı) => tanı.kod)).toEqual(["ATA4008"]);
  },
);

test.each(["sayıya", "mantığa", "al", "ilk", "son"])(
  "%s yalnızca çağrı hedefidir ve globalde yeniden tanımlanamaz",
  (ad) => {
    expect(analizEt(programıAl(`sabit f = ${ad}`)).tanılar.map((tanı) => tanı.kod)).toEqual([
      "ATA4010",
    ]);
    expect(analizEt(programıAl(`sabit ${ad} = 1`)).tanılar.map((tanı) => tanı.kod)).toEqual([
      "ATA3002",
    ]);
    expect(çalıştır(`{ sabit ${ad} = 42; ${ad} yazdır }`)).toEqual(["42"]);
  },
);

test.each([
  ['sayıya("abc")', "Geçersiz sayı."],
  ["al([10,20],10)", "Öğe bulunamadı."],
])("güvenli başarısız sonuç else testiyle işlenir: %s", (çağrı, çıktı) => {
  expect(
    çalıştır(
      `sabit değer = ${çağrı}; eğer değer == yok ise { "${çıktı}" yazdır } değilse { değer yazdır }`,
    ),
  ).toEqual([çıktı]);
});

test.each(["21", "abc"])(
  "güvenli kullanıcı girdisi istemi korur ve başarısızlığı tanı üretmeden işler: %s",
  (girdi) => {
    const istemler: string[] = [];
    const çıktı = çalıştır(
      'sabit yaş = sayıya(girdi("Yaş: ")); eğer yaş == yok ise { "Geçersiz." yazdır } değilse { yaş + 1 yazdır }',
      (istem) => {
        istemler.push(istem);
        return girdi;
      },
    );
    expect(istemler).toEqual(["Yaş: "]);
    expect(çıktı).toEqual([girdi === "21" ? "22" : "Geçersiz."]);
  },
);

test("daraltılmış liste ve indeks yeni işlevlerle kullanılabilir", () => {
  expect(
    çalıştır(
      "sabit l: liste<sayı>? = [10]; sabit i: sayı? = 0; eğer l != yok ve i != yok ise { al(l,i) yazdır; ilk(l) yazdır; son(l) yazdır }",
    ),
  ).toEqual(["10", "10", "10"]);
});

test("yeni yerleşik çağrılar global mutable daraltmayı bozmaz", () => {
  expect(
    çalıştır(
      'değişken ad: yazı? = "Ata"; eğer ad != yok ise { sayıya("1"); mantığa("doğru"); al([1],0); ilk([1]); son([1]); büyük_harf(ad) yazdır }',
    ),
  ).toEqual(["ATA"]);
});

test.each(["sayıya(42)", "mantığa(doğru)", "al(42,0)", 'al([1],"0")', "ilk(yok)", "son(42)"])(
  "analiz atlandığında %s runtime invariant tanısını korur",
  (metin) => {
    expect(
      yorumla(programıAl(metin), { çıktıYaz: () => {} }).tanılar.map((tanı) => tanı.kod),
    ).toEqual(["ATA5005"]);
  },
);

test.each(["al(bilinmeyen,0)", "ilk(bilinmeyen).ad", "son(bilinmeyen)[0]"])(
  "%s bilinmeyen argümandan sahte tip hata zinciri üretmez",
  (metin) => {
    expect(analizEt(programıAl(metin)).tanılar.map((tanı) => tanı.kod)).toEqual(["ATA3001"]);
  },
);

test("güvenli dönüşüm sayıları ve mantıkları daraltılmadan kullanılamaz", () => {
  expect(
    analizEt(programıAl('sabit n = sayıya("21"); n + 1 yazdır')).tanılar.map((tanı) => tanı.kod),
  ).toEqual(["ATA4011"]);
  expect(
    analizEt(programıAl('sabit b = mantığa("doğru"); eğer b ise {}')).tanılar.map(
      (tanı) => tanı.kod,
    ),
  ).toEqual(["ATA4002"]);
});
