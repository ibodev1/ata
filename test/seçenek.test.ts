import { expect, test } from "bun:test";
import { kaynakOluştur, ayrıştır, analizEt, yorumla, sözcüklereAyır } from "../src/index.ts";

function programıAl(metin: string) {
  const sonuç = ayrıştır(kaynakOluştur("seçenek.ata", metin));
  expect(sonuç.tanılar).toEqual([]);
  if (!sonuç.program) throw new Error("Program bekleniyordu.");
  return sonuç.program;
}

function çalıştır(metin: string) {
  const program = programıAl(metin);
  expect(analizEt(program).tanılar).toEqual([]);
  const çıktı: string[] = [];
  expect(yorumla(program, { çıktıYaz: (satır) => çıktı.push(satır) }).tanılar).toEqual([]);
  return çıktı;
}

const tanım = "seçenek Durum { açık, kapalı };";

function kodlar(metin: string): string[] {
  return analizEt(programıAl(metin)).tanılar.map((tanı) => tanı.kod);
}

test("seçenek bildirimi ve değeri ayrı AST düğümleridir", () => {
  const program = programıAl(tanım + "sabit durum: Durum = Durum::açık");
  expect(program.bildirimler[0]?.tür).toBe("seçenek");
  const değer = program.bildirimler[1];
  if (değer?.tür !== "sabit") throw new Error("Sabit bekleniyordu.");
  expect(değer.başlangıç).toMatchObject({
    tür: "nitelikli-ad",
    parçalar: [{ ad: "Durum" }, { ad: "açık" }],
  });
});

test("seçenek değeri nominal tip taşır ve ortak gösterimi kullanır", () => {
  expect(
    çalıştır(
      tanım +
        'sabit durum: Durum = Durum::açık; durum yazdır; "Durum: {durum}" yazdır; yazıya(durum) yazdır',
    ),
  ).toEqual(["Durum::açık", "Durum: Durum::açık", "Durum::açık"]);
});

test("seçenek eşitliği nominal tip ve üye adını karşılaştırır", () => {
  expect(
    çalıştır(tanım + "Durum::açık == Durum::açık yazdır; Durum::açık != Durum::kapalı yazdır"),
  ).toEqual(["doğru", "doğru"]);
});

test("exhaustive eşleştir yalnızca uygun kolu yürütür", () => {
  expect(
    çalıştır(
      tanım +
        'Durum::kapalı eşleştir { Durum::açık ise { "Açık" yazdır } Durum::kapalı ise { "Kapalı" yazdır } }',
    ),
  ).toEqual(["Kapalı"]);
});

test("geçerli exhaustive eşleştir bütün kollar dönerse işlev dönüşünü sağlar", () => {
  expect(
    çalıştır(
      tanım +
        "işlev kod(d: Durum): sayı { d eşleştir { Durum::açık ise { 1 döndür } diğer ise { 0 döndür } } }; kod(Durum::kapalı) yazdır",
    ),
  ).toEqual(["0"]);
});

test(":: longest-match ':' ile yapı alanlarını ve açıklamaları bozmaz", () => {
  const sonuç = sözcüklereAyır(
    kaynakOluştur(
      "token.ata",
      "seçenek eşleştir diğer Seçenekli diğerleri Durum::açık ad: yazı k.ad",
    ),
  );
  expect(sonuç.tanılar).toEqual([]);
  expect(sonuç.tokenlar.map((token) => token.tokenType.name)).toEqual([
    "seçenek",
    "eşleştir",
    "diğer",
    "Tanımlayıcı",
    "Tanımlayıcı",
    "Tanımlayıcı",
    "ÇiftİkiNokta",
    "Tanımlayıcı",
    "Tanımlayıcı",
    "İkiNokta",
    "yazı",
    "Tanımlayıcı",
    "Nokta",
    "Tanımlayıcı",
  ]);
});

test.each([
  "seçenek Durum { açık, kapalı }",
  "seçenek Durum { açık, kapalı, }",
  "seçenek Durum {\naçık\nkapalı\n}",
  "seçenek Durum\r\n{\r\naçık,\r\nkapalı,\r\n}",
  "seçenek Durum {\naçık /* açıklama */\nkapalı\n}",
])("seçenek ayırıcıları ve declaration sırası korunur: %s", (kaynak) => {
  const program = programıAl(kaynak);
  const bildirim = program.bildirimler[0];
  if (bildirim?.tür !== "seçenek") throw new Error("Seçenek bekleniyordu.");
  expect(bildirim.üyeler.map((üye) => üye.ad)).toEqual(["açık", "kapalı"]);
  expect(analizEt(program).tanılar).toEqual([]);
  expect(bildirim.üyeler[0]?.aralık.başlangıç.ofset).toBeLessThan(
    bildirim.üyeler[1]!.aralık.başlangıç.ofset,
  );
});

