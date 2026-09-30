import { createToken, Lexer } from "chevrotain";

// Chevrotain'in düzenli ifade dönüşümüne girmeden Unicode özelliklerini korur.
const tanımlayıcıDeseni = /[\p{L}_][\p{L}\p{M}\p{Nd}_]*/uy;
export const Ad = createToken({ name: "Ad", pattern: Lexer.NA, label: "tanımlayıcı" });
export const Tanımlayıcı = createToken({
  name: "Tanımlayıcı",
  categories: Ad,
  pattern: (metin, ofset) => {
    tanımlayıcıDeseni.lastIndex = ofset;
    return tanımlayıcıDeseni.exec(metin);
  },
  line_breaks: false,
});

export const Yazı = createToken({
  name: "Yazı",
  pattern: (metin, ofset) => {
    if (metin[ofset] !== '"') return null;
    let son = ofset + 1;
    while (son < metin.length && metin[son] !== "\r" && metin[son] !== "\n") {
      const karakter = metin[son++];
      if (karakter === "{") return null;
      if (karakter === '"') break;
      if (karakter === "\\" && son < metin.length && metin[son] !== "\r" && metin[son] !== "\n") {
        son += metin.codePointAt(son)! > 0xffff ? 2 : 1;
      }
    }
    return [metin.slice(ofset, son)];
  },
  line_breaks: false,
  start_chars_hint: ['"'],
});

export const YazıBaşlangıcı = createToken({
  name: "YazıBaşlangıcı",
  label: '"',
  pattern: (metin, ofset) => (metin[ofset] === '"' ? ['"'] : null),
  push_mode: "yazı",
  line_breaks: false,
  start_chars_hint: ['"'],
});
export const YazıSonu = createToken({
  name: "YazıSonu",
  label: '"',
  pattern: '"',
  pop_mode: true,
});
export const YerleştirmeBaşlangıcı = createToken({
  name: "YerleştirmeBaşlangıcı",
  label: "{",
  pattern: "{",
  push_mode: "ifade",
});
export const YerleştirmeSonu = createToken({
  name: "YerleştirmeSonu",
  label: "}",
  pattern: "}",
  pop_mode: true,
});
export const YazıMetni = createToken({
  name: "YazıMetni",
  pattern: /(?:[^"{\\\r\n]|\\[^\r\n])+/,
  line_breaks: false,
});
export const YazıSatırSonu = createToken({
  name: "YazıSatırSonu",
  pattern: /\r\n|\r|\n/,
  line_breaks: true,
  pop_mode: true,
});

export const ÇokSatırlıAçıklama = createToken({
  name: "ÇokSatırlıAçıklama",
  pattern: (metin, ofset) => {
    if (!metin.startsWith("/*", ofset)) return null;
    const kapanış = metin.indexOf("*/", ofset + 2);
    return [metin.slice(ofset, kapanış < 0 ? metin.length : kapanış + 2)];
  },
  group: "açıklamalar",
  line_breaks: true,
  start_chars_hint: ["/"],
});

const ayrılmışSözcükler = [
  "sabit",
  "değişken",
  "işlev",
  "döndür",
  "eğer",
  "ise",
  "değilse",
  "iken",
  "içindeki",
  "her",
  "için",
  "ve",
  "veya",
  "değil",
  "doğru",
  "yanlış",
  "yok",
  "sayı",
  "yazı",
  "mantık",
  "hiç",
  "liste",
  "yazdır",
];

export const SatırSonu = createToken({
  name: "SatırSonu",
  label: "satır sonu",
  pattern: /\r\n|\r|\n/,
  line_breaks: true,
});

export const tokenTürleri = [
  Ad,
  SatırSonu,
  createToken({ name: "Boşluk", pattern: /[^\S\r\n]+/, group: Lexer.SKIPPED, line_breaks: false }),
  createToken({ name: "TekSatırlıAçıklama", pattern: /\/\/[^\r\n]*/, group: Lexer.SKIPPED }),
  ÇokSatırlıAçıklama,
  Yazı,
  YazıBaşlangıcı,
  ...ayrılmışSözcükler
    .toSorted((a, b) => b.length - a.length)
    .map((sözcük) =>
      createToken({
        name: sözcük,
        pattern: sözcük,
        longer_alt: Tanımlayıcı,
        // Spesifikasyondaki kare(sayı) ve her sayı örneklerinde bağlama göre ad olur.
        categories: sözcük === "sayı" ? [Ad] : [],
      }),
    ),
  Tanımlayıcı,
  createToken({ name: "Sayı", pattern: /[0-9]+(?:\.[0-9]+)?/ }),
  ...(
    [
      ["+=", "ToplayarakAta"],
      ["-=", "ÇıkararakAta"],
      ["*=", "ÇarparakAta"],
      ["/=", "BölerekAta"],
      ["%=", "KalanlaAta"],
      ["==", "Eşit"],
      ["!=", "EşitDeğil"],
      ["<=", "KüçükEşit"],
      [">=", "BüyükEşit"],
      ["=", "Ata"],
      ["+", "Artı"],
      ["-", "Eksi"],
      ["*", "Çarpı"],
      ["/", "Bölü"],
      ["%", "Kalan"],
      ["<", "Küçük"],
      [">", "Büyük"],
      ["(", "SolParantez"],
      [")", "SağParantez"],
      ["{", "SolSüslü"],
      ["}", "SağSüslü"],
      ["[", "SolKöşeli"],
      ["]", "SağKöşeli"],
      [",", "Virgül"],
      [":", "İkiNokta"],
      [".", "Nokta"],
      [";", "NoktalıVirgül"],
      ["?", "Soru"],
    ] as const
  ).map(([işaret, ad]) => createToken({ name: ad, label: işaret, pattern: işaret })),
];

// Ortak ifade tokenları her iki kod modunda aynıdır; yalnızca kapanış farklıdır.
export const lexerModları = {
  defaultMode: "kod",
  modes: {
    kod: [...tokenTürleri],
    yazı: [YazıSonu, YerleştirmeBaşlangıcı, YazıMetni, YazıSatırSonu],
    ifade: [YerleştirmeSonu, ...tokenTürleri.filter((tür) => tür.name !== "SağSüslü")],
  },
};

// Parser tüm modların sözcüklerini tanır, lexer yalnızca etkin modu kullanır.
tokenTürleri.push(YazıSonu, YerleştirmeBaşlangıcı, YerleştirmeSonu, YazıMetni, YazıSatırSonu);
