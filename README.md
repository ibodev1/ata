# Ata Dil

Ata, Türkçenin düşünce sırasını ve doğal yapısını sözdizimine yansıtmayı amaçlayan deneysel bir hobi ve öğrenme projesidir. Kaynak dosyalarının uzantısı `.ata`, mevcut sürüm **0.1.0-dev.3** (Aşama 3).

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

Sözcük çözümleyici, Chevrotain ayrıştırıcısı, CST'den bağımsız AST üretimi, isim çözümleme ve statik tip denetimi mevcuttur. `çalıştır` bu aşamaları uygular; hata durumunda Türkçe tanılarla çıkış kodu 1 olur. Yorumlayıcı henüz uygulanmadı. Yazı içindeki `{ad}` bu aşamada düz metindir.

## Kaynak ve konumlar

Kaynak UTF-8 olarak okunur; bozuk UTF-8 reddedilir. Sözcük çözümlemeden önce tüm içerik NFC biçimine normalleştirilir. Unicode tanımlayıcılar ve küçük harfli ayrılmış sözcükler büyük/küçük harfe duyarlıdır.

Satır ve sütunlar 1'den, ofsetler 0'dan başlar. Konumlar normalleştirilmiş metnin UTF-16 birimlerine göredir; kaynak aralıklarının bitişi dışlayıcıdır. Chevrotain tokenlarında bitiş konumları kapsayıcıdır. LF ve CRLF desteklenir; tek CR de satır sonudur. Yazılar tek satırlıdır; satır sonları `\n` ve `\r` kaçışlarıyla yazılır.

Yalnızca onluk tam ve kesirli sayılar desteklenir. AST sayı değerleri JavaScript `number` biçimindedir; sonlu olmayan değerler ve güvenli tam sayı aralığını aşan tam sayı literalleri `ATA2002` tanısı üretir.

Genel dışa aktarımlar `src/index.ts` içindedir. `kaynakOluştur` / `kaynakOku` ile kaynak, `sözcüklereAyır(kaynak)` ile `{ tokenlar, tanılar }`, `ayrıştır(kaynak)` ile `{ program, tanılar }` elde edilir. Hata varsa `program` değeri `null` olur. Lexer tanısı varsa parser çalıştırılmaz. `ATA1xxx` sözcük çözümleme, `ATA2xxx` ayrıştırma tanılarıdır.

Bildirimleri yeni satır veya `;` ayırır. Parser için `sözcüklereAyır(kaynak, { satırSonlarınıKoru: true })` satır sonlarını token olarak korur; varsayılan lexer sonucu önceki davranışı sürdürür. Açıklama içindeki satır sonları da korunur. Parantez ve liste içindeki satır sonları bildirim sınırı sayılmaz.

İşlevler yalnızca üst seviyede tanımlanır. `değil` ve `yazdır` postfix kullanılır. Spesifikasyondaki `kare(sayı)` ve `her sayı` örnekleri için ayrılmış `sayı` sözcüğü parser'da ad bağlamında da kabul edilir; tip bağlamında temel tiptir. Diğer ayrılmış sözcükler ad yerine kullanılamaz.

## Anlamsal analiz

`analizEt(program, kaynak.yol)` isim çözümleme ve tip denetimini çalıştırır. Yol verilmezse tanılarda `<kaynak>` kullanılır. Sonuç `tanılar`, `ifadeTipleri`, `sembolTipleri` ve `işlevİmzaları` içerir; AST değiştirilmez. `ATA3xxx` isim çözümleme, `ATA4xxx` tip/anlam tanılarıdır.

Tek ad alanı ve lexical kapsam kullanılır. Aynı kapsamda yinelenen ad reddedilir; iç bloklarda gölgeleme mümkündür. Değerler başlangıç ifadeleri denetlendikten sonra görünür olur. Üst seviye işlevler önceden toplanır; karşılıklı özyineleme desteklenir. İşlev gövdelerinde de global değerlerin tanımlama sırası geçerlidir. Parametreler ve liste döngüsü değişkenleri değiştirilemez; işlev adları yalnızca çağrı hedefi olarak kullanılabilir.

Tipler `sayı`, `yazı`, `mantık`, `hiç`, `liste<T>` ve `T?` biçimindedir. `T` ve `yok`, `T?` tipine atanabilir; tersi geçerli değildir. İç içe isteğe bağlı tip desteklenmez. Açık tip yoksa başlangıç ifadesinden tip çıkarılır; tek başına `yok` veya boş liste yeterli değildir. Açık tip, çağrı argümanı veya dönüş bağlamı boş listelere tip sağlar; `liste<yazı?>` bağlamında `["a", yok]` geçerlidir. Liste tiplerinin eleman tipleri yapısal olarak aynı olmalıdır; liste eşitliği reddedilir. İsteğe bağlı liste ile `yok` karşılaştırılabilir.

Değer döndüren işlevlerde doğrudan dönüş, iki kolu da dönen koşul ve blok sırası üzerinden tüm yollar denetlenir. Döngüler kesin dönüş sayılmaz. Tanımsız adlardan sonra kullanılan iç `bilinmeyen` tipi gereksiz hata zincirlerini bastırır.

## Commit düzeni

Commit mesajları Türkçe ve emojisizdir: `özellik:`, `düzeltme:`, `yeniden:`, `test:`, `belge:`, `bakım:`, `başarım:`, `derleme:`, `ci:`. İlk proje commitindeki emoji mevcut geçmişin tek istisnasıdır.