test("Unicode tip/üye NFC normalizasyonu ile çalışır", () => {
  expect(çalıştır("seçenek Üyelik { çağrıldı, güney }; U\u0308yelik::gu\u0308ney yazdır")).toEqual([
    "Üyelik::güney",
  ]);
});

test.each([
  ["boş seçenek", "seçenek Boş {}", "ATA4023"],
  ["yinelenen üye", "seçenek D { a, a }", "ATA4024"],
  ["yinelenen seçenek adı", "seçenek D { a }; seçenek D { b }", "ATA3005"],
  ["yapı önce", "yapı D {}; seçenek D { a }", "ATA3005"],
  ["seçenek önce", "seçenek D { a }; yapı D {}", "ATA3005"],
  ["tanımsız tip", "Olmayan::değer", "ATA3004"],
  ["yapı üzerinde ::", "yapı K {}; K::üye", "ATA4025"],
  ["bilinmeyen üye", tanım + "Durum::bilinmeyen", "ATA4026"],
  ["nominal atama", "seçenek A { a }; seçenek B { a }; sabit x: A = B::a", "ATA4001"],
  ["nominal eşitlik", "seçenek A { a }; seçenek B { a }; A::a == B::a", "ATA4011"],
  ["yapı oluşturma değil", tanım + "Durum {}", "ATA4020"],
  ["uzunluk seçenek kabul etmez", tanım + "uzunluk(Durum::açık)", "ATA4005"],
  ["nokta tip üyesi değil", tanım + "Durum.açık", "ATA3001"],
])("seçenek anlam kuralları: %s", (_ad, kaynak, kod) => {
  expect(kodlar(kaynak)).toContain(kod);
});

test.each([
  "seçenek { a }",
  "seçenek D a }",
  "seçenek D { a",
  "seçenek D { a b }",
  "seçenek D { a; b }",
  "seçenek D { a(yazı) }",
  "seçenek D { a = 1 }",
  "Durum:açık",
  "Durum::",
  "Durum:::açık",
  "Durum::42",
  "Durum::açık eşleştir Durum::açık ise {}",
  "Durum::açık eşleştir { Durum::açık {} }",
  "Durum::açık eşleştir { Durum::açık ise }",
  "Durum::açık eşleştir { Durum::açık ise {}",
  "{ seçenek D { a } }",
  "işlev f(): hiç { seçenek D { a } }",
  "seçenek D { a }; sabit x = D::a eşleştir { D::a ise {} }",
  "D::a eşleştir { 42 ise {} }",
  "D::a eşleştir { x ise {} }",
  "D::a eşleştir { D::a veya D::b ise {} }",
  "D::a eşleştir { D::a eğer doğru ise {} }",
])("desteklenmeyen veya eksik syntax parser tanısı üretir: %s", (metin) => {
  const sonuç = ayrıştır(kaynakOluştur("hatalı.ata", metin));
  expect(sonuç.program).toBeNull();
  expect(sonuç.tanılar.map((tanı) => tanı.kod)).toEqual(["ATA2001"]);
});

