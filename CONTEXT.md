# Ata Dil

Ata, Türkçenin doğal düşünce sırasını sözdizimine yansıtmayı amaçlayan deneysel bir programlama dilidir.

## Terimler

**Kaynak**: Ata programının dosya yolu ile birlikte tutulan metni.

**Kaynak konumu**: Kaynak içindeki bir karakterin yeri.

**Kaynak aralığı**: Kaynağın başlangıç ve bitiş konumlarıyla sınırlanan bölümü.

**Sözcük**: Kaynaktaki tanımlayıcı, ayrılmış sözcük, değer, işleç veya noktalama birimi. Dış araçların arayüzlerinde ve sonuç listesinde `token` adı kullanılır.

**Tanı**: Kaynakla ilişkili bir hata veya uyarının açıklaması.

**Program**: Bir Ata kaynak dosyasının bildirimlerini içeren AST kökü.

**Bildirim**: Değer veya işlev tanımı, kontrol yapısı ya da ifade kullanımı gibi program adımı.

**İfade**: Literal, ad, işleç uygulaması, çağrı, liste veya atama biçimindeki dil öğesi.

**Tip ifadesi**: Temel, liste veya isteğe bağlı tipin sözdizimsel gösterimi; tip doğruluğu kararı değildir.

**Kapsam**: Kendi sembollerini ve üst kapsamını tutan lexical ad arama alanı.

**Sembol**: Bir değer, işlev, parametre veya liste döngüsü değişkeninin tanımı. Yerleşik işlev sembolü gerçek kaynak bildirimi/aralığı taşımaz.

**Tip**: Bir ifadenin statik değer sınıfı; tip ifadesinden ayrı anlamsal model.

**Temel tip**: Sembolün bildirilmiş veya başlangıç ifadesinden çıkarılmış değişmeyen tipi.

**Akış tipi / daraltma**: Doğrudan optional adın koşuldan elde edilen geçici tipi. AST ve temel tipten ayrı, sembol kimliğiyle anahtarlanan akış haritasında tutulur.

**Koşul bilgisi**: Koşulun tipi ile doğru ve yanlış yollarında güvenli olan daraltmalar. Alternatif yolların yalnızca ortak bilgisi korunur.

**Yapı**: Adı ve zorunlu tipli alanları olan kullanıcı veri tipi. Alanları oluşturulduktan sonra değiştirilemez; değiştirilebilir bir bağın tamamı yeniden atanabilir.

**Tip ad alanı**: Üst seviye yapı adlarının değer adlarından bağımsız çözüldüğü alan. Aynı ad iki ad alanında bulunabilir.

**Nominal yapı tipi**: Kimliği yapı adıyla belirlenen tip; alanları aynı olan farklı yapılar birbirine atanamaz. İleri ve recursive tip referansları desteklenir.

**Seçenek**: Üst seviyede tanımlanan, en az bir adlandırılmış ve payload taşımayan üyeden oluşan nominal tip. Yapılarla ortak tip ad alanını paylaşır.

**Seçenek değeri**: Seçenek adı ve üye adıyla belirlenen `Tip::üye` değeri. Aynı nominal tipin üyeleri eşitlikle karşılaştırılabilir.

**Eşleştirme**: Hedef seçenek değerine uygun tek kolun bloğunu çalıştıran bildirim. Her üye kapsanır; hedef bir kez değerlendirilir.

**Diğer kolu**: Eşleştirmede açık kolların kapsamadığı üyeleri karşılayan son kol. Birden fazla veya ulaşılamaz diğer kolu geçersizdir.

**Alan erişimi**: Yapı değerinin adlandırılmış alanını okuma. İsteğe bağlı yapı doğrudan alan erişimi sağlamaz.

**Liste indeksleme**: Listenin sıfırdan başlayan sayı indeksiyle eleman okuma. İndeks güvenli tam sayı ve liste sınırları içinde olmalıdır; alan veya indeks ataması mevcut değildir.

**Değer**: Yürütme sırasında üretilen Ata sayısı, yazısı, mantığı, listesi, yapısı, seçenek değeri veya `yok`. `hiç` kullanıcı değer tipi değil, yalnızca değer döndürmeyen işlevin dönüş tipidir; internal runtime sonucu korunur. `yok` kullanıcıya görünen eksik değerdir.

**Ortam**: Çalışma zamanı adlarını değer ve değiştirilebilirlik bilgisiyle tutan lexical bağlama alanı.

**Yazı parçası**: Bir yazı içindeki sabit metin veya değerlendirilecek Ata ifadesi.

**Yerleşik işlev**: Global kapsamda hazır bulunan, yalnızca çağrılabilen standart işlev. Tek katalog adı, argüman kurallarını, dönüş tipini ve çalışma zamanı uygulamasını birlikte tanımlar.

**Güvenli dönüşüm**: Yazıdan sayı veya mantık değerine dönüşüm; geçersiz metin ve sonlu olmayan sayı sonucu `yok` döndürür.

**Güvenli liste erişimi**: Eleman bulunmadığında `yok` döndüren `al`, `ilk` veya `son` çağrısı. Sonuç eleman tipinin tek katmanlı isteğe bağlı biçimidir.

**Girdi sağlayıcısı**: Yorumlayıcıya enjekte edilen senkron `(istem: string) => string | null` sınırı. CLI istemi aynen gösteren UTF-8 stdin satır okuyucusu kullanır; okunamayan girdi `ATA5007` üretir.

