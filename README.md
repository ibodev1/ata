# Ata Dil

Ata Dil, Türkçe sözdizimine sahip statik tip denetimli küçük bir programlama dili ve yorumlayıcıdır. İlk kararlı geliştirme sürümü **0.1.0** yayımlandı; proje hâlâ erken aşamadadır.

## Kurulum

### Windows

```powershell
irm https://github.com/ibodev1/ata/releases/latest/download/kur.ps1 | iex
ata sürüm
```

### Linux / macOS

```bash
curl -fsSL https://github.com/ibodev1/ata/releases/latest/download/kur.sh | sh
```

`~/.local/bin` PATH'inizde yoksa mevcut oturumda ekleyin; installer shell ayarlarını değiştirmez:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

Hızlı kurulum komutları GitHub Release üzerindeki installer scriptini doğrudan çalıştırır. İsterseniz scripti önce indirip inceleyerek çalıştırabilirsiniz. Installer binary'yi SHA-256 ile doğrular; checksum kod imzasının yerine geçmez.

### Kaldırma

Windows:

```powershell
irm https://github.com/ibodev1/ata/releases/latest/download/kaldir.ps1 | iex
```

Linux/macOS:

```bash
curl -fsSL https://github.com/ibodev1/ata/releases/latest/download/kaldir.sh | sh
```

## Hızlı başlangıç

`merhaba.ata` dosyası oluşturun:

```ata
sabit ad = "Dünya"
"Merhaba {ad}!" yazdır
```

```bash
ata çalıştır merhaba.ata
```

## Modüller

Yerel modüller 0.2 serisinde kullanılabilir; 0.2 henüz kararlı olarak yayımlanmadı. Yukarıdaki `latest` kurulumu yayımlanmış kararlı sürümü indirir.

Aynı dizinde iki dosya oluşturun. `matematik.ata`:

```ata
işlev topla(a: sayı, b: sayı): sayı {
    a + b döndür
}
```

`ana.ata`:

```ata
"matematik" kullan

matematik::topla(10, 20) yazdır
```

Geliştirme sürümüyle `ata çalıştır ana.ata` çıktısı `30` olur. Depodan denemek için `bun run src/cli/cli.ts çalıştır ana.ata` kullanabilirsiniz. Kullanım yoluna `.ata` eklenmez; yol, kullanan dosyaya göre çözülür.

Seçici kullanım `"matematik" içinden topla kullan`, takma ad ise `"matematik" mat olarak kullan` biçimindedir. Ayrıntılar [dil referansında](docs/dil-referansı.md#modüller); yapı tipi de kullanan çalıştırılabilir örnek [örnekler/modüller](örnekler/modüller/ana.ata) altında bulunur.

## Komutlar

```text
ata çalıştır <dosya>
ata denetle <dosya>
ata sürüm
ata yardım
```

`denetle`, giriş dosyasından erişilen bütün modülleri doğrular; kullanıcı kodunu çalıştırmaz. `çalıştır`, aynı doğrulamadan sonra bağımlılıkları ve giriş dosyasını çalıştırır.

## Desteklenen platformlar

Windows x64, Linux x64, macOS Intel x64 ve macOS Apple Silicon arm64. Windows ARM64 ve Linux ARM64 henüz desteklenmiyor. 0.1.0 binary'leri henüz kod imzalı değildir; macOS notarization yoktur.

## Geliştirme

Bun **1.4.2** kullanılır; standalone binary kullanıcıda Bun gerektirmez.

```sh
bun ci
bun run check
bun run build
```

`check` tip, lint, biçim ve test kontrollerini çalıştırır. `check:release` dört hedefin derlemesini, asset bütünlüğünü ve mevcut platform binary/yerel installer smoke testlerini ekler. Önce `bun run release:runtime` ile resmi Bun runtime önbelleğini hazırlayın; `bun run release:prepare` ağ kullanmadan dokuz asset üretir. `dist/` generated dosyalardır ve Git tarafından izlenmez.

## Dokümantasyon

- [Dil referansı](docs/dil-referansı.md)
- [Tanılar](docs/tanılar.md)
- [0.1.0 yayın notu](docs/sürümler/0.1.0.md)
- [0.2.0 yayın notu taslağı](docs/sürümler/0.2.0.md)

## Lisans

MIT — ayrıntılar için [LICENSE](LICENSE).
