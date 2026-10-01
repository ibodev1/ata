# Ata Dil

Ata, Türkçenin doğal düşünce sırasını sözdizimine yansıtmayı amaçlayan deneysel bir hobi programlama dilidir. Statik tip denetimi, Unicode adlar, işlevler, listeler, yapılar ve seçenekler içerir. Mevcut kaynak sürümü **0.1.0**; ilk kararlı geliştirme sürümünün yerel hazırlığı tamamlandı. Final tag ve GitHub Release henüz oluşturulmadı. Dil erken aşamadadır; sözdiziminin gelecekte değişmeyeceği garanti edilmez. Yeni dil özelliği eklenmedi; feature freeze devam ediyor.

```ata
sabit ad = "Dünya"
"Merhaba {ad}!" yazdır
```

## Geliştirme ve doğrulama

Bun **1.4.2**, TypeScript ve Chevrotain kullanılır. Kilitli bağımlılık kurulumu:

```sh
bun ci
bun run dev yardım
bun run dev çalıştır örnekler/merhaba.ata
bun test
bun run check
bun run release:runtime
bun run check:release
```

`check`: tip denetimi, Oxlint, Oxfmt kontrolü ve testler. `check:release` bunlara dört hedefin release hazırlığını, mevcut platformun binary ve yerel installer smoke doğrulamasını ekler. Normal testler binary derlemez. `bun run format` biçimlendirir; `.ata` kaynakları biçimlendirme kapsamı dışındadır.

## Kurulum ve yayın hazırlığı

**Repository şimdilik PRIVATE; yayımlanmış private RC `v0.1.0-rc.3`, kaynak ağacındaki `0.1.0` ise henüz yayımlanmamış final hazırlığıdır.** Repository public olmadan internet installer modu anonim erişimle kullanılamaz; private asset isteğinin 404 vermesi installer hatası değildir. Public geçiş sonrası önce mevcut RC.3 ile anonim Windows ve Linux/WSL kurulumu doğrulanacaktır. Installer'a token, PAT veya `gh` bağımlılığı eklenmez.

İleride public release'ten indirilen `kur.ps1` Windows PowerShell 5.1 veya PowerShell 7+'ta, `kur.sh` Unix/macOS'ta çalıştırılacaktır. Henüz hazır bir public internet kurulum komutu sunulmuyor.

Installer binary ve `SHA256SUMS.txt` indirir; SHA-256 eşleşmezse kurmaz. Binary’ler henüz kod imzalı değildir; checksum code signing’in yerine geçmez. SmartScreen, Gatekeeper, quarantine ve execution policy ayarları değiştirilmez.

Desteklenen platformlar Windows x64, Linux x64, macOS Intel x64 ve macOS arm64'tür. Windows kurulum dizini `%LOCALAPPDATA%\Ata\bin`dir. Yalnızca User PATH’e eksikse eklenir; System PATH’e dokunulmaz. Unix/macOS dizini `$HOME/.local/bin`dir; PATH eksikse bilgi verilir, shell config dosyaları düzenlenmez. Windows arm64 ve Linux arm64 açık hatayla reddedilir. Uninstaller yalnızca kayıtlı Ata binary’sini ve kendi checksum kaydını kaldırır, diğer dosyaları/dizinleri korur. Kurulu dosya değiştirilmişse üzerine yazma ve silme reddedilir.

```sh
bun run release:runtime
bun run release:prepare
bun run release:verify
bun run test:installer
```

`release:runtime`, eksik resmi Bun target runtime’larını bir kez indirerek `.bun-cache/` altında hazırlar. `release:prepare` **ağ kullanmaz**; önbellek eksikse çıktıları değiştirmeden durur. Sürüm ve asset isimleri sabittir; binary’lerin byte-for-byte tekrar üretilebilirliği garanti edilmez.

`dist/release/`: `ata-windows-x64.exe`, `ata-linux-x64`, `ata-darwin-x64`, `ata-darwin-arm64`, `SHA256SUMS.txt`, `kur.ps1`, `kur.sh`, `kaldir.ps1`, `kaldir.sh`. SHA-256 dosyası binary ve installer’ların tamamını alfabetik sırada kapsar. Release installer varsayılan sürümleri release hazırlanırken tek kaynak `package.json`dan güncellenir. `ATA_REPO=owner/repo` ağ kurulumu için repository override sağlar.

Yerel doğrulama örneği (geçici dizin kullanın):

```powershell
.\scripts\kur.ps1 -YerelDosya .\dist\release\ata-windows-x64.exe -KurulumDizini "$env:TEMP\ata-deneme" -PathGuncelle:$false
& "$env:TEMP\ata-deneme\ata.exe" sürüm
.\scripts\kaldir.ps1 -KurulumDizini "$env:TEMP\ata-deneme" -PathGuncelle:$false
```

Unix/macOS'ta fiziksel, sembolik bağlantı içermeyen bir geçici kurulum dizini seçip `sh scripts/kur.sh --local-file dist/release/ata-linux-x64 --install-dir <geçici-dizin>` ve `sh scripts/kaldir.sh --install-dir <geçici-dizin>` kullanın; macOS'ta doğru Darwin assetini seçin. macOS `/tmp` ve `/var` yollarının bağlantılı olması nedeniyle native smoke geçici dizinini fiziksel çalışma alanında oluşturur. Yerel dosya modunda da aynı dizindeki checksum zorunludur. Installer varsayılanı `0.1.0`; sürüm seçimi PowerShell’de `-Surum`, sh’de `--version` ile yapılabilir.

