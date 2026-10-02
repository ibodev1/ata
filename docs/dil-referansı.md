# Ata Dil referansı

Bu belge mevcut 0.2 dilini tanımlar. Dil deneysel ve statik tip denetimli bir yorumlayıcıdır.

## Kaynak ve değerler

Dosyalar `.ata` uzantılı, geçerli UTF-8 metinlerdir; kaynak NFC'ye normalize edilir. Unicode harfler ve alt çizgi tanımlayıcı başlatabilir; devamında rakamlar ve birleştirici işaretler de kullanılabilir. Adlar büyük/küçük harfe duyarlıdır; ayrılmış sözcükler ad olamaz (`sayı` ad bağlamında kabul edilen istisnadır). Bildirimler satır sonu veya `;` ile ayrılır. `//` satır yorumu, `/* ... */` iç içe geçmeyen blok yorumudur.

Temel değer tipleri `sayı`, `yazı`, `mantık`tır. `hiç` yalnızca işlev dönüş tipi olarak kullanılabilir; işlevin değer döndürmediğini belirtir. Değer tipi değildir: sabit/değişken, parametre veya yapı alanı tipi olamaz ve `hiç?`, `liste<hiç>` gibi bileşik tiplerde kullanılamaz. Mantık değerleri `doğru` ve `yanlış`; eksik değer `yok`tur. `T?`, gerçek bir değer tipi olan `T` veya `yok` kabul eder; ikinci isteğe bağlı katman desteklenmez. Tip belirtilmezse başlangıç ifadesinden çıkarılır; tek başına `yok` ve boş liste yeterli bilgi sağlamaz.

```ata
// Sabit bağ yeniden atanamaz; değişken bağ atanabilir.
sabit ad: yazı = "İbrahim"
değişken yaş: sayı = 20
yaş += 1
sabit eksik: sayı? = yok
sabit sayılar: liste<sayı> = [1, 2, 3]
"{ad}: {yaş}" yazdır
```

Sayılar sonlu sayısal değerlerdir. Kaynakta ondalık nokta kullanılır; üs/hex gösterimi yoktur, tam sayı literalleri güvenli tam sayı aralığında olmalıdır. Listeler homojen ve değişmezdir; bağın tamamı yeniden atanabilir. Yazılar çift tırnaklıdır; kaçışlar `\"`, `\\`, `\n`, `\r`, `\t`, `\{`, `\}`. Yazı içinde `{ifade}` değerlendirilerek gösterilir; `hiç` yerleştirilemez veya yazdırılamaz.

## Yapılar ve seçenekler

Yapı ve seçenek bildirimleri yalnızca üst seviyede bulunur. Ortak tip ad alanları değer adlarından ayrıdır. Tipler nominaldir: aynı alanları/üyeleri olan farklı adlar birbirine atanamaz. İleri ve özyinelemeli tip başvuruları mümkündür. Alan/üye bildirimleri virgül veya satır sonuyla ayrılır; son virgül kabul edilir.

```ata
seçenek Durum { açık, kapalı }
yapı Kişi { ad: yazı, durum: Durum }
sabit kişi = Kişi { ad: "İbrahim", durum: Durum::açık }
kişi.ad yazdır
[kişi][0].ad yazdır
kişi.durum eşleştir {
    Durum::açık ise { "Açık" yazdır }
    diğer ise { "Kapalı" yazdır }
}
```

Yapının bütün alanları tam bir kez verilmelidir; alan değerleri kaynak sırasıyla değerlendirilir. Alanlar değiştirilemez. Seçenekler en az bir üye taşır; üyeler payload taşımaz. Aynı seçenek tipinin değerleri eşitlikle karşılaştırılabilir.

`eşleştir` hedefini bir kez değerlendirir ve tek kolu çalıştıran bir bildirimdir. Bütün üyeler kapsanmalıdır. `diğer` en fazla bir kez ve son kol olarak kullanılabilir; bütün üyeler zaten kapsanmışsa reddedilir. Kol başına ayrı kapsam vardır. Geçerli eşleştirmenin bütün kolları dönerse kesin dönüş sağlar.

Liste indeksleri sıfırdan başlar. `liste[index]` sonucunun tipi eleman tipidir; indeks güvenli tam sayı ve sınırlar içinde olmalıdır. İsteğe bağlı liste/yapı önce daraltılmalıdır. Yazı indeksleme, alan veya indeks ataması yoktur.

