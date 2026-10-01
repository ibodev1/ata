param(
    [string]$Surum = '0.1.0',
    [string]$YerelDosya,
    [string]$KurulumDizini,
    [bool]$PathGuncelle = $true
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
function AtaMimariNormalize([string]$Deger) {
    switch ($Deger.Trim().ToUpperInvariant()) {
        { $_ -in @('AMD64', 'X64', '9') } { return 'x64' }
        { $_ -in @('ARM64', '12') } { return 'arm64' }
        { $_ -in @('X86', '0') } { return 'x86' }
        default { return 'bilinmeyen' }
    }
}
function AtaRuntimeMimarisi([type]$BilgiTipi) {
    try {
        if (-not $BilgiTipi) { $BilgiTipi = [Runtime.InteropServices.RuntimeInformation] }
        $ozellik = $BilgiTipi.GetProperty('OSArchitecture')
        if ($ozellik) { return $ozellik.GetValue($null, $null).ToString() }
    } catch {
        # Eski .NET sürümlerinde tip, özellik veya getter kullanılamayabilir.
    }
}
function AtaWindowsAsset([bool]$IsletimSistemi64Bit = [Environment]::Is64BitOperatingSystem) {
    # x64 işlemci üzerinde 32 bit Windows da çalışabilir; CPU bilgisi tek başına yeterli değildir.
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT -or -not $IsletimSistemi64Bit) { throw 'Bu platform henüz desteklenmiyor.' }
    $mimari = $null
    foreach ($komut in @('Get-CimInstance', 'Get-WmiObject')) {
        try {
            $islemciler = if ($komut -eq 'Get-CimInstance') {
                @(Get-CimInstance -ClassName Win32_Processor -ErrorAction Stop)
            } else {
                @(Get-WmiObject -Class Win32_Processor -ErrorAction Stop)
            }
            $degerler = @($islemciler | ForEach-Object { AtaMimariNormalize ([string]$_.Architecture) } | Select-Object -Unique)
        } catch { continue }
        if ($degerler.Count -gt 0) {
            $mimari = if ($degerler.Count -eq 1) { $degerler[0] } else { 'bilinmeyen' }
            break
        }
    }
    if (-not $mimari) {
        $runtime = AtaRuntimeMimarisi
        if ($runtime) { $mimari = AtaMimariNormalize $runtime }
    }
    if (-not $mimari) {
        # WOW64 sürecinin mimarisi yerine native mimari sinyaline öncelik ver.
        $deger = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
        $mimari = AtaMimariNormalize ([string]$deger)
    }
    if ($mimari -ne 'x64') { throw 'Bu platform henüz desteklenmiyor.' }
    return 'ata-windows-x64.exe'
}
function AtaSha256([string]$Yol) {
    $algoritma = [Security.Cryptography.SHA256]::Create()
    $akis = $null
    try {
        $akis = [IO.File]::OpenRead($Yol)
        return [BitConverter]::ToString($algoritma.ComputeHash($akis)).Replace('-', '').ToLowerInvariant()
    } finally {
        if ($akis) { $akis.Dispose() }
        $algoritma.Dispose()
    }
}
# Algılama fonksiyonları kurulum/ağ/PATH işlemi olmadan test edilebilir.
if ($MyInvocation.InvocationName -eq '.') { return }
$gecici = $null
$hazir = $null
try {
    $asset = AtaWindowsAsset
    if ($Surum -notmatch '^\d+\.\d+\.\d+(?:-(?:rc|dev)\.\d+)?$') { throw 'Geçersiz sürüm.' }
    $depo = if ($env:ATA_REPO) { $env:ATA_REPO } else { 'ibodev1/ata' }
    if ($depo -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$') { throw 'Geçersiz repository.' }
    if (-not $KurulumDizini) { $KurulumDizini = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Ata\bin' }
    $dizin = [IO.Path]::GetFullPath($KurulumDizini)
    if ($dizin.TrimEnd('\', '/') -eq [IO.Path]::GetPathRoot($dizin).TrimEnd('\', '/')) { throw 'Kök dizine kurulum yapılamaz.' }
    $ata = Join-Path $dizin 'ata.exe'
    $kayit = Join-Path $dizin '.ata-kurulum'
    # Her atanın bağlantı olmadığını doğrula; başka dizine yönlendirme yok.
    $aday = $dizin
    while ($aday) {
        if (Test-Path -LiteralPath $aday) {
            $bilgi = Get-Item -LiteralPath $aday -Force
            if (-not $bilgi.PSIsContainer -or ($bilgi.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Kurulum yolu gerçek bir dizin olmalı.' }
        }
        $aday = [IO.Path]::GetDirectoryName($aday)
    }
    foreach ($yol in @($ata, $kayit)) {
        if (Test-Path -LiteralPath $yol) {
            $bilgi = Get-Item -LiteralPath $yol -Force
            if ($bilgi.PSIsContainer -or ($bilgi.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Kurulum dosyası normal dosya olmalı.' }
        }
    }
    if (Test-Path -LiteralPath $ata) {
        if (-not (Test-Path -LiteralPath $kayit)) { throw 'Mevcut dosya Ata kurulumuna ait değil; üzerine yazılmadı.' }
        $eski = [IO.File]::ReadAllText($kayit).Trim()
        if ($eski -cnotmatch '^[a-f0-9]{64}$' -or (AtaSha256 $ata) -cne $eski) {
            throw 'Mevcut kurulum değişmiş; üzerine yazılmadı.'
        }
    }
    $gecici = Join-Path ([IO.Path]::GetTempPath()) ('ata-kur-' + [Guid]::NewGuid().ToString('N'))
    [void][IO.Directory]::CreateDirectory($gecici)
    $indirilen = Join-Path $gecici $asset
    $saglama = Join-Path $gecici 'SHA256SUMS.txt'
    if ($YerelDosya) {
        $yerel = [IO.Path]::GetFullPath($YerelDosya)
        Copy-Item -LiteralPath $yerel -Destination $indirilen
        Copy-Item -LiteralPath (Join-Path ([IO.Path]::GetDirectoryName($yerel)) 'SHA256SUMS.txt') -Destination $saglama
    } else {
        $url = "https://github.com/$depo/releases/download/v$Surum"
        Invoke-WebRequest -Uri "$url/$asset" -OutFile $indirilen -UseBasicParsing
        Invoke-WebRequest -Uri "$url/SHA256SUMS.txt" -OutFile $saglama -UseBasicParsing
    }
    if ((Get-Item -LiteralPath $indirilen).Length -eq 0) { throw 'İndirilen binary boş.' }
    $kayitlar = @{}
    foreach ($satir in [IO.File]::ReadAllLines($saglama)) {
        if ($satir -cnotmatch '^([a-fA-F0-9]{64})  ([A-Za-z0-9][A-Za-z0-9._-]*)$') { throw 'Geçersiz SHA256SUMS kaydı.' }
        $ad = $Matches[2]
        if ($kayitlar.ContainsKey($ad)) { throw 'Yinelenen checksum kaydı.' }
        $kayitlar[$ad] = $Matches[1].ToLowerInvariant()
    }
    if (-not $kayitlar.ContainsKey($asset)) { throw 'Binary checksum kaydı bulunamadı.' }
    $hash = AtaSha256 $indirilen
    if ($hash -cne $kayitlar[$asset]) { throw 'SHA-256 uyuşmazlığı; kurulum durduruldu.' }
    [void][IO.Directory]::CreateDirectory($dizin)
    $hazir = Join-Path $dizin ('ata-' + [Guid]::NewGuid().ToString('N') + '.tmp')
    Copy-Item -LiteralPath $indirilen -Destination $hazir
    if (Test-Path -LiteralPath $ata) { [IO.File]::Replace($hazir, $ata, [NullString]::Value) }
    else { [IO.File]::Move($hazir, $ata) }
    $hazir = $null
    [IO.File]::WriteAllText($kayit, $hash + "`n", [Text.UTF8Encoding]::new($false))
    if ($PathGuncelle) {
        foreach ($kapsam in @('User', 'Process')) {
            $mevcut = [Environment]::GetEnvironmentVariable('Path', $kapsam)
            $var = @($mevcut -split ';' | Where-Object { [string]::Equals($_.TrimEnd('\', '/'), $dizin.TrimEnd('\', '/'), [StringComparison]::OrdinalIgnoreCase) }).Count -gt 0
            if (-not $var) {
                $yeni = if ([string]::IsNullOrEmpty($mevcut)) { $dizin } else { $mevcut + ';' + $dizin }
                [Environment]::SetEnvironmentVariable('Path', $yeni, $kapsam)
            }
        }
    }
    Write-Output "Ata Dil $Surum kuruldu: $ata"
} catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
} finally {
    if ($hazir -and [IO.File]::Exists($hazir)) { [IO.File]::Delete($hazir) }
    if ($gecici -and [IO.Directory]::Exists($gecici)) {
        # OS temp altında bu işlem için oluşturulan dizin; yalnızca iki dosyayı sil.
        foreach ($ad in @('ata-windows-x64.exe', 'SHA256SUMS.txt')) { [IO.File]::Delete((Join-Path $gecici $ad)) }
        [IO.Directory]::Delete($gecici, $false)
    }
}