## Standalone derleme

```powershell
bun run build
.\dist\ata.exe sürüm
.\dist\ata.exe çalıştır örnekler\merhaba.ata
bun run test:binary
bun run build -- --target linux-x64
```

Mevcut platform çıktısı Windows'ta `dist/ata.exe`, Unix'te `dist/ata` olur. Açık hedefler `dist/<hedef>/` içine yazılır:

| Hedef        | Bun compile hedefi | Dosya   |
| ------------ | ------------------ | ------- |
| windows-x64  | bun-windows-x64    | ata.exe |
| linux-x64    | bun-linux-x64      | ata     |
| darwin-x64   | bun-darwin-x64     | ata     |
| darwin-arm64 | bun-darwin-arm64   | ata     |

Derleme gerçek `src/cli/cli.ts` girişini paketler; sürüm `package.json`dan derleme sırasında bundle'a girer. Kullanıcıda Bun, kaynak kod veya node_modules gerekmez. Hedef dosyası her derlemeden önce silinir, diğer hedeflerin çıktıları korunur. Çıktı dizinlerinde sembolik bağlantılar reddedilir; recursive temizlik yapılmaz. `dist/` Git tarafından izlenmez. Cross-compile ilk kullanımda Bun hedef runtime'ını indirebilir. [Bun standalone belgeleri](https://bun.com/docs/bundler/executables).

## CLI

```sh
ata yardım
ata sürüm
ata denetle program.ata
ata çalıştır program.ata
```

Unix'te yerel çıktı `./dist/ata` ile çalıştırılır. `denetle` kaynağı ayrıştırıp isim/tip denetimi yapar, girdi okumaz veya programı yürütmez. `çalıştır` denetimden geçen programı yorumlar. Başarı 0, Ata/CLI hatası Türkçe mesajla 1 döndürür. Dosyalar `.ata` uzantılı UTF-8 olmalıdır; boşluk içeren yollar kabukta tırnaklanmalıdır. Mutlak yollar ve çalışma dizinine göre göreli yollar kullanılabilir. `girdi()` senkron bir satır okur; `örnekler/girdi.ata` ile denenebilir.

Binary smoke binary'yi depo dışındaki geçici dizine kopyalar; PATH boşken kaynak/binary çıktılarını, sürümü, yardımı, Unicode/boşluklu yolları, girdi ve hata senaryolarını karşılaştırır.

## Belgeler ve CI

- [Dil referansı](docs/dil-referansı.md): sözdizimi, tipler, öncelik, daraltma ve yerleşikler.
- [Tanılar](docs/tanılar.md): kaynakta kullanılan tanı kodlarının tamamı.
- [Proje bağlamı](CONTEXT.md): terimler ve mevcut mimari.
- [Örnekler](örnekler/): çalıştırılabilir Ata programları.
- [RC.2 yayın notu](docs/sürümler/0.1.0-rc.2.md); [RC.1 yayın notu](docs/sürümler/0.1.0-rc.1.md).
- [0.1.0 yayın notu](docs/sürümler/0.1.0.md): henüz yayımlanmamış final sürümün kapsamı ve kısıtları.
- [RC.3 stabilizasyon notu](docs/sürümler/0.1.0-rc.3.md): tarihsel hazırlık notu; RC.3 artık private prerelease olarak yayımlandı.
- [0.1.0 yayın kontrol listesi](docs/0.1.0-yayın-kontrol-listesi.md): public geçiş ve final yayın öncesi insan doğrulaması.

GitHub Actions `push` ve `pull_request` için Ubuntu üzerinde Bun 1.4.2, `bun ci`, `check`, build ve binary smoke çalıştırır. Ayrı Windows job'ı PowerShell 5.1 ve 7+ mimari/ağ installer regresyonlarını doğrular. Release veya yayınlama yapmaz. Windows'ta `check:release` gerçek binary installer smoke'u iki PowerShell sürümünde de çalıştırır.

Ayrı `release.yml`, `workflow_dispatch` ile Actions artifact üretir ve dört platformda native SHA-256, binary ve yerel installer doğrulamasını çalıştırır; publish atlanır. `v*` tag push’unda tag/paket sürümü eşleşmek zorundadır; publish job’ı build ve dört native doğrulamanın tamamına bağlıdır. Mevcut remote tag için `gh release create --verify-tag` kullanılır. RC/dev sürümlerinde `--prerelease --latest=false`, final sürümde `--latest` seçilir; yayın notu `docs/sürümler/<sürüm>.md` dosyasıdır. Varsayılan izin `contents: read`, yalnızca publish job’ı `contents: write` alır; built-in token kullanılır. Resmi action’lar doğrulanmış commit SHA’larına pinlidir.

RC.3 tabanında [uzak CI](https://github.com/ibodev1/ata/actions/runs/36849998160), [manuel artifact ve dört native doğrulama](https://github.com/ibodev1/ata/actions/runs/36850162731) ve [tag release workflow](https://github.com/ibodev1/ata/actions/runs/36851150221) başarılıdır. Bu sonuçlar anonim public kurulum veya macOS Gatekeeper deneyiminin doğrulandığı anlamına gelmez. Yeni final hazırlığı henüz push edilmedi; final commit üzerinde uzak CI/manuel workflow ve public geçiş sonrası anonim RC.3 kurulum testleri bekleniyor. İzlenecek sıra yayın kontrol listesinde belirtilmiştir.