## İşlevler ve kontrol akışı

İşlevler üst seviyede tanımlanır; ileri çağrı ve özyineleme desteklenir. Parametreler değişmezdir. İşlevler değer olarak taşınamaz; doğrudan adla veya modül ad alanından çağrılır. Değer döndüren işlev bütün yollarında uygun tipte dönmelidir. Çağrı derinliği 256 ile sınırlıdır.

Yalnızca çıplak `hiç` dönüş anotasyonu geçerlidir; `hiç?` veya `liste<hiç>` dönüşü geçersizdir. `hiç` döndüren çağrı tek başına ifade bildirimi olarak çalışır; sonucu bağlanamaz, liste elemanı olamaz veya değer gerektiren bir konumda kullanılamaz. Bu kullanımlar statik analizde reddedilir.

```ata
işlev ikiKat(n: sayı): sayı { n * 2 döndür }
işlev selam(): hiç { "Merhaba" yazdır }
sabit sayılar = [1, 2]
sayılar içindeki her sayı için { ikiKat(sayı) yazdır }
değişken i = 0
i < 2 iken { i += 1 }
eğer i == 2 ise { selam() } değilse { "Olmadı" yazdır }
```

`yazdır`, `döndür`, `iken`, liste döngüsü ve `eşleştir` postfix bildirim biçimleridir. `eğer` ve `iken` koşulları mantık tipinde olmalıdır. Döngü elemanı değişmezdir. `hiç` işlevde değer vermeyen `döndür` kullanılabilir. Lexical kapsamda iç bağ dış bağı gölgeleyebilir; aynı kapsamda tekrar tanımlama hatadır. Değer bağları başlangıç ifadesinden sonra görünür olur.

## İfadeler ve öncelik

Parser'daki en yüksek öncelikten en düşüğe sıralama:

| İşleç / biçim                              | Birleşim           |
| ------------------------------------------ | ------------------ |
| Çağrı `f(...)`, alan `.ad`, indeks `[...]` | Soldan             |
| Postfix `değil`                            | Soldan             |
| Tekli `-`                                  | Sağdan             |
| `* / %`                                    | Soldan             |
| `+ -`                                      | Soldan             |
| `< <= > >=`                                | Soldan             |
| `== !=`                                    | Soldan             |
| `ve`                                       | Soldan, kısa devre |
| `veya`                                     | Soldan, kısa devre |
| `= += -= *= /= %=`                         | Sağdan             |

`-x değil`, `-(x değil)` olarak ayrıştırılır; tip denetimi operand kurallarını ayrıca uygular. Parantez önceliği değiştirir. Atama hedefi yalnızca değişken adıdır. Aritmetik sayılar üzerinde; `+` ayrıca iki yazıyı birleştirir. Sıralama sayılar üzerinde, `değil`/`ve`/`veya` mantık üzerinde çalışır. Yapı/liste eşitliği yoktur. Çağrı ve liste elemanları virgülle ayrılır; son virgül desteklenmez.

## İsteğe bağlı daraltma

```ata
sabit değer: sayı? = sayıya("21")
eğer değer != yok ise { değer + 1 yazdır }
```

Doğrudan bağlarda (modül sabitinin nitelikli adı dahil) `x != yok` doğru yolda, `x == yok` yanlış yolda `T?` tipini `T` olarak daraltır. Operand sırası ters olabilir. `değil` yolları tersler; `ve` sağını doğru yol, `veya` sağını yanlış yol bilgisiyle denetler. `iken` gövdesi doğru yol bilgisiyle girer. Atama daraltmayı temel tipe sıfırlar; kullanıcı çağrıları global değişken optional bağların daraltmasını bozar. Yerleşik çağrılar bu bilgiyi korur. Döngüde yazılabilecek bağlar girişte sıfırlanır. Alan/indeks yolu, başka bir değer bağına kopyalama, erken dönüş sonrası ve blok sonrası yeni daraltma yoktur.

## Modüller

Modüller yerel `.ata` dosyalarıdır. Bir dosya başka bir dosyanın sabitlerini, işlevlerini, yapı ve seçenek tiplerini `kullan` bildirimiyle kullanabilir. Aşağıdaki `ana.ata` örnekleri birbirinden bağımsızdır.

