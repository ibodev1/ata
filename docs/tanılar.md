# Tanı kodları

Tanılar kaynak yolu, konum, kod ve Türkçe açıklama taşır. `ATA1xxx` sözcük çözümleme, `ATA2xxx` ayrıştırma, `ATA3xxx` isim/tip adı çözümleme, `ATA4xxx` tip/anlamsal denetim, `ATA5xxx` çalışma zamanı ailesidir. `ATA6xxx` modül kullanımı ailesidir; bildirim konumu, yerel yollar, yükleme, döngüler, export erişimi ve import bağlamaları doğrulanır. `denetle` modülleri dependency-first analiz eder; namespace/seçici değer ve tip bağlamalarında nominal kimliği korur; nitelikli tipler, yapı oluşturma ve seçenek eşleştirmesi statik olarak doğrulanır. Modül yürütme henüz desteklenmez; bu geliştirme sınırı kod taşımayan mesajla durdurulur. CLI kullanım, dosya uzantısı ve giriş dosyasının/UTF-8'in okuma hataları da kod taşımayan Türkçe mesajlardır. Başarı çıkışı 0, Ata/CLI hatası 1'dir.

Tablo kaynakta kullanılan bütün kodları kapsar. Bir kod aynı denetim kuralının farklı bağlamlarında kullanılabilir. Çalışma zamanı ortam/durum tanıları savunma denetimlerini de kapsar; normal statik denetimden geçmiş kaynakta her birinin oluşması beklenmez.

| Kod     | Kısa anlam                                             | Aşama      |
| ------- | ------------------------------------------------------ | ---------- |
| ATA1001 | Geçersiz karakter                                      | Sözcük     |
| ATA1002 | Kapanmamış yazı / yerleştirme                          | Sözcük     |
| ATA1003 | Geçersiz kaçış                                         | Sözcük     |
| ATA1004 | Kapanmamış blok yorumu                                 | Sözcük     |
| ATA2001 | Geçersiz sözdizimi                                     | Ayrıştırma |
| ATA2002 | Güvenli olmayan tam sayı / sonlu olmayan sayı literali | Ayrıştırma |
| ATA3001 | Tanımsız değer adı                                     | İsim       |
| ATA3002 | Aynı kapsamda yinelenen değer/işlev adı                | İsim       |
| ATA3003 | Yinelenen parametre                                    | İsim       |
| ATA3004 | Tanımsız tip adı                                       | İsim       |
| ATA3005 | Yinelenen yapı/seçenek tip adı                         | İsim       |
| ATA4001 | Bildirim, atama, liste veya alan tip uyuşmazlığı       | Tip        |
| ATA4002 | Mantık olmayan koşul                                   | Tip        |
| ATA4003 | Değişmez bağa atama                                    | Tip        |
| ATA4004 | Yanlış argüman sayısı                                  | Tip        |
| ATA4005 | Yanlış argüman tipi                                    | Tip        |
| ATA4006 | Dönüş değeri/tipi uyuşmazlığı                          | Tip        |
| ATA4007 | Bütün yollarda dönüş sağlanmıyor                       | Tip        |
| ATA4008 | Başlangıç değerinden tip çıkarılamıyor                 | Tip        |
| ATA4009 | İşlev olmayan değeri çağırma                           | Tip        |
| ATA4010 | İşlevi değer olarak kullanma                           | Tip        |
| ATA4011 | İşleç operand tipi uyuşmazlığı                         | Tip        |
| ATA4012 | Liste olmayan döngü hedefi                             | Tip        |
| ATA4013 | İşlev dışında dönüş                                    | Tip        |
| ATA4014 | İç içe isteğe bağlı tip                                | Tip        |
| ATA4015 | Hiç sonucunu yazdırma                                  | Tip        |
| ATA4016 | Hiç sonucunu yazıya yerleştirme                        | Tip        |
| ATA4017 | Eksik yapı alanı                                       | Tip        |
| ATA4018 | Yinelenen yapı alanı                                   | Tip        |
| ATA4019 | Bilinmeyen yapı alanı                                  | Tip        |
| ATA4020 | Yapı gerektiren erişim/oluşturma                       | Tip        |
| ATA4021 | Liste olmayan indeksleme hedefi                        | Tip        |
| ATA4022 | Sayı olmayan indeks                                    | Tip        |
| ATA4023 | Boş seçenek bildirimi                                  | Tip        |
| ATA4024 | Yinelenen seçenek üyesi                                | Tip        |
| ATA4025 | Seçenek olmayan tipte üye erişimi                      | Tip        |
| ATA4026 | Bilinmeyen seçenek üyesi                               | Tip        |
| ATA4027 | Seçenek olmayan eşleştirme hedefi                      | Tip        |
| ATA4028 | Farklı seçenek tipinden desen                          | Tip        |
| ATA4029 | Yinelenen eşleştirme deseni                            | Tip        |
| ATA4030 | Eksik eşleştirme kolları                               | Tip        |
| ATA4031 | Birden fazla diğer kolu                                | Tip        |
| ATA4032 | Son sırada olmayan diğer kolu                          | Tip        |
| ATA4033 | Ulaşılamaz diğer kolu                                  | Tip        |
| ATA4034 | Değer tipi/konumunda geçersiz hiç kullanımı            | Tip        |
| ATA4035 | Modül ad alanının normal değer olarak kullanılması     | Tip        |
| ATA5001 | Sıfıra bölme                                           | Çalışma    |
| ATA5002 | Sıfıra göre kalan                                      | Çalışma    |
| ATA5003 | Sonlu olmayan aritmetik sonuç                          | Çalışma    |
| ATA5004 | Ortam bağlama/arama/atama sorunu                       | Çalışma    |
| ATA5005 | Beklenmeyen değer veya yürütme durumu                  | Çalışma    |
| ATA5006 | Çağrı derinliği sınırı                                 | Çalışma    |
| ATA5007 | Girdi okunamadı                                        | Çalışma    |
| ATA5008 | Güvenli tam sayı olmayan doğrudan indeks               | Çalışma    |
| ATA5009 | Sınır dışı doğrudan indeks                             | Çalışma    |
| ATA6001 | Modül dosyası bulunamadı                               | Modül      |
| ATA6002 | Geçersiz modül yolu / normal dosya olmayan hedef       | Modül      |
| ATA6003 | Döngüsel modül bağımlılığı (kendini kullanma dahil)    | Modül      |
| ATA6004 | Modülde erişilebilir export adı bulunamadı             | Modül      |
| ATA6005 | Geçersiz varsayılan modül ad alanı                     | Modül      |
| ATA6006 | Geçersiz konumda kullan bildirimi                      | Ön yüz     |
| ATA6007 | Aynı canonical modül/export için yinelenen bağlama     | Modül      |
| ATA6008 | Modül okuma / UTF-8 / kanonikleştirme hatası           | Modül      |

`denetle` yorumlayıcıyı çalıştırmaz. Örneğin `1 / 0 yazdır` denetimden geçer; `çalıştır` ATA5001 üretir. Çalışma zamanı hatası öncesindeki program çıktıları korunur.
