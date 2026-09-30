# Ata Dil

Ata, Türkçenin düşünce sırasını ve doğal yapısını sözdizimine yansıtmayı amaçlayan deneysel bir hobi ve öğrenme projesidir. Unicode/Türkçe tanımlayıcıları, statik tip denetimi, lexical kapsamı, kullanıcı işlevleri, yapıları ve listeleri olan yorumlanan bir dildir. Kaynak dosyalarının uzantısı `.ata`, mevcut sürüm **0.1.0-dev.8** (Aşama 8).

Bun 1.4.2, TypeScript 7 ve Chevrotain kullanılır. Tek paketli proje ESM biçimindedir; testler `bun:test` ile çalışır. Tek çalışma zamanı bağımlılığı Chevrotain'dir. Kod kalitesi Oxlint, biçimlendirme Oxfmt ile denetlenir; `.ata` dosyaları Oxfmt kapsamı dışındadır.

## Geliştirme

```sh
bun install
bun run dev yardım
bun run src/cli/cli.ts sürüm
bun run src/cli/cli.ts denetle örnekler/merhaba.ata
bun run src/cli/cli.ts çalıştır örnekler/merhaba.ata
bun run src/cli/cli.ts çalıştır örnekler/temeller.ata
bun run src/cli/cli.ts çalıştır örnekler/girdi.ata
bun run src/cli/cli.ts denetle örnekler/güvenli-girdi.ata
bun run src/cli/cli.ts çalıştır örnekler/güvenli-girdi.ata
bun run src/cli/cli.ts denetle örnekler/yapılar.ata
bun run src/cli/cli.ts çalıştır örnekler/yapılar.ata
bun run typecheck
bun run lint
bun run format
bun run format:check
bun test
bun run check
```

## Örnek

```ata
sabit ad = "Dünya"
"Merhaba {ad}!" yazdır
```

`ata çalıştır merhaba.ata` mantığında `çalıştır` kaynağı sözcüklere ayırır, ayrıştırır, AST oluşturur, isim ve tip denetimini yapar; tanı yoksa tree-walk yorumlayıcıyla yürütür. Geliştirme ortamında `bun run dev çalıştır örnekler/merhaba.ata` kullanılır. Başarıda yalnızca program çıktısı gösterilir; çıkış kodu 0, hata durumunda Türkçe tanılarla 1 olur. Yukarıdaki programın çıktısı `Merhaba Dünya!` olur.

`ata denetle dosya.ata` aynı kaynak → ayrıştırma → analiz hattını kullanır ve yorumlayıcıyı çalıştırmaz. Başarıda `Denetim başarılı.` ve çıkış kodu 0; ön yüz hatalarında Türkçe tanılar ve çıkış kodu 1 üretir. Örneğin `1 / 0 yazdır` denetimden geçer, çalıştırmada `ATA5001` verir.

## Yapılar ve liste indeksleme

```ata
yapı Kullanıcı {
    ad: yazı
}

sabit kişi = Kullanıcı { ad: "İbrahim" }
kişi.ad yazdır
[kişi][0].ad yazdır
```

Yapılar yalnızca üst seviyede tanımlanır; her alanın tipi ve oluşturma sırasında değeri zorunludur. Alanlar satır sonu veya virgülle ayrılır, son virgül kabul edilir. Yapı adları ayrı tip ad alanında bulunur; aynı adlı değer/işlev olabilir. Tipler nominaldir: aynı alanları taşıyan farklı yapı adları birbirine atanamaz. İleri ve recursive tipler (`sonraki: Düğüm?`) desteklenir; alan ifadeleri kaynak sırasıyla değerlendirilir.

Alan okuma ve liste indeksleme çağrıyla zincirlenebilir: `getir()[0].adres.şehir`. İndeksleme yalnızca listelerde geçerlidir; `liste<T>[sayı]` sonucu `T` olur. İndeks güvenli tam sayı değilse `ATA5008`, negatif veya sınır dışındaysa `ATA5009` üretilir. İsteğe bağlı yapı/liste doğrudan okunamaz; yapı eşitliği, alan/indeks ataması ve yazı indeksleme desteklenmez. Değiştirilebilir yapı bağının tamamı yeniden atanabilir. Yazdırma, yerleştirme ve `yazıya`, yapıları `Kullanıcı { ad: "İbrahim" }` biçiminde gösterir.

