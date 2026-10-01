#!/bin/sh
# İndirilen release artifactlerini native runner'da doğrular; build veya ağ çağrısı yok.
set -eu
[ "$#" -ge 2 ] && [ "$#" -le 3 ] || { echo 'Kullanım: smoke.sh <asset> <sürüm> [artifact-dizini]' >&2; exit 1; }
asset=$1
surum=$2
kok=$(CDPATH= cd "$(dirname "$0")/.." && pwd -P)
release=${3:-$kok/dist/release}
release=$(CDPATH= cd "$release" && pwd)
os=$(uname -s)
mimari=$(uname -m)
printf 'Native runner: %s %s; asset: %s\n' "$os" "$mimari" "$asset"
case "$os:$mimari:$asset" in
    Linux:x86_64:ata-linux-x64|Darwin:x86_64:ata-darwin-x64|Darwin:arm64:ata-darwin-arm64|Darwin:aarch64:ata-darwin-arm64) ;;
    *) echo 'Runner mimarisi ile asset eşleşmiyor.' >&2; exit 1 ;;
esac
normal_dosya() {
    [ -f "$1" ] && [ ! -L "$1" ] && [ -s "$1" ] || { echo "Eksik/boş veya normal dosya değil: $1" >&2; exit 1; }
}
normal_dosya "$release/SHA256SUMS.txt"
dogrula() {
    normal_dosya "$release/$1"
    beklenen=$(awk -v asset="$1" '
        $NF == asset {
            adet++
            if (NF != 2 || length($1) != 64 || $1 ~ /[^0-9a-fA-F]/ || $0 != $1 "  " asset) bozuk=1
            hash=tolower($1)
        }
        END { if (adet != 1 || bozuk) exit 1; print hash }
    ' "$release/SHA256SUMS.txt") || { echo "Geçersiz/eksik/yinelenen checksum: $1" >&2; exit 1; }
    case "$os" in
        Linux) gercek=$(sha256sum "$release/$1" | awk '{print $1}') ;;
        Darwin) gercek=$(shasum -a 256 "$release/$1" | awk '{print $1}') ;;
    esac
    [ "$gercek" = "$beklenen" ] || { echo "SHA-256 uyuşmazlığı: $1" >&2; exit 1; }
    printf 'Native SHA-256 doğrulandı: %s\n' "$1"
}
# Installer da çalıştırılmadan önce bağımsız native kontrolünden geçer.
for ad in "$asset" kur.sh kaldir.sh; do dogrula "$ad"; done
chmod 755 "$release/$asset"
# HOME ve install root sistem TMPDIR'ındaki /var gibi symlink ancestor'ları taşımaz.
gecici=$(mktemp -d "$kok/.ata-release-smoke.XXXXXX")
temizle() {
    case "$gecici" in "$kok"/.ata-release-smoke.??????) ;; *) echo 'Güvensiz smoke cleanup yolu.' >&2; return 1;; esac
    [ "$(dirname "$gecici")" = "$kok" ] && [ "$gecici" != "${HOME:-}" ] && [ -d "$gecici" ] && [ ! -L "$gecici" ] || return 1
    rm -rf -- "$gecici"
}
trap temizle EXIT
trap 'exit 1' HUP INT TERM
cp "$kok/örnekler/eşleştirme.ata" "$gecici/Türkçe örnek.ata"
cp "$gecici/Türkçe örnek.ata" "$gecici/Unicode deneme.ata"
printf '\n"Şğİı öçü ✓" yazdır\n' >> "$gecici/Unicode deneme.ata"
cd "$gecici"
calistir() {
    # Mutlak binary yolu + boş child PATH + yalıtılmış temporary cwd.
    PATH='' "$binary" "$@" > "$gecici/stdout" 2> "$gecici/stderr"
    [ ! -s "$gecici/stderr" ] || { cat "$gecici/stderr" >&2; exit 1; }
}
cikti() {
    printf '%s\n' "$1" > "$gecici/beklenen"
    cmp -s "$gecici/beklenen" "$gecici/stdout" || { echo 'Beklenen stdout farklı.' >&2; cat "$gecici/stdout" >&2; exit 1; }
}
dil_smoke() {
    calistir sürüm; cikti "Ata Dil $surum"
    calistir yardım; grep -q 'ata <komut>' "$gecici/stdout"
    calistir denetle 'Türkçe örnek.ata'; cikti 'Denetim başarılı.'
    calistir çalıştır 'Türkçe örnek.ata'; cikti 'İbrahim: yönetici'
    calistir denetle 'Unicode deneme.ata'; cikti 'Denetim başarılı.'
    calistir çalıştır 'Unicode deneme.ata'; cikti 'İbrahim: yönetici
Şğİı öçü ✓'
}
cp "$release/$asset" "$gecici/ata"
binary=$gecici/ata
dil_smoke
printf 'Native %s standalone smoke başarılı: sürüm/yardım/denetle/çalıştır.\n' "$asset"
mkdir "$gecici/ev"
printf 'Installer smoke HOME=%s; kurulum dizini=%s\n' "$gecici/ev" "$gecici/Ata kurulumu"
HOME=$gecici/ev sh "$release/kur.sh" --version "$surum" --local-file "$release/$asset" --install-dir "$gecici/Ata kurulumu"
binary="$gecici/Ata kurulumu/ata"
dil_smoke
HOME=$gecici/ev sh "$release/kaldir.sh" --install-dir "$gecici/Ata kurulumu"
[ ! -e "$binary" ] || { echo 'Uninstall binary dosyasını kaldırmadı.' >&2; exit 1; }
[ ! -e "$gecici/ev/.profile" ] && [ ! -e "$gecici/ev/.bashrc" ] && [ ! -e "$gecici/ev/.zshrc" ]
printf 'Native %s smoke başarılı: SHA-256, sürüm/yardım/denetle/çalıştır, install/uninstall.\n' "$asset"
