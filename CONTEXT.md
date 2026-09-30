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

## Mevcut aşama

Aşama 2 (`0.1.0-dev.2`): Lexer, Chevrotain parser ve CST → AST üretimi mevcut. AST dış kütüphane tokenlarını içermez. Yeni satır veya `;` bildirim sınırıdır; parantez/liste içindeki satır sonları sınır sayılmaz. Oxlint ve Oxfmt kalite kapısına dahildir; `.ata` dosyaları Oxfmt kapsamı dışındadır. İsim çözümleme, tip denetimi ve yorumlayıcı henüz yoktur.