Yeni anlamsal tanılar: `ATA3004` tanımsız tip, `ATA3005` yinelenen yapı adı; `ATA4017` eksik alan, `ATA4018` yinelenen alan, `ATA4019` bulunamayan alan, `ATA4020` yapı gerektiren alan erişimi, `ATA4021` liste gerektiren indeksleme, `ATA4022` sayı olmayan indeks. Alan tipi uyuşmazlığında mevcut `ATA4001` kullanılır.

## İsteğe bağlı tip daraltma

```ata
yapı Kullanıcı { ad: yazı }
değişken kullanıcı: Kullanıcı? = yok
kullanıcı = Kullanıcı { ad: "İbrahim" }

eğer kullanıcı != yok ise {
    "Merhaba {kullanıcı.ad}!" yazdır
}
```

Çıktı: `Merhaba İbrahim!`. `!= yok` doğru kolda `T?` adını `T` olarak görür; `== yok` için aynı bilgi `değilse` kolundadır. Operand sırası değişebilir; postfix `değil` kolları tersler. `ve` sağ tarafı solun doğru, `veya` sağ tarafı solun yanlış bilgisiyle denetlenir. `iken` gövdesi koşulun doğru bilgisiyle girer. Yapı, liste, yazı, sabit, parametre ve liste döngüsü adları desteklenir; bildirilmiş tip değişmez.

Her atama, yeni değer dolu olsa bile mutable adın daraltmasını temel tipe sıfırlar. Kullanıcı işlevi çağrısı global mutable optional adların daraltmasını kaldırır; yerel mutable adlar ve yerleşik çağrılar bu kuraldan etkilenmez. Döngüde yazılabilecek bağlar girişte sıfırlanır, koşul yeniden daraltabilir. Blok/döngü sonrasına yeni daraltma taşınmaz. Alan/indeks yolları, alias takibi, atamadan tip çıkarımı ve erken dönüşten sonraki guard daraltması yoktur. Optional alanı önce `sabit adres = kişi.adres` gibi bir ada bağlayıp o adı sınamak mümkündür.

## Temel standart işlevler

Yerleşikler normal tanımlayıcılardır; global kapsamda hazır bulunurlar, aynı kapsamda yeniden tanımlanamazlar; iç kapsamda gölgelenebilirler. Kullanıcı işlevleri gibi yalnızca çağrı hedefi olarak kullanılabilirler.

| İşlev                             | Kabul edilen argümanlar              | Sonuç     |
| --------------------------------- | ------------------------------------ | --------- |
| `girdi`                           | sıfır argüman veya bir `yazı` istemi | `yazı`    |
| `uzunluk`                         | `yazı` veya `liste<T>`               | `sayı`    |
| `yazıya`                          | `hiç` dışındaki kullanıcı değeri     | `yazı`    |
| `büyük_harf`, `küçük_harf`        | `yazı`                               | `yazı`    |
| `kırp`                            | `yazı`                               | `yazı`    |
| `içerir`, `başlar_mı`, `biter_mi` | iki `yazı`                           | `mantık`  |
| `sayıya`                          | `yazı`                               | `sayı?`   |
| `mantığa`                         | `yazı`                               | `mantık?` |
| `al`                              | `liste<T>`, `sayı`                   | `T?`      |
| `ilk`, `son`                      | `liste<T>`                           | `T?`      |

Güvenli dönüşüm ve erişim başarısızlığında tanı yerine `yok` döner. `sayıya` Unicode boşlukları kırpar; işaretli/işaretsiz tam sayı veya noktalı ondalık metni kabul eder (`+42`, `001.50`). Üslü gösterim, hex/binary, virgül, `.5`, `1.`, boş metin ve sonsuza taşan sonuç reddedilir. Sonlu sayılar JavaScript `number` hassasiyetini kullanır. `mantığa` açık `tr-TR` ile yalnızca `doğru` / `yanlış` metinlerini, harf büyüklüğünden bağımsız kabul eder; `true`, `false`, `1`, `0` kabul edilmez.

`al` negatif, sınır dışı, kesirli veya güvenli tam sayı olmayan indekste `yok` döner; doğrudan `liste[indeks]` hata üretmeye devam eder. `ilk` / `son` boş listede `yok`, dolu listede ilgili uç elemanı döndürür. Eleman zaten `T?` ise sonuç yine `T?` olur; `T??` üretilmez. Boş listede eleman tipi açıkça belirtilmelidir. Bu yardımcılar kullanıcı generics sözdizimi eklemez.

