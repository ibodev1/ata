# Ata Dil

Ata, Türkçenin düşünce sırasını ve doğal yapısını sözdizimine yansıtmayı amaçlayan deneysel bir hobi ve öğrenme projesidir. Kaynak dosyalarının uzantısı `.ata`, mevcut sürüm **0.1.0-dev.2** (Aşama 2).

Bun 1.4.2, TypeScript 7 ve Chevrotain kullanılır. Tek paketli proje ESM biçimindedir; testler `bun:test` ile çalışır. Tek çalışma zamanı bağımlılığı Chevrotain'dir. Kod kalitesi Oxlint, biçimlendirme Oxfmt ile denetlenir; `.ata` dosyaları Oxfmt kapsamı dışındadır.

## Geliştirme

```sh
bun install
bun run dev yardım
bun run src/cli/cli.ts sürüm
bun run src/cli/cli.ts çalıştır örnekler/merhaba.ata
bun run typecheck
bun run lint
bun run format
bun run format:check
bun test
bun run check
```

## Örnek

```ata
sabit ad = "İbrahim"
değişken sayaç = 0

eğer sayaç < 10 ise {
    "Merhaba {ad}" yazdır
}
```

Sözcük çözümleyici, Chevrotain ayrıştırıcısı ve CST'den bağımsız AST üretimi mevcuttur. `çalıştır` kaynağı okur, sözcüklere ayırır ve AST oluşturur; hata durumunda Türkçe tanılarla çıkış kodu 1 olur. Henüz isim çözümleme, tip denetleyici veya yorumlayıcı yoktur. Yazı içindeki `{ad}` bu aşamada düz metindir.

## Kaynak ve konumlar

Kaynak UTF-8 olarak okunur; bozuk UTF-8 reddedilir. Sözcük çözümlemeden önce tüm içerik NFC biçimine normalleştirilir. Unicode tanımlayıcılar ve küçük harfli ayrılmış sözcükler büyük/küçük harfe duyarlıdır.

Satır ve sütunlar 1'den, ofsetler 0'dan başlar. Konumlar normalleştirilmiş metnin UTF-16 birimlerine göredir; kaynak aralıklarının bitişi dışlayıcıdır. Chevrotain tokenlarında bitiş konumları kapsayıcıdır. LF ve CRLF desteklenir; tek CR de satır sonudur. Yazılar tek satırlıdır; satır sonları `\n` ve `\r` kaçışlarıyla yazılır.

Yalnızca onluk tam ve kesirli sayılar desteklenir. AST sayı değerleri JavaScript `number` biçimindedir; sonlu olmayan değerler ve güvenli tam sayı aralığını aşan tam sayı literalleri `ATA2002` tanısı üretir.

Genel dışa aktarımlar `src/index.ts` içindedir. `kaynakOluştur` / `kaynakOku` ile kaynak, `sözcüklereAyır(kaynak)` ile `{ tokenlar, tanılar }`, `ayrıştır(kaynak)` ile `{ program, tanılar }` elde edilir. Hata varsa `program` değeri `null` olur. Lexer tanısı varsa parser çalıştırılmaz. `ATA1xxx` sözcük çözümleme, `ATA2xxx` ayrıştırma tanılarıdır.

Bildirimleri yeni satır veya `;` ayırır. Parser için `sözcüklereAyır(kaynak, { satırSonlarınıKoru: true })` satır sonlarını token olarak korur; varsayılan lexer sonucu önceki davranışı sürdürür. Açıklama içindeki satır sonları da korunur. Parantez ve liste içindeki satır sonları bildirim sınırı sayılmaz.

İşlevler yalnızca üst seviyede tanımlanır. `değil` ve `yazdır` postfix kullanılır. Spesifikasyondaki `kare(sayı)` ve `her sayı` örnekleri için ayrılmış `sayı` sözcüğü parser'da ad bağlamında da kabul edilir; tip bağlamında temel tiptir. Diğer ayrılmış sözcükler ad yerine kullanılamaz.

## Commit düzeni

Commit mesajları Türkçe ve emojisizdir: `özellik:`, `düzeltme:`, `yeniden:`, `test:`, `belge:`, `bakım:`, `başarım:`, `derleme:`, `ci:`. İlk proje commitindeki emoji mevcut geçmişin tek istisnasıdır.