### Ad alanı, seçici kullanım ve takma ad

`matematik.ata`:

```ata
işlev topla(a: sayı, b: sayı): sayı { a + b döndür }
işlev çıkar(a: sayı, b: sayı): sayı { a - b döndür }
işlev çarp(a: sayı, b: sayı): sayı { a * b döndür }
```

Ad alanıyla kullanım, son yol segmentinden bir ad üretir. `"matematik"` için varsayılan ad `matematik`tir. Aynı dizindeki `ana.ata`:

```ata
"matematik" kullan

matematik::topla(10, 20) yazdır
```

Çıktı `30` olur. Seçici kullanım yalnızca belirtilen adları bu dosyanın değer veya tip ad alanına bağlar:

```ata
"matematik" içinden topla, çıkar, çarp kullan

topla(10, 20) yazdır
çıkar(10, 3) yazdır
çarp(2, 4) yazdır
```

Çıktı sırasıyla `30`, `7`, `8` olur. Dosyayı `yardımcı/` dizinine koyduğunuzda takma adla kullanım:

```ata
"yardımcı/matematik" mat olarak kullan

mat::topla(10, 20) yazdır
```

Takma ad yalnızca erişim adını değiştirir; modülün veya içindeki tiplerin kimliğini değiştirmez.

Varsayılan ad geçerli, ayrılmamış bir tanımlayıcı olmalıdır; `sayı` da varsayılan modül adı olamaz. `foo-bar.ata` gibi bir dosyada `"foo-bar" kullan` geçersizdir. Bu dosya `topla` işlevini bildiriyorsa `"foo-bar" fb olarak kullan` veya `"foo-bar" içinden topla kullan` geçerlidir.

### Bildirimlerin yeri

`kullan` bildirimleri yalnızca üst seviyede, dosyanın başlangıcındaki kesintisiz kullanım bölümünde bulunur. Araya yorum veya boş satır girebilir; bildirimler normal satır sonu veya `;` ile ayrılır. İşlev, koşul ve blok içinde kullanım yapılamaz. Başka bir bildirimden sonra gelen kullanım da geçersizdir:

```ata
// Geçersiz: ATA6006
sabit x = 1
"matematik" kullan
```

`kullan`, `içinden` ve `olarak` ayrılmış sözcüklerdir. Liste döngüsündeki `içindeki`, seçici kullanımdaki `içinden` ile farklıdır.

### Dosya yolları

Fiziksel dosya `.ata` uzantılıdır; kullanım yolu uzantısız yazılır. `"matematik"`, `"yardımcı/matematik"`, `"./matematik"` ve `"../ortak/matematik"` geçerli yol biçimleridir. `"matematik.ata"` geçersizdir; yükleyici `.ata` uzantısını kendisi ekler.

Windows dahil bütün platformlarda kaynak içindeki ayırıcı `/` olur; backslash kullanılmaz. Yol, kullanan dosyanın gerçek bulunduğu dizine göre çözülür; terminalin çalışma dizinine göre çözülmez. Symlink/junction üzerinden açılan dosyada gerçek hedefin dizini esas alınır. `.` ve `..` desteklenir; proje kökü sınırı veya manifest yoktur.

Mutlak yollar (`/usr/...`, `C:/...`, UNC), URL/scheme ve uzak modüller desteklenmez. Boş yol/segment, kontrol karakteri, sondaki `/`, `.` veya `..` ve açık dosya uzantısı reddedilir. `foo` yalnızca `foo.ata` dosyasını ifade eder; dizin, `foo/index.ata` veya `foo/mod.ata` araması yapılmaz. PATH, ortam değişkenleri veya çalıştırılabilir dosyanın dizini üzerinden modül aranmaz.

Aynı kanonik (gerçek) dosya yoluna çözümlenen yollar aynı modülü ifade eder. Dosya adları için alternatif harf büyüklüğü veya NFC/NFD yazımları aranmaz; dosya sisteminin platform kuralları geçerlidir. Kaynak metnin NFC normalizasyonu diskteki dosya adlarını değiştirmez.

### Kapsam ve dışarı açık bildirimler

Her modülün ayrı üst seviye kapsamı vardır; başka modülün adları otomatik görünür olmaz. Yalnızca o dosyanın kendi üst seviye bildirimleri dışarı açıktır:

