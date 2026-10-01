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

## Komutlar

```text
ata çalıştır <dosya>
ata denetle <dosya>
ata sürüm
ata yardım
```

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

## Lisans

MIT — ayrıntılar için [LICENSE](LICENSE).
