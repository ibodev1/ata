# Ata Dil referansı

Bu belge mevcut 0.1 geliştirme dilini tanımlar. Dil deneysel ve statik tip denetimli bir yorumlayıcıdır.

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

İşlevler üst seviyede tanımlanır; ileri çağrı ve özyineleme desteklenir. Parametreler değişmezdir. İşlevler değer olarak taşınamaz; yalnızca doğrudan adla çağrılır. Değer döndüren işlev bütün yollarında uygun tipte dönmelidir. Çağrı derinliği 256 ile sınırlıdır.

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

Doğrudan adlarda `x != yok` doğru yolda, `x == yok` yanlış yolda `T?` tipini `T` olarak daraltır. Operand sırası ters olabilir. `değil` yolları tersler; `ve` sağını doğru yol, `veya` sağını yanlış yol bilgisiyle denetler. `iken` gövdesi doğru yol bilgisiyle girer. Atama daraltmayı temel tipe sıfırlar; kullanıcı çağrıları global değişken optional bağların daraltmasını bozar. Yerleşik çağrılar bu bilgiyi korur. Döngüde yazılabilecek bağlar girişte sıfırlanır. Alan/indeks yolu, alias, erken dönüş sonrası ve blok sonrası yeni daraltma yoktur.

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

Modüller, kullanıcı generics, payload'lı seçenekler, desen bağlama, alan/liste mutasyonu, birinci sınıf işlevler, async, exceptions ve eşleştirme ifadeleri yoktur.