test.each([
  ["eksik kol", "Durum::açık eşleştir { Durum::açık ise {} }", "ATA4030"],
  ["boş eşleştirme", "Durum::açık eşleştir {}", "ATA4030"],
  [
    "yinelenen kol",
    "Durum::açık eşleştir { Durum::açık ise {} Durum::açık ise {} Durum::kapalı ise {} }",
    "ATA4029",
  ],
  [
    "yanlış tip kolu",
    "seçenek B { açık }; Durum::açık eşleştir { B::açık ise {} diğer ise {} }",
    "ATA4028",
  ],
  [
    "bilinmeyen kol üyesi",
    "Durum::açık eşleştir { Durum::bilinmeyen ise {} diğer ise {} }",
    "ATA4026",
  ],
  ["bilinmeyen kol tipi", "Durum::açık eşleştir { Olmayan::a ise {} diğer ise {} }", "ATA3004"],
  ["yapı kolu", "yapı K {}; Durum::açık eşleştir { K::a ise {} diğer ise {} }", "ATA4025"],
  ["sayı hedef", "42 eşleştir { diğer ise {} }", "ATA4027"],
  ["yazı hedef", '"Ata" eşleştir { diğer ise {} }', "ATA4027"],
  ["liste hedef", "[1,2] eşleştir { diğer ise {} }", "ATA4027"],
  ["yapı hedef", "yapı K {}; K {} eşleştir { diğer ise {} }", "ATA4027"],
  ["optional hedef", "sabit d: Durum? = yok; d eşleştir { diğer ise {} }", "ATA4027"],
  ["birden fazla diğer", "Durum::açık eşleştir { diğer ise {} diğer ise {} }", "ATA4031"],
  ["diğer son değil", "Durum::açık eşleştir { diğer ise {} Durum::açık ise {} }", "ATA4032"],
  [
    "ulaşılamaz diğer",
    "Durum::açık eşleştir { Durum::açık ise {} Durum::kapalı ise {} diğer ise {} }",
    "ATA4033",
  ],
])("eşleştirme anlam kuralları: %s", (_ad, kod, tanı) => {
  expect(kodlar(tanım + kod)).toContain(tanı);
});

test("eksik üyeler bildirim sırasıyla Türkçe tanıda gösterilir", () => {
  const analiz = analizEt(
    programıAl("seçenek D { a, b, c }; D::a eşleştir { D::a ise {} }"),
    "eksik.ata",
  );
  expect(analiz.tanılar).toHaveLength(1);
  expect(analiz.tanılar[0]).toMatchObject({
    kod: "ATA4030",
    yol: "eksik.ata",
    mesaj: "Eşleştirme bütün durumları kapsamıyor. Eksik: b, c.",
  });
});

test("üye ve kol tanıları tam kaynak aralıklarını taşır", () => {
  const metin = "seçenek D { a, a }; D::a eşleştir { D::a ise {} D::a ise {} }";
  const analiz = analizEt(programıAl(metin));
  expect(analiz.tanılar.map((tanı) => tanı.kod)).toEqual(["ATA4024", "ATA4029"]);
  expect(
    analiz.tanılar.map((tanı) => metin.slice(tanı.aralık.başlangıç.ofset, tanı.aralık.bitiş.ofset)),
  ).toEqual(["a", "D::a"]);
});

test.each([
  ["açık", 'Durum::açık ise { "Açık" yazdır } Durum::kapalı ise { "Kapalı" yazdır }', "Açık"],
  ["kapalı", 'Durum::açık ise { "Açık" yazdır } Durum::kapalı ise { "Kapalı" yazdır }', "Kapalı"],
  ["kapalı", 'Durum::açık ise { "Açık" yazdır } diğer ise { "Başka" yazdır }', "Başka"],
  ["açık", 'diğer ise { "Hepsi" yazdır }', "Hepsi"],
])("runtime yalnızca eşleşen kolu yürütür: %s", (üye, kollar, çıktı) => {
  expect(çalıştır(`${tanım} Durum::${üye} eşleştir { ${kollar} }`)).toEqual([çıktı]);
});

test("eşleştir hedefindeki kullanıcı çağrısı tam bir kez çalışır", () => {
  expect(
    çalıştır(
      tanım +
        'işlev durum_al(): Durum { "çağrıldı" yazdır; Durum::açık döndür }; durum_al() eşleştir { Durum::açık ise { "açık" yazdır } Durum::kapalı ise { "kapalı" yazdır } }',
    ),
  ).toEqual(["çağrıldı", "açık"]);
});

test.each([
  'sabit d = Durum::açık; d eşleştir { diğer ise { "Açık" yazdır } }',
  'yapı K { d: Durum }; sabit k = K { d: Durum::açık }; k.d eşleştir { diğer ise { "Açık" yazdır } }',
  'sabit l: liste<Durum> = [Durum::açık]; l[0] eşleştir { diğer ise { "Açık" yazdır } }',
  'sabit d: Durum? = Durum::açık; eğer d != yok ise { d eşleştir { diğer ise { "Açık" yazdır } } }',
  'sabit d: Durum? = Durum::açık; eğer d == yok ise {} değilse { d eşleştir { diğer ise { "Açık" yazdır } } }',
  'sabit l: liste<Durum?> = [Durum::açık, yok]; l içindeki her d için { eğer d != yok ise { d eşleştir { diğer ise { "Açık" yazdır } } } }',
  'sabit l = [Durum::açık]; sabit d = ilk(l); eğer d != yok ise { d eşleştir { diğer ise { "Açık" yazdır } } }',
])("seçenek mevcut tip/narrowing/erişim sistemleriyle bütünleşir: %s", (kod) => {
  expect(çalıştır(tanım + kod)).toEqual(["Açık"]);
});

