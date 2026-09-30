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

**Alan erişimi**: Yapı değerinin adlandırılmış alanını okuma. İsteğe bağlı yapı doğrudan alan erişimi sağlamaz.

**Liste indeksleme**: Listenin sıfırdan başlayan sayı indeksiyle eleman okuma. İndeks güvenli tam sayı ve liste sınırları içinde olmalıdır; alan veya indeks ataması mevcut değildir.

**Değer**: Yürütme sırasında üretilen Ata sayısı, yazısı, mantığı, listesi, `yok` veya `hiç` sonucu. `hiç` değer döndürmeyen işlev sonucu; `yok` kullanıcıya görünen eksik değerdir.

**Ortam**: Çalışma zamanı adlarını değer ve değiştirilebilirlik bilgisiyle tutan lexical bağlama alanı.

**Yazı parçası**: Bir yazı içindeki sabit metin veya değerlendirilecek Ata ifadesi.

**Yerleşik işlev**: Global kapsamda hazır bulunan, yalnızca çağrılabilen standart işlev. Tek katalog adı, argüman kurallarını, dönüş tipini ve çalışma zamanı uygulamasını birlikte tanımlar.

**Girdi sağlayıcısı**: Yorumlayıcıya enjekte edilen senkron `(istem: string) => string | null` sınırı. CLI istemi aynen gösteren UTF-8 stdin satır okuyucusu kullanır; okunamayan girdi `ATA5007` üretir.

## Mevcut aşama

Aşama 7 (`0.1.0-dev.7`) tamamlandı: Optional akışa duyarlı daraltma mevcut. Doğrudan adlarda `x != yok` / `x == yok`, `eğer` / `değilse`, postfix `değil`, `ve` / `veya` kısa devresi ve `iken` gövdesi desteklenir. Atama daraltmayı temel tipe sıfırlar; kullanıcı çağrısı global mutable optional daraltmaları bozar. Döngüde yazılabilen bağlar girişte sıfırlanır. Alan yolu, alias, guard-clause ve blok sonrası daraltma henüz yoktur; AST/runtime değişmez.

Nominal yapı tipleri, yapı oluşturma, alan erişimi ve liste indeksleme mevcut. Alan/liste mutasyonu henüz yok. Temel yerleşik işlev sistemi, senkron `girdi`, Türkçe yazı yardımcıları ve `ata denetle` korunur. Yazdırma, yerleştirme ve `yazıya` yapı değerleri dahil ortak gösterimi kullanır.

Ön yüz ve statik analizden sonra senkron tree-walk yorumlayıcı program yürütür; `ata çalıştır` gerçek çıktı üretir. Lexical ortamlar, işlev çağrıları/özyineleme, döngüler, kısa devreli mantık ve yazı yerleştirme mevcut. Dönüş ayrı akış sonucudur; çalışma zamanı tanıları `ATA5xxx` kullanır. Çağrı derinliği 256 ile sınırlıdır.

Lexical kapsamda tek ad alanı kullanılır; işlevler önceden toplanır, değerler tanımlama sırasına göre görünür. Yerleşikler globalde yeniden tanımlanamaz; iç kapsamda gölgelenebilir. Tip çıkarımı, isteğe bağlı ve liste tipleri, değiştirilebilirlik ve temel dönüş akışı denetlenir. Anlamsal bilgiler AST dışında tablolarda tutulur. Modül sistemi henüz yoktur.

AST dış kütüphane tokenlarını içermez. Yeni satır veya `;` bildirim sınırıdır; parantez/liste içindeki satır sonları sınır sayılmaz. Oxlint ve Oxfmt kalite kapısına dahildir; `.ata` dosyaları Oxfmt kapsamı dışındadır.