| Bildirim  | Kullanım                                   |
| --------- | ------------------------------------------ |
| `sabit`   | Değer erişimi                              |
| `işlev`   | Doğrudan veya nitelikli adla işlev çağrısı |
| `yapı`    | Tip başvurusu ve yapı oluşturma            |
| `seçenek` | Tip başvurusu ve seçenek üyesine erişim    |

`değişken` modülün içinde kalır. Yerleşik işlevler modül içinde kullanılabilir fakat o modülün dışarı açık adları sayılmaz. İçe alınan adlar otomatik yeniden dışarı açılmaz; yeniden dışa aktarım (re-export) yoktur.

Ad alanı normal bir değer değildir; yalnızca `modül::üye` erişiminde kullanılır. `"matematik" kullan` sonrasında `matematik yazdır` geçersizdir (`ATA4035`). İşlevler de birinci sınıf değer değildir; bir bağı veya listeyi işlev değeriyle doldurmak mümkün değildir.

### Yapı ve seçenek tipleri

`modeller.ata`:

```ata
yapı Kişi { ad: yazı }
seçenek Durum { aktif, pasif }
```

`ana.ata`:

```ata
"modeller" kullan
"modeller" içinden Kişi, Durum kullan

sabit a: modeller::Kişi = modeller::Kişi { ad: "İbrahim" }
sabit b: Kişi = Kişi { ad: "Ayşe" }
a.ad yazdır
b.ad yazdır

sabit durum: modeller::Durum = modeller::Durum::aktif
durum == Durum::aktif yazdır
durum eşleştir {
    modeller::Durum::aktif ise { "Aktif" yazdır }
    Durum::pasif ise { "Pasif" yazdır }
}
```

Çıktı `İbrahim`, `Ayşe`, `doğru`, `Aktif` olur. Nitelikli yapı tipleri ve oluşturucular, seçici tip kullanımı, nitelikli seçenek üyeleri ve `eşleştir` aynı tip kurallarıyla çalışır. Bu tipler işlev parametre/dönüş tiplerinde, listelerde ve isteğe bağlı tiplerde de kullanılabilir.

Tipler nominaldir: farklı modüllerde aynı isim ve aynı alan/üyelerle bildirilen yapı veya seçenekler farklı tiplerdir. Aynı bildirime ad alanı, takma ad ya da seçici kullanımla erişmek ise tip kimliğini değiştirmez. Örneğin farklı dosyalarda bildirilen `a::Kişi` ile `b::Kişi` birbirine atanamaz.

### Yinelenen bağlamalar ve döngüler

Aynı modüle aynı dosya içinde ikinci bir ad alanı bağlanamaz; farklı yol yazımı veya takma ad bunu değiştirmez. `"matematik" kullan` ile `"matematik" mat olarak kullan` birlikte geçersizdir. Ad alanı ve seçici kullanım birlikte geçerlidir: `"matematik" kullan` ile `"matematik" içinden topla kullan` aynı dosyada bulunabilir.

Aynı modülün aynı dışarı açık adını ikinci kez seçici olarak almak da geçersizdir (`ATA6007`); farklı adlar seçilebilir. Başka bir bağla normal isim çakışması ise değerlerde `ATA3002`, tiplerde `ATA3005` ile tanılanır.

Döngüsel bağımlılık desteklenmez. Bir modülün kendisini doğrudan veya `a → b → a` gibi bir zincirle kullanması `ATA6003` üretir.

### Çalıştırma ve modül içi durum

İçe alınan dosyalar yalnız bildirim deposu değildir; üst seviye ifadeleri de çalışır. Örneğin bir modülün üst seviyesindeki `"Modül yüklendi" yazdır`, modül başlatılırken çıktı üretir.

Önce giriş dosyasından erişilen bütün modüller statik olarak doğrulanır. Statik hata varsa hiçbir modül gövdesi çalıştırılmaz. Doğrulama başarılıysa, kullanım bildirimlerinin kaynak sırasıyla her bağımlılığın önce kendi bağımlılıkları tamamlanır, ardından kendisi ve en son giriş dosyası çalışır. Ortak bağımlılık, birden fazla modülden kullanılsa da tek `ata çalıştır` çağrısında yalnız bir kez çalışır.

İçe alınan işlev, tanımlandığı modülün kapsamını ve özel değişkenlerini kullanır. `sayaç.ata`:

```ata
değişken değer: sayı = 0

işlev artır(): sayı {
    değer += 1
    değer döndür
}
```

`ana.ata`:

```ata
"sayaç" kullan

sayaç::artır() yazdır
sayaç::artır() yazdır
```

Çıktı `1`, `2` olur. `sayaç::değer` dışarıdan erişilemez; işlev modülün iç durumunu yönetir. Aynı modüle ad alanı ve seçici kullanım üzerinden yapılan çağrılar bu durumu paylaşır. Ayrı çalıştırmalar durumu baştan kurar; modüller arasındaki çağrılar da tek çalıştırmanın 256 çağrı derinliği sınırını paylaşır.

### CLI ve tanılar

`ata denetle ana.ata`, erişilen bütün modülleri yükler, ayrıştırır, isim çözümler ve tip denetiminden geçirir; kullanıcı kodunu ve modül başlatma yan etkilerini yürütmez. `ata çalıştır ana.ata`, aynı doğrulamadan sonra modülleri çalıştırır.

Ayrıştırma, isim/tip ve çalışma zamanı hataları ilgili dosyanın kendi yol/satır/konumuyla gösterilir. İçe alınan işlev gövdesindeki hata işlevin dosyasında, çağrı argümanındaki hata çağıran dosyada raporlanır. Eksik veya okunamayan modül ise kullanım yolunda tanılanır. Çalışma zamanı hatası yürütmeyi durdurur; o ana kadarki çıktılar korunur. Kodlar için [tanı referansına](tanılar.md) bakın.

Ad alanı, seçici yapı tipi ve işlev çağrısı kullanan üç dosyalı örnek [örnekler/modüller](../örnekler/modüller/ana.ata) altında bulunur. Depo kökünden `ata çalıştır örnekler/modüller/ana.ata` çıktısı `İbrahim: 30` olur.

## Yerleşik işlevler

Yerleşikler global kapsamda hazırdır; aynı kapsamda yeniden tanımlanamazlar, iç kapsamda gölgelenebilirler. `T` aşağıda eleman tipini anlatır; kullanıcı generic sistemi değildir.

| İşlev                                           | Sonuç / davranış                                                            |
| ----------------------------------------------- | --------------------------------------------------------------------------- |
| `girdi()` / `girdi(yazı)`                       | `yazı`; istem aynen gösterilir, bir UTF-8 satır okunur                      |
| `uzunluk(yazı veya liste<T>)`                   | `sayı`; yazıda Unicode kod noktası sayısı                                   |
| `yazıya(değer)`                                 | `yazı`; `hiç` dışında ortak değer gösterimi                                 |
| `büyük_harf(yazı)`, `küçük_harf(yazı)`          | `yazı`; Türkçe harf dönüşümü                                                |
| `kırp(yazı)`                                    | `yazı`; baş/son boşlukları kaldırır                                         |
| `içerir(yazı, yazı)`                            | `mantık`; alt yazı arar                                                     |
| `başlar_mı(yazı, yazı)`, `biter_mi(yazı, yazı)` | `mantık`                                                                    |
| `sayıya(yazı)`                                  | `sayı?`; kırpılmış işaretli ondalık metin, geçersiz/sonsuz sonuçta `yok`    |
| `mantığa(yazı)`                                 | `mantık?`; kırpılmış Türkçe küçük harfle `doğru`/`yanlış`, aksi halde `yok` |
| `al(liste<T>, sayı)`                            | `T?`; geçersiz veya sınır dışı indekste `yok`                               |
| `ilk(liste<T>)`, `son(liste<T>)`                | `T?`; boş listede `yok`                                                     |

İsteğe bağlı elemanlar ikinci optional katman üretmez. Girdi okunamazsa çalışma zamanı tanısı oluşur. `/ 0`, `% 0`, sonlu olmayan aritmetik ve geçersiz doğrudan indeks çalışma zamanı hatasıdır.

## Henüz desteklenmeyenler

Paket yöneticisi, uzak modül, yeniden dışa aktarım, wildcard/seçici takma ad, dinamik veya koşullu kullanım, kullanıcı generics, payload'lı seçenekler, desen bağlama, alan/liste mutasyonu, birinci sınıf işlevler, async, exceptions ve eşleştirme ifadeleri yoktur.