test("tip adları ileri toplanır ve değer ad alanından bağımsızdır", () => {
  expect(
    çalıştır(
      "işlev getir(d: Durum): Durum { d döndür }; yapı K { d: Durum? }; sabit Durum = 42; seçenek Durum { açık, kapalı }; getir(Durum::açık) yazdır; Durum yazdır; K { d: Durum::kapalı } yazdır",
    ),
  ).toEqual(["Durum::açık", "42", "K { d: Durum::kapalı }"]);
});

test("eşleştirme kolları bağımsız lexical kapsam kurar", () => {
  expect(
    çalıştır(
      tanım +
        'sabit mesaj = "dış"; Durum::kapalı eşleştir { Durum::açık ise { sabit mesaj = "açık"; mesaj yazdır } Durum::kapalı ise { sabit mesaj = "kapalı"; mesaj yazdır } }; mesaj yazdır',
    ),
  ).toEqual(["kapalı", "dış"]);
  expect(
    kodlar(
      tanım +
        "Durum::kapalı eşleştir { Durum::açık ise { sabit x = 1 } diğer ise { x yazdır } }; x yazdır",
    ),
  ).toEqual(["ATA3001", "ATA3001"]);
});

test("iç içe eşleştirme ve işlev dönüşü normal kontrol akışını izler", () => {
  expect(
    çalıştır(
      tanım +
        "seçenek Yön { kuzey, güney }; işlev kod(d: Durum, y: Yön): sayı { d eşleştir { Durum::açık ise { y eşleştir { Yön::kuzey ise { 1 döndür } Yön::güney ise { 2 döndür } } } Durum::kapalı ise { 0 döndür } } }; kod(Durum::açık, Yön::güney) yazdır",
    ),
  ).toEqual(["2"]);
});

test.each([
  "Durum::açık ise { 1 döndür } Durum::kapalı ise { 0 döndür }",
  "Durum::açık ise { 1 döndür } diğer ise { 0 döndür }",
  "diğer ise { 1 döndür }",
])("bütün kollar dönerse eşleştir kesin dönüş sayılır: %s", (kollar) => {
  expect(kodlar(`${tanım} işlev kod(d: Durum): sayı { d eşleştir { ${kollar} } }`)).toEqual([]);
});

test.each([
  "Durum::açık ise { 1 döndür } Durum::kapalı ise {}",
  "Durum::açık ise {} diğer ise { 0 döndür }",
  "diğer ise { doğru iken { 1 döndür } }",
])("bir kol dönmüyorsa eksik işlev dönüşü korunur: %s", (kollar) => {
  expect(kodlar(`${tanım} işlev kod(d: Durum): sayı { d eşleştir { ${kollar} } }`)).toEqual([
    "ATA4007",
  ]);
});

test("exhaustive olmayan dönüş eşleştirmesi kesin dönüş sayılmaz", () => {
  expect(
    kodlar(tanım + "işlev kod(d: Durum): sayı { d eşleştir { Durum::açık ise { 1 döndür } } }"),
  ).toEqual(["ATA4007", "ATA4030"]);
});

test.each([
  ["Durum::açık == Durum::kapalı", "yanlış"],
  ["Durum::kapalı != Durum::kapalı", "yanlış"],
  ["sabit d: Durum? = yok; d == yok", "doğru"],
  ["sabit d: Durum? = Durum::açık; d == Durum::açık", "doğru"],
])("seçenek ve optional eşitliği: %s", (kod, çıktı) => {
  expect(çalıştır(`${tanım}${kod} yazdır`)).toEqual([çıktı]);
});