```ata
sabit yaş = sayıya("21")
eğer yaş != yok ise {
    yaş + 1 yazdır
}
```

Çıktı: `22`. `örnekler/güvenli-girdi.ata`, `sayıya(girdi(...))` ile aynı denetimi gerçek girdiye uygular.

`girdi("Adınız: ")` senkron çalışır; CLI istemi aynen gösterip stdin'den UTF-8 satır okur (LF/CRLF). Bun `prompt` isteme ek boşluk kattığından küçük bir senkron okuyucu kullanılır. Interpreter testlerinde `yorumla(program, { çıktıYaz, girdiOku: (istem) => "İbrahim" })` ile girdi enjekte edilir. Girdi sağlayıcısı yoksa, `null` döndürürse veya hata atarsa `ATA5007: Girdi okunamadı.` üretilir; boş yazı geçerli girdidir.

`uzunluk` yazılarda Unicode code point sayar: `uzunluk("😊")` sonucu 1'dir; grapheme cluster sayımı yapmaz. Listelerde eleman sayısını verir; `uzunluk([])` geçerlidir. İsteğe bağlı yazı/liste doğrudan kabul edilmez. `yazıya`, yazdırma ve yerleştirmeyle aynı gösterimi kullanır; isteğe bağlı değerler, `yok` ve listeler desteklenir, yazı aynen döner.

Harf dönüşümleri açık `tr-TR` locale kullanır: `büyük_harf("istanbul")` → `İSTANBUL`, `küçük_harf("IĞDIR")` → `ığdır`. `kırp` baştaki/sondaki Unicode boşlukları kaldırır. Arama işlevleri büyük/küçük harfe duyarlıdır.

```ata
sabit ad = büyük_harf("ata")
sabit boyut = uzunluk(ad)
"{ad}: {boyut}" yazdır
```

Çıktı: `ATA: 3`. Etkileşimli kullanım için `örnekler/girdi.ata` bulunur.

## Kaynak ve konumlar

Kaynak UTF-8 olarak okunur; bozuk UTF-8 reddedilir. Sözcük çözümlemeden önce tüm içerik NFC biçimine normalleştirilir. Unicode tanımlayıcılar ve küçük harfli ayrılmış sözcükler büyük/küçük harfe duyarlıdır.

Satır ve sütunlar 1'den, ofsetler 0'dan başlar. Konumlar normalleştirilmiş metnin UTF-16 birimlerine göredir; kaynak aralıklarının bitişi dışlayıcıdır. Chevrotain tokenlarında bitiş konumları kapsayıcıdır. LF ve CRLF desteklenir; tek CR de satır sonudur. Yazılar tek satırlıdır; satır sonları `\n` ve `\r` kaçışlarıyla yazılır. Desteklenen kaçışlar `\"`, `\\`, `\n`, `\r`, `\t`, `\{` ve `\}` biçimindedir.

Yalnızca onluk tam ve kesirli sayılar desteklenir. AST sayı değerleri JavaScript `number` biçimindedir; sonlu olmayan değerler ve güvenli tam sayı aralığını aşan tam sayı literalleri `ATA2002` tanısı üretir.

Genel dışa aktarımlar `src/index.ts` içindedir. `kaynakOluştur` / `kaynakOku` ile kaynak, `sözcüklereAyır(kaynak)` ile `{ tokenlar, tanılar }`, `ayrıştır(kaynak)` ile `{ program, tanılar }` elde edilir. Hata varsa `program` değeri `null` olur. Lexer tanısı varsa parser çalıştırılmaz. `ATA1xxx` sözcük çözümleme, `ATA2xxx` ayrıştırma tanılarıdır.

Bildirimleri yeni satır veya `;` ayırır. Parser için `sözcüklereAyır(kaynak, { satırSonlarınıKoru: true })` satır sonlarını token olarak korur; varsayılan lexer sonucu önceki davranışı sürdürür. Açıklama içindeki satır sonları da korunur. Parantez ve liste içindeki satır sonları bildirim sınırı sayılmaz.

İşlevler yalnızca üst seviyede tanımlanır. `değil` ve `yazdır` postfix kullanılır. Spesifikasyondaki `kare(sayı)` ve `her sayı` örnekleri için ayrılmış `sayı` sözcüğü parser'da ad bağlamında da kabul edilir; tip bağlamında temel tiptir. Diğer ayrılmış sözcükler ad yerine kullanılamaz.

## Anlamsal analiz

