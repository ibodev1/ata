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

**Sembol**: Bir değer, işlev, parametre veya liste döngüsü değişkeninin tanımı.

**Tip**: Bir ifadenin statik değer sınıfı; tip ifadesinden ayrı anlamsal model.

**Değer**: Yürütme sırasında üretilen Ata sayısı, yazısı, mantığı, listesi, `yok` veya `hiç` sonucu. `hiç` değer döndürmeyen işlev sonucu; `yok` kullanıcıya görünen eksik değerdir.

**Ortam**: Çalışma zamanı adlarını değer ve değiştirilebilirlik bilgisiyle tutan lexical bağlama alanı.

**Yazı parçası**: Bir yazı içindeki sabit metin veya değerlendirilecek Ata ifadesi.

## Mevcut aşama

Aşama 4 (`0.1.0-dev.4`): Ön yüz ve statik analizden sonra tree-walk yorumlayıcı program yürütür; `ata çalıştır` gerçek çıktı üretir. Açık çalışma zamanı değer modeli, lexical ortamlar, işlev çağrıları/özyineleme, döngüler ve kısa devreli mantık mevcut. Yazı içi ifade yerleştirme lexer modları → parser → AST üzerinden işler; çalışma zamanında yeniden ayrıştırılmaz. Dönüş ayrı akış sonucudur; çalışma zamanı tanıları `ATA5xxx` kullanır. Çağrı derinliği 256 ile sınırlıdır.

Lexical kapsamda tek ad alanı kullanılır; işlevler önceden toplanır, değerler tanımlama sırasına göre görünür. Tip çıkarımı, isteğe bağlı ve liste tipleri, değiştirilebilirlik ve temel dönüş akışı denetlenir. Anlamsal bilgiler AST dışında tablolarda tutulur. Standart kütüphane ve modül sistemi henüz yoktur.

AST dış kütüphane tokenlarını içermez. Yeni satır veya `;` bildirim sınırıdır; parantez/liste içindeki satır sonları sınır sayılmaz. Oxlint ve Oxfmt kalite kapısına dahildir; `.ata` dosyaları Oxfmt kapsamı dışındadır.
