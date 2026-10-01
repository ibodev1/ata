param(
    [Parameter(Mandatory = $true)][string]$Surum,
    [string]$ArtifactDizini = (Join-Path $PSScriptRoot '../dist/release')
)
# PowerShell 7 native artifact doğrulaması; Bun, build ve ağ çağrısı yok.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$mimari = [Runtime.InteropServices.RuntimeInformation]::OSArchitecture
Write-Output "Native runner: Windows $mimari; asset: ata-windows-x64.exe"
if (-not $IsWindows -or $mimari -ne [Runtime.InteropServices.Architecture]::X64) {
    throw 'Windows x64 runner gerekli.'
}
$release = [IO.Path]::GetFullPath($ArtifactDizini)
function NormalDosya([string]$Yol) {
    $dosya = Get-Item -LiteralPath $Yol
    if ($dosya -isnot [IO.FileInfo] -or $dosya.Length -eq 0 -or ($dosya.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw "Eksik/boş veya normal dosya değil: $Yol"
    }
}
$manifest = Join-Path $release 'SHA256SUMS.txt'
NormalDosya $manifest
foreach ($ad in @('ata-windows-x64.exe', 'kur.ps1', 'kaldir.ps1')) {
    $dosya = Join-Path $release $ad
    NormalDosya $dosya
    $satirlar = @([IO.File]::ReadAllLines($manifest) | Where-Object { ($_ -split '\s+')[-1] -ceq $ad })
    if ($satirlar.Count -ne 1) { throw "Eksik/yinelenen checksum: $ad" }
    $eslesme = [regex]::Match($satirlar[0], '^([0-9a-fA-F]{64})  ' + [regex]::Escape($ad) + '$')
    if (-not $eslesme.Success) { throw "Geçersiz checksum: $ad" }
    $gercek = (Get-FileHash -LiteralPath $dosya -Algorithm SHA256).Hash
    if ($gercek -ine $eslesme.Groups[1].Value) { throw "SHA-256 uyuşmazlığı: $ad" }
    Write-Output "Native SHA-256 doğrulandı: $ad"
}
$tempKoku = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$gecici = Join-Path $tempKoku ('ata-platform-' + [guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $gecici | Out-Null
$pwsh = (Get-Process -Id $PID).Path
$oncekiPath = [Environment]::GetEnvironmentVariable('Path', 'User')
function Calistir([string]$Binary, [string[]]$Argumanlar) {
    $bilgi = [Diagnostics.ProcessStartInfo]::new($Binary)
    $bilgi.UseShellExecute = $false
    $bilgi.RedirectStandardOutput = $true
    $bilgi.RedirectStandardError = $true
    $bilgi.StandardOutputEncoding = [Text.Encoding]::UTF8
    $bilgi.StandardErrorEncoding = [Text.Encoding]::UTF8
    $bilgi.WorkingDirectory = $gecici
    $bilgi.Environment['PATH'] = ''
    foreach ($arguman in $Argumanlar) { $bilgi.ArgumentList.Add($arguman) }
    $islem = [Diagnostics.Process]::Start($bilgi)
    try {
        $stdout = $islem.StandardOutput.ReadToEndAsync()
        $stderr = $islem.StandardError.ReadToEndAsync()
        $islem.WaitForExit()
        if ($islem.ExitCode -ne 0 -or $stderr.Result.Length -ne 0) { throw "Binary smoke başarısız ($($islem.ExitCode)): $($stderr.Result)" }
        return $stdout.Result
    } finally { $islem.Dispose() }
}
function Cikti([string]$Gercek, [string]$Beklenen) {
    if ($Gercek -cne ($Beklenen + "`n")) { throw "Beklenen stdout farklı: $Gercek" }
}
function DilSmoke([string]$Binary) {
    Cikti (Calistir $Binary @('sürüm')) "Ata Dil $Surum"
    if ((Calistir $Binary @('yardım')) -notlike '*ata <komut>*') { throw 'Yardım çıktısı eksik.' }
    Cikti (Calistir $Binary @('denetle', 'Türkçe örnek.ata')) 'Denetim başarılı.'
    Cikti (Calistir $Binary @('çalıştır', 'Türkçe örnek.ata')) 'İbrahim: yönetici'
    Cikti (Calistir $Binary @('denetle', 'Unicode deneme.ata')) 'Denetim başarılı.'
    Cikti (Calistir $Binary @('çalıştır', 'Unicode deneme.ata')) "İbrahim: yönetici`nŞğİı öçü ✓"
}
function Alinti([string]$Metin) { return "'" + $Metin.Replace("'", "''") + "'" }
try {
    $ornek = [IO.File]::ReadAllText((Join-Path $PSScriptRoot '../örnekler/eşleştirme.ata'))
    [IO.File]::WriteAllText((Join-Path $gecici 'Türkçe örnek.ata'), $ornek, [Text.UTF8Encoding]::new($false))
    [IO.File]::WriteAllText((Join-Path $gecici 'Unicode deneme.ata'), $ornek + "`n`"Şğİı öçü ✓`" yazdır`n", [Text.UTF8Encoding]::new($false))
    $standalone = Join-Path $gecici 'ata.exe'
    [IO.File]::Copy((Join-Path $release 'ata-windows-x64.exe'), $standalone)
    DilSmoke $standalone
    $kurulum = Join-Path $gecici 'Ata kurulumu şğ'
    # Mevcut smoke helper'ın -Command/alıntı mekanizması; yalnızca PowerShell 7.
    $komut = "& $(Alinti (Join-Path $release 'kur.ps1')) -Surum $(Alinti $Surum) -YerelDosya $(Alinti (Join-Path $release 'ata-windows-x64.exe')) -KurulumDizini $(Alinti $kurulum) -PathGuncelle:`$false; exit `$LASTEXITCODE"
    & $pwsh -NoProfile -Command $komut
    if ($LASTEXITCODE -ne 0) { throw 'Yerel install başarısız.' }
    $binary = Join-Path $kurulum 'ata.exe'
    DilSmoke $binary
    & $pwsh -NoProfile -Command "& $(Alinti (Join-Path $release 'kaldir.ps1')) -KurulumDizini $(Alinti $kurulum) -PathGuncelle:`$false; exit `$LASTEXITCODE"
    if ($LASTEXITCODE -ne 0 -or [IO.File]::Exists($binary)) { throw 'Yerel uninstall başarısız.' }
    if ([Environment]::GetEnvironmentVariable('Path', 'User') -cne $oncekiPath) { throw 'User PATH değişti.' }
    Write-Output 'Native Windows x64 smoke başarılı: SHA-256, sürüm/yardım/denetle/çalıştır, install/uninstall; User PATH değişmedi.'
} finally {
    # Silme yalnızca OS temp altında bu işlem için oluşturulan exact dizine uygulanır.
    $tamYol = [IO.Path]::GetFullPath($gecici)
    if (-not $tamYol.StartsWith($tempKoku, [StringComparison]::OrdinalIgnoreCase)) { throw 'Geçici dizin güvenli sınırın dışında.' }
    Remove-Item -LiteralPath $tamYol -Recurse -Force
}