`analizEt(program, kaynak.yol)` isim çözümleme ve tip denetimini çalıştırır. Yol verilmezse tanılarda `<kaynak>` kullanılır. Sonuç `tanılar`, `ifadeTipleri`, `sembolTipleri` ve `işlevİmzaları` içerir; AST değiştirilmez. `ATA3xxx` isim çözümleme, `ATA4xxx` tip/anlam tanılarıdır.

Tek ad alanı ve lexical kapsam kullanılır. Aynı kapsamda yinelenen ad reddedilir; iç bloklarda gölgeleme mümkündür. Değerler başlangıç ifadeleri denetlendikten sonra görünür olur. Üst seviye işlevler önceden toplanır; karşılıklı özyineleme desteklenir. İşlev gövdelerinde de global değerlerin tanımlama sırası geçerlidir. Parametreler ve liste döngüsü değişkenleri değiştirilemez; işlev adları yalnızca çağrı hedefi olarak kullanılabilir.

Tipler `sayı`, `yazı`, `mantık`, `hiç`, `liste<T>` ve `T?` biçimindedir. `T` ve `yok`, `T?` tipine atanabilir; tersi geçerli değildir. İç içe isteğe bağlı tip desteklenmez. Açık tip yoksa başlangıç ifadesinden tip çıkarılır; tek başına `yok` veya boş liste yeterli değildir. Açık tip, çağrı argümanı veya dönüş bağlamı boş listelere tip sağlar; `liste<yazı?>` bağlamında `["a", yok]` geçerlidir. Liste tiplerinin eleman tipleri yapısal olarak aynı olmalıdır; liste eşitliği reddedilir. İsteğe bağlı liste ile `yok` karşılaştırılabilir.

Değer döndüren işlevlerde doğrudan dönüş, iki kolu da dönen koşul ve blok sırası üzerinden tüm yollar denetlenir. Döngüler kesin dönüş sayılmaz. Tanımsız adlardan sonra kullanılan iç `bilinmeyen` tipi gereksiz hata zincirlerini bastırır.

## Çalışma zamanı ve yazı yerleştirme

`"Sonuç: {kare(5)}, toplam: {1 + 2}"` içindeki süslü parantezler normal Ata ifadeleri içerir. Yerleştirme lexer modları ve parser üzerinden AST'ye taşınır; çalışma zamanında yeniden ayrıştırma yapılmaz. Düz ve yerleştirmeli yazılar aynı `parçalar` modelini kullanır. Literal parantezler için `"\{değer\}"` yazılır.

`yazdır` ve yerleştirme aynı değer gösterimini kullanır: mantık `doğru`/`yanlış`, eksik isteğe bağlı değer `yok`, liste `[1, 2, 3]` olarak görünür. Listelerde yazı elemanları tırnaklı gösterilir. `hiç`, `yok` değerinden ayrıdır; doğrudan yazdırılamaz veya yerleştirilemez (`ATA4016`). `ve` ve `veya` kısa devrelidir.

`yorumla(program, { yol, çıktıYaz })` analizden geçen AST'yi yürütür ve `{ tanılar }` döndürür; çıktı callback üzerinden iletilir. Her çalıştırma bağımsız lexical ortam kurar. İşlevler küresel ortama bağlanır, çağrılar değiştirilemez parametrelerle yeni ortam açar. `döndür` blok ve döngüler boyunca ayrı akış sonucu olarak taşınır. İlk çalışma zamanı hatasında yürütme durur; önceki çıktılar korunur.

Çalışma zamanı tanıları: `ATA5001` sıfıra bölme, `ATA5002` sıfıra göre kalan, `ATA5003` sonlu olmayan sonuç, `ATA5004` bağlama/ortam sorunu, `ATA5005` beklenmeyen değer veya yürütme durumu, `ATA5006` çağrı derinliği sınırı, `ATA5007` okunamayan girdi. JavaScript yığın taşmasını önlemek için en fazla 256 etkin çağrı değerlendirmesi desteklenir. Beklenen çalışma zamanı hataları tanıya çevrilir; beklenmeyen programlama veya çıktı callback hataları yutulmaz.

## Commit düzeni

Commit mesajları Türkçe ve emojisizdir: `özellik:`, `düzeltme:`, `yeniden:`, `test:`, `belge:`, `bakım:`, `başarım:`, `derleme:`, `ci:`. İlk proje commitindeki emoji mevcut geçmişin tek istisnasıdır.