## Mevcut aşama

Aşama 15 tamamlandı; kaynak sürümü `0.1.0`, installer varsayılanları ve `docs/sürümler/0.1.0.md` final notu hazır. Yeni dil özelliği yok; feature freeze sürer. Yerel kalite/release kapıları ve PowerShell 5.1/7 installer regresyonları geçti. Final hazırlığı henüz push edilmedi; `v0.1.0` tag'i/Release oluşturulmadı.

Repository PRIVATE; `v0.1.0-rc.3` commit `826a11f` üzerinde private prerelease olarak yayımlandı. Bu tabanın uzak CI, manuel artifact ve Windows x64/Linux x64/macOS Intel x64/macOS arm64 native SHA-256, binary ve yerel installer doğrulamaları başarılı; manuel publish atlandı. Bunlar anonim internet kurulum veya Gatekeeper doğrulaması değildir. Yeni final commit'in uzak CI/manuel doğrulaması ve Public geçiş sonrası anonim RC.3 Windows/Linux kurulumları beklenir; sıra `docs/0.1.0-yayın-kontrol-listesi.md` dosyasındadır. Code signing/notarization yok; LICENSE kararı kullanıcıya bırakıldı.

Dört standalone binary, sekiz asseti kapsayan SHA-256 ve PowerShell/sh installer/uninstaller mevcut. Native Windows mimarisi CIM → WMI → korumalı RuntimeInformation → ortam bilgisi sırasıyla algılanır; x64 dışı reddedilir. Yerel smoke gerçek User PATH'i değiştirmez. `release:prepare` hazırlanmış Bun runtime’larıyla ağ kullanmadan derler; `check:release` kalite, asset bütünlüğü ve mevcut platform binary/installer smoke doğrular. `release.yml` manuel çalışmada artifact ve dört native doğrulama üretir, publish yapmaz. Publish build ve dört native job'ın tamamına bağlıdır; mevcut remote tag/paket sürümü eşleşirse `--verify-tag` ile RC/dev prerelease veya final release seçer, sürüme ait not dosyasını kullanır.

`hiç` yalnızca doğrudan çıplak işlev dönüş tipidir; değer/bileşik tipleri ve çağrı sonucunun bağlama/liste elemanı kullanımı statik reddedilir (`ATA4034`). Standalone çağrı, internal `hiç` ve `ATA5005` invariant guard’ları korunur.

Nominal seçenek türleri, `Tip::üye`, exhaustive postfix `eşleştir` bildirimi ve `diğer` kolu mevcut. Seçenekler yapı/isteğe bağlı/liste tipleriyle bütünleşir; bütün kolları dönen geçerli eşleştirme kesin dönüş sağlar. Payload ve desen bağlama henüz yoktur.

`sayıya(yazı) → sayı?`, `mantığa(yazı) → mantık?`, `al(liste<T>, sayı) → T?`, `ilk(liste<T>) → T?` ve `son(liste<T>) → T?` mevcut. Güvenli erişim/dönüşüm başarısızlığında `yok` döner; doğrudan `[]` indeksleme strict kalır. Optional elemanlar ikinci optional katman üretmez. Kullanıcı generics sistemi yoktur.

Optional akışa duyarlı daraltma mevcut. Doğrudan adlarda `x != yok` / `x == yok`, `eğer` / `değilse`, postfix `değil`, `ve` / `veya` kısa devresi ve `iken` gövdesi desteklenir. Atama daraltmayı temel tipe sıfırlar; kullanıcı çağrısı global mutable optional daraltmaları bozar. Döngüde yazılabilen bağlar girişte sıfırlanır. Alan yolu, alias, guard-clause ve blok sonrası daraltma henüz yoktur; AST/runtime değişmez.

Nominal yapı tipleri, yapı oluşturma, alan erişimi ve liste indeksleme mevcut. Alan/liste mutasyonu henüz yok. Temel yerleşik işlev sistemi, senkron `girdi`, Türkçe yazı yardımcıları ve `ata denetle` korunur. Yazdırma, yerleştirme ve `yazıya` yapı değerleri dahil ortak gösterimi kullanır.

Ön yüz ve statik analizden sonra senkron tree-walk yorumlayıcı program yürütür; `ata çalıştır` gerçek çıktı üretir. Lexical ortamlar, işlev çağrıları/özyineleme, döngüler, kısa devreli mantık ve yazı yerleştirme mevcut. Dönüş ayrı akış sonucudur; çalışma zamanı tanıları `ATA5xxx` kullanır. Çağrı derinliği 256 ile sınırlıdır.

Lexical kapsamda tek ad alanı kullanılır; işlevler önceden toplanır, değerler tanımlama sırasına göre görünür. Yerleşikler globalde yeniden tanımlanamaz; iç kapsamda gölgelenebilir. Tip çıkarımı, isteğe bağlı ve liste tipleri, değiştirilebilirlik ve temel dönüş akışı denetlenir. Anlamsal bilgiler AST dışında tablolarda tutulur. Modül sistemi henüz yoktur.

AST dış kütüphane tokenlarını içermez. Yeni satır veya `;` bildirim sınırıdır; parantez/liste içindeki satır sonları sınır sayılmaz. Oxlint ve Oxfmt kalite kapısına dahildir; `.ata` dosyaları Oxfmt kapsamı dışındadır.
