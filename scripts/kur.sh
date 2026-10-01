#!/bin/sh
set -eu
surum='0.1.0-rc.3'
depo=${ATA_REPO:-ibodev1/ata}
yerel=''
dizin="$HOME/.local/bin"
gecici=''
hazir=''
hata() { printf '%s\n' "$*" >&2; exit 1; }
sha256() {
    if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}'
    elif command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{print $1}'
    else hata 'SHA-256 aracı bulunamadı (sha256sum veya shasum).'; fi
}
while [ "$#" -gt 0 ]; do
    case "$1" in
        --version|--local-file|--install-dir)
            [ "$#" -ge 2 ] && [ -n "$2" ] || hata 'Eksik argüman.'
            case "$1" in --version) surum=$2;; --local-file) yerel=$2;; --install-dir) dizin=$2;; esac
            shift 2;;
        *) hata 'Kullanım: kur.sh [--version sürüm] [--local-file dosya] [--install-dir dizin]';;
    esac
done
printf '%s\n' "$surum" | LC_ALL=C grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+(-(rc|dev)\.[0-9]+)?$' || hata 'Geçersiz sürüm.'
printf '%s\n' "$depo" | LC_ALL=C grep -Eq '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$' || hata 'Geçersiz repository.'
case "$(uname -s):$(uname -m)" in
    Linux:x86_64) asset='ata-linux-x64';;
    Darwin:x86_64) asset='ata-darwin-x64';;
    Darwin:arm64|Darwin:aarch64) asset='ata-darwin-arm64';;
    *) hata 'Bu platform henüz desteklenmiyor.';;
esac
case "$dizin" in /*) ;; *) hata 'Kurulum dizini mutlak yol olmalı.';; esac
case "$dizin/" in */./*|*/../*) hata 'Kurulum yolunda . veya .. kullanılamaz.';; esac
while [ "${dizin%/}" != "$dizin" ]; do dizin=${dizin%/}; done
[ -n "$dizin" ] || hata 'Kök dizine kurulum yapılamaz.'
aday=$dizin
while [ "$aday" != / ]; do
    [ ! -L "$aday" ] || hata 'Kurulum yolunda sembolik bağlantı kullanılamaz.'
    if [ -e "$aday" ] && [ ! -d "$aday" ]; then hata 'Kurulum yolu dizin olmalı.'; fi
    aday=$(dirname "$aday")
done
ata="$dizin/ata"
kayit="$dizin/.ata-kurulum"
for yol in "$ata" "$kayit"; do
    [ ! -L "$yol" ] || hata 'Kurulum dosyası bağlantı olamaz.'
    if [ -e "$yol" ] && [ ! -f "$yol" ]; then hata 'Kurulum dosyası normal dosya olmalı.'; fi
done
if [ -f "$ata" ]; then
    [ -f "$kayit" ] || hata 'Mevcut dosya Ata kurulumuna ait değil; üzerine yazılmadı.'
    LC_ALL=C grep -Eq '^[a-f0-9]{64}$' "$kayit" || hata 'Geçersiz kurulum kaydı.'
    [ "$(sha256 "$ata")" = "$(cat "$kayit")" ] || hata 'Mevcut kurulum değişmiş; üzerine yazılmadı.'
fi
temizle() {
    if [ -n "$hazir" ]; then rm -f "$hazir"; fi
    if [ -n "$gecici" ]; then rm -f "$gecici/$asset" "$gecici/SHA256SUMS.txt"; rmdir "$gecici"; fi
}
trap temizle EXIT
trap 'exit 1' HUP INT TERM
gecici=$(mktemp -d "${TMPDIR:-/tmp}/ata-kur-XXXXXXXX")
if [ -n "$yerel" ]; then
    case "$yerel" in -*) hata 'Yerel dosya yolu seçenek olamaz.';; esac
    cp "$yerel" "$gecici/$asset"
    cp "$(dirname "$yerel")/SHA256SUMS.txt" "$gecici/SHA256SUMS.txt"
else
    command -v curl >/dev/null 2>&1 || hata 'curl bulunamadı.'
    url="https://github.com/$depo/releases/download/v$surum"
    curl --fail --location --proto '=https' --proto-redir '=https' --silent --show-error --output "$gecici/$asset" "$url/$asset"
    curl --fail --location --proto '=https' --proto-redir '=https' --silent --show-error --output "$gecici/SHA256SUMS.txt" "$url/SHA256SUMS.txt"
fi
[ -s "$gecici/$asset" ] || hata 'İndirilen binary boş.'
beklenen=$(LC_ALL=C awk -v asset="$asset" '
    { sub(/\r$/, ""); hash=substr($0,1,64); ad=substr($0,67);
      if (length(hash)!=64 || hash !~ /^[a-fA-F0-9]+$/ || substr($0,65,2)!="  " || ad !~ /^[A-Za-z0-9][A-Za-z0-9._-]*$/ || goruldu[ad]++) bozuk=1;
      if (ad==asset) { bulundu++; beklenen=tolower(hash) } }
    END { if (bozuk || bulundu!=1) exit 1; print beklenen }
' "$gecici/SHA256SUMS.txt") || hata 'Geçersiz, eksik veya yinelenen checksum kaydı.'
hash=$(sha256 "$gecici/$asset")
[ "$hash" = "$beklenen" ] || hata 'SHA-256 uyuşmazlığı; kurulum durduruldu.'
mkdir -p "$dizin"
hazir=$(mktemp "$dizin/.ata-XXXXXXXX")
cp "$gecici/$asset" "$hazir"
chmod 755 "$hazir"
mv -f "$hazir" "$ata"
hazir=''
printf '%s\n' "$hash" > "$kayit"
printf 'Ata Dil %s kuruldu: %s\n' "$surum" "$ata"
case ":${PATH:-}:" in *":$dizin:"*) ;; *) printf '%s dizinini PATH’inize ekleyin.\n' "$dizin";; esac
