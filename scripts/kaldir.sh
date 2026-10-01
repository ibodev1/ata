#!/bin/sh
set -eu
dizin="$HOME/.local/bin"
hata() { printf '%s\n' "$*" >&2; exit 1; }
if [ "$#" -ne 0 ]; then
    [ "$#" -eq 2 ] && [ "$1" = --install-dir ] && [ -n "$2" ] || hata 'Kullanım: kaldir.sh [--install-dir dizin]'
    dizin=$2
fi
case "$dizin" in /*) ;; *) hata 'Kaldırma dizini mutlak yol olmalı.';; esac
case "$dizin/" in */./*|*/../*) hata 'Kaldırma yolunda . veya .. kullanılamaz.';; esac
while [ "${dizin%/}" != "$dizin" ]; do dizin=${dizin%/}; done
[ -n "$dizin" ] || hata 'Kök dizinden kaldırma yapılamaz.'
aday=$dizin
while [ "$aday" != / ]; do
    [ ! -L "$aday" ] || hata 'Kaldırma yolunda bağlantı kullanılamaz.'
    if [ -e "$aday" ] && [ ! -d "$aday" ]; then hata 'Kaldırma yolu dizin olmalı.'; fi
    aday=$(dirname "$aday")
done
ata="$dizin/ata"
kayit="$dizin/.ata-kurulum"
for yol in "$ata" "$kayit"; do
    [ ! -L "$yol" ] || hata 'Kaldırılacak dosya bağlantı olamaz.'
    if [ -e "$yol" ] && [ ! -f "$yol" ]; then hata 'Kaldırılacak dosya normal dosya olmalı.'; fi
done
if [ ! -f "$ata" ]; then printf '%s\n' 'Ata Dil zaten kurulu değil.'; exit 0; fi
[ -f "$kayit" ] || hata 'Dosya Ata kurulumuna ait değil; silinmedi.'
LC_ALL=C grep -Eq '^[a-f0-9]{64}$' "$kayit" || hata 'Geçersiz kurulum kaydı.'
if command -v sha256sum >/dev/null 2>&1; then hash=$(sha256sum "$ata" | awk '{print $1}')
elif command -v shasum >/dev/null 2>&1; then hash=$(shasum -a 256 "$ata" | awk '{print $1}')
else hata 'SHA-256 aracı bulunamadı.'; fi
[ "$hash" = "$(cat "$kayit")" ] || hata 'Kurulum değişmiş; dosya silinmedi.'
rm -f "$ata" "$kayit"
printf '%s\n' 'Ata Dil kaldırıldı.'
