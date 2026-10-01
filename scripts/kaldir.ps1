param([string]$KurulumDizini, [bool]$PathGuncelle = $true)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
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
try {
    if (-not [Runtime.InteropServices.RuntimeInformation]::IsOSPlatform([Runtime.InteropServices.OSPlatform]::Windows)) { throw 'Bu platform henüz desteklenmiyor.' }
    if (-not $KurulumDizini) { $KurulumDizini = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Ata\bin' }
    $dizin = [IO.Path]::GetFullPath($KurulumDizini)
    if ($dizin.TrimEnd('\', '/') -eq [IO.Path]::GetPathRoot($dizin).TrimEnd('\', '/')) { throw 'Kök dizinden kaldırma yapılamaz.' }
    $aday = $dizin
    while ($aday) {
        if (Test-Path -LiteralPath $aday) {
            $bilgi = Get-Item -LiteralPath $aday -Force
            if (-not $bilgi.PSIsContainer -or ($bilgi.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Kaldırma yolu gerçek bir dizin olmalı.' }
        }
        $aday = [IO.Path]::GetDirectoryName($aday)
    }
    $ata = Join-Path $dizin 'ata.exe'
    $kayit = Join-Path $dizin '.ata-kurulum'
    foreach ($yol in @($ata, $kayit)) {
        if (Test-Path -LiteralPath $yol) {
            $bilgi = Get-Item -LiteralPath $yol -Force
            if ($bilgi.PSIsContainer -or ($bilgi.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Kaldırılacak dosya normal dosya olmalı.' }
        }
    }
    if (Test-Path -LiteralPath $ata) {
        if (-not (Test-Path -LiteralPath $kayit)) { throw 'Dosya Ata kurulumuna ait değil; silinmedi.' }
        $hash = [IO.File]::ReadAllText($kayit).Trim()
        if ($hash -cnotmatch '^[a-f0-9]{64}$' -or (AtaSha256 $ata) -cne $hash) { throw 'Kurulum değişmiş; dosya silinmedi.' }
        [IO.File]::Delete($ata)
        [IO.File]::Delete($kayit)
        Write-Output 'Ata Dil kaldırıldı.'
    } else { Write-Output 'Ata Dil zaten kurulu değil.' }
    if ($PathGuncelle) {
        foreach ($kapsam in @('User', 'Process')) {
            $mevcut = [Environment]::GetEnvironmentVariable('Path', $kapsam)
            if ($null -ne $mevcut) {
                $yeni = ($mevcut -split ';' | Where-Object { -not [string]::Equals($_.TrimEnd('\', '/'), $dizin.TrimEnd('\', '/'), [StringComparison]::OrdinalIgnoreCase) }) -join ';'
                if ($yeni -cne $mevcut) { [Environment]::SetEnvironmentVariable('Path', $yeni, $kapsam) }
            }
        }
    }
} catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }
