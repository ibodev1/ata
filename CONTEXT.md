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

**Değer**: Yürütme sırasında üretilen Ata sayısı, yazısı, mantığı, listesi, `yok` veya `hiç` sonucu. `hiç` değer döndürmeyen işlev sonucu; `yok` kullanıcıya görünen eksik değerdir.

**Ortam**: Çalışma zamanı adlarını değer ve değiştirilebilirlik bilgisiyle tutan lexical bağlama alanı.

**Yazı parçası**: Bir yazı içindeki sabit metin veya değerlendirilecek Ata ifadesi.

**Yerleşik işlev**: Global kapsamda hazır bulunan, yalnızca çağrılabilen standart işlev. Tek katalog adı, argüman kurallarını, dönüş tipini ve çalışma zamanı uygulamasını birlikte tanımlar.

**Girdi sağlayıcısı**: Yorumlayıcıya enjekte edilen senkron `(istem: string) => string | null` sınırı. CLI istemi aynen gösteren UTF-8 stdin satır okuyucusu kullanır; okunamayan girdi `ATA5007` üretir.

## Mevcut aşama

Aşama 5 (`0.1.0-dev.5`) tamamlandı: Temel yerleşik işlev sistemi, `girdi`, `uzunluk`/`yazıya` ve Türkçe yazı yardımcıları mevcut. Harf dönüşümleri açık `tr-TR` locale kullanır; yazı uzunluğu Unicode code point sayısıdır. Yazdırma, yerleştirme ve `yazıya` ortak değer gösterimini kullanır. `ata denetle` ortak ön yüz hattını yürütür ve runtime'a girmeden denetim sonucunu bildirir.

Ön yüz ve statik analizden sonra senkron tree-walk yorumlayıcı program yürütür; `ata çalıştır` gerçek çıktı üretir. Lexical ortamlar, işlev çağrıları/özyineleme, döngüler, kısa devreli mantık ve yazı yerleştirme mevcut. Dönüş ayrı akış sonucudur; çalışma zamanı tanıları `ATA5xxx` kullanır. Çağrı derinliği 256 ile sınırlıdır.

Lexical kapsamda tek ad alanı kullanılır; işlevler önceden toplanır, değerler tanımlama sırasına göre görünür. Yerleşikler globalde yeniden tanımlanamaz; iç kapsamda gölgelenebilir. Tip çıkarımı, isteğe bağlı ve liste tipleri, değiştirilebilirlik ve temel dönüş akışı denetlenir. Anlamsal bilgiler AST dışında tablolarda tutulur. Modül sistemi henüz yoktur.

AST dış kütüphane tokenlarını içermez. Yeni satır veya `;` bildirim sınırıdır; parantez/liste içindeki satır sonları sınır sayılmaz. Oxlint ve Oxfmt kalite kapısına dahildir; `.ata` dosyaları Oxfmt kapsamı dışındadır.
