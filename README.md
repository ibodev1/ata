# Ata Dil

Ata, Türkçenin doğal düşünce sırasını sözdizimine yansıtmayı amaçlayan deneysel bir hobi programlama dilidir. Statik tip denetimi, Unicode adlar, işlevler, listeler, yapılar ve seçenekler içerir. Mevcut sürüm **0.1.0-dev.10**, Aşama 10'dur.

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
bun run check:release
```

`check`: tip denetimi, Oxlint, Oxfmt kontrolü ve testler. `check:release` bunlara standalone derleme ve binary smoke ekler. Normal testler binary derlemez. `bun run format` biçimlendirir; `.ata` kaynakları biçimlendirme kapsamı dışındadır.

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

GitHub Actions `push` ve `pull_request` için Ubuntu üzerinde Bun 1.4.2, `bun ci`, `check`, build ve binary smoke çalıştırır. Release veya yayınlama yapmaz.