test("analiz AST'yi değiştirmez; çıkarılmış nominal/liste tipleri yan tablolarda kalır", () => {
  const program = programıAl(tanım + "sabit l = [Durum::açık]; l[0] eşleştir { diğer ise {} }");
  const önce = JSON.stringify(program);
  const analiz = analizEt(program);
  expect(analiz.tanılar).toEqual([]);
  expect([...analiz.sembolTipleri.values()]).toContainEqual(
    expect.objectContaining({
      tür: "liste",
      eleman: expect.objectContaining({ tür: "seçenek", ad: "Durum" }),
    }),
  );
  expect(JSON.stringify(program)).toBe(önce);
  expect(analizEt(program).tanılar).toEqual([]);
  expect(JSON.stringify(program)).not.toContain("tokenType");
});

test.each([
  "Olmayan::a yazdır",
  "yapı K {}; K::a yazdır",
  tanım + "Durum::bilinmeyen yazdır",
  "seçenek D {}",
  "seçenek D { a, a }",
  "seçenek D { a }; yapı D {}",
  "42 eşleştir { diğer ise {} }",
  tanım + "Durum::kapalı eşleştir { Durum::açık ise {} }",
  "seçenek A { a }; seçenek B { a }; A::a == B::a yazdır",
])("analiz atlanırsa seçenek invariant ihlali güvenli runtime tanısı olur: %s", (kod) => {
  expect(yorumla(programıAl(kod), { çıktıYaz: () => {} }).tanılar.map((tanı) => tanı.kod)).toEqual([
    "ATA5005",
  ]);
});

test("eşleştirme kolundaki atama dış daraltmayı geçersiz kılar", () => {
  expect(
    kodlar(
      tanım +
        'değişken ad: yazı? = "Ata"; eğer ad != yok ise { Durum::açık eşleştir { Durum::açık ise { ad = yok } diğer ise { büyük_harf(ad) yazdır } }; büyük_harf(ad) yazdır }',
    ),
  ).toEqual(["ATA4005"]);
});

test("eşleştirme kolundaki atama döngünün sonraki yinelemesi için görülür", () => {
  expect(
    kodlar(
      tanım +
        'değişken ad: yazı? = "Ata"; eğer ad != yok ise { doğru iken { büyük_harf(ad) yazdır; Durum::açık eşleştir { diğer ise { ad = yok } } } }',
    ),
  ).toEqual(["ATA4005"]);
});

test("eşleştirme hedefinin çağrısı global daraltmayı kollar başlamadan bozar", () => {
  expect(
    kodlar(
      tanım +
        'değişken ad: yazı? = "Ata"; işlev getir(): Durum { ad = yok; Durum::açık döndür }; eğer ad != yok ise { getir() eşleştir { diğer ise { büyük_harf(ad) yazdır } } }',
    ),
  ).toEqual(["ATA4005"]);
});

test("tanımsız eşleştirme hedefi sahte exhaustiveness hatası üretmez", () => {
  expect(kodlar(tanım + "bilinmeyen eşleştir { diğer ise {} }")).toEqual(["ATA3001"]);
});

test("payload çağrısı, seçenek alan erişimi ve aritmetiği desteklenmez", () => {
  expect(kodlar(tanım + "Durum::açık(42)")).toEqual(["ATA4009"]);
  expect(kodlar(tanım + "Durum::açık.ad")).toEqual(["ATA4020"]);
  expect(kodlar(tanım + "Durum::açık + 1")).toEqual(["ATA4011"]);
});

test("eşleştir dönüşü blok ve döngü boyunca taşınır", () => {
  expect(
    çalıştır(
      tanım +
        "işlev kod(): sayı { [Durum::açık] içindeki her d için { d eşleştir { diğer ise { 1 döndür } } }; 0 döndür }; kod() yazdır",
    ),
  ).toEqual(["1"]);
});

test("kol gövdesindeki dönüş tipi ve işlev dışı dönüş kuralları korunur", () => {
  expect(
    kodlar(tanım + 'işlev kod(d: Durum): sayı { d eşleştir { diğer ise { "hata" döndür } } }'),
  ).toEqual(["ATA4006"]);
  expect(kodlar(tanım + "Durum::açık eşleştir { diğer ise { 1 döndür } }")).toEqual(["ATA4013"]);
});

test("eşleştirme kolları yeni blok sonrası daraltma üretmez", () => {
  expect(
    kodlar(
      tanım +
        'değişken ad: yazı? = yok; Durum::açık eşleştir { Durum::açık ise { ad = "A" } diğer ise { ad = "B" } }; büyük_harf(ad) yazdır',
    ),
  ).toEqual(["ATA4005"]);
});
