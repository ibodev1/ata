import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { ENTEGRASYON_ZAMAN_ASIMI_MS } from "./entegrasyon.ts";

const windows = process.platform === "win32";
const kabuklar = windows
  ? [resolve(process.env.WINDIR!, "System32/WindowsPowerShell/v1.0/powershell.exe"), "pwsh"]
  : ["powershell.exe", "pwsh"];
const installer = resolve(import.meta.dir, "../scripts/kur.ps1").replaceAll("'", "''");

test.skipIf(!windows).each(kabuklar)(
  "Windows mimari algılaması bağımsız olarak doğrulanır: %s",
  (kabuk) => {
    const kod = `
function Invoke-WebRequest { throw 'Bu test ağ kullanmamalı' }
. '${installer}'
Add-Type 'public class AtaLegacyRuntimeInformation {}'
Add-Type 'public class AtaRuntimeGetter { public static string OSArchitecture { get { return "X64"; } } }'
Add-Type 'public class AtaBrokenRuntimeGetter { public static string OSArchitecture { get { throw new System.InvalidOperationException(); } } }'
$runtimeOku = \${function:AtaRuntimeMimarisi}
try { [AtaLegacyRuntimeInformation]::OSArchitecture; throw 'Eksik API hatası üretilmedi' }
catch { if ($_.Exception.Message -notlike "*property 'OSArchitecture' cannot be found*") { throw } }
if ($null -ne (& $runtimeOku -BilgiTipi ([AtaLegacyRuntimeInformation]))) { throw 'Eksik API fallback kullanmalı' }
if ((AtaMimariNormalize (& $runtimeOku -BilgiTipi ([AtaRuntimeGetter]))) -ne 'x64') { throw 'RuntimeInformation x64 okumalı' }
if ($null -ne (& $runtimeOku -BilgiTipi ([AtaBrokenRuntimeGetter]))) { throw 'Getter hatası fallback kullanmalı' }
try { AtaWindowsAsset -IsletimSistemi64Bit:$false; throw '32 bit Windows reddedilmedi' }
catch { if ($_.Exception.Message -notlike '*desteklenmiyor*') { throw } }
$senaryolar = @(
    @{ cim = @(9); wmi = @(12); runtime = 'Arm64'; wow = 'ARM64'; arch = 'x86'; beklenen = 'ata-windows-x64.exe' },
    @{ cim = @(12); wmi = @(9); runtime = 'X64'; wow = ''; arch = 'AMD64'; beklenen = 'desteklenmiyor' },
    @{ cim = @(0); wmi = @(9); runtime = 'X64'; wow = ''; arch = 'AMD64'; beklenen = 'desteklenmiyor' },
    @{ cim = @(6); wmi = @(9); runtime = 'X64'; wow = ''; arch = 'AMD64'; beklenen = 'desteklenmiyor' },
    @{ cim = @(9,12); wmi = @(9); runtime = 'X64'; wow = ''; arch = 'AMD64'; beklenen = 'desteklenmiyor' },
    @{ cim = @(); wmi = @(9); runtime = 'Arm64'; wow = ''; arch = 'x86'; beklenen = 'ata-windows-x64.exe' },
    @{ cim = @(); wmi = @(12); runtime = 'X64'; wow = ''; arch = 'AMD64'; beklenen = 'desteklenmiyor' },
    @{ cim = @(); wmi = @(); runtime = 'X64'; wow = ''; arch = 'x86'; beklenen = 'ata-windows-x64.exe' },
    @{ cim = @(); wmi = @(); runtime = 'Arm64'; wow = ''; arch = 'AMD64'; beklenen = 'desteklenmiyor' },
    @{ cim = @(); wmi = @(); runtime = 'X86'; wow = ''; arch = 'AMD64'; beklenen = 'desteklenmiyor' },
    @{ cim = @(); wmi = @(); runtime = ''; wow = 'AMD64'; arch = 'x86'; beklenen = 'ata-windows-x64.exe' },
    @{ cim = @(); wmi = @(); runtime = ''; wow = ''; arch = 'AMD64'; beklenen = 'ata-windows-x64.exe' },
    @{ cim = @(); wmi = @(); runtime = ''; wow = 'ARM64'; arch = 'AMD64'; beklenen = 'desteklenmiyor' },
    @{ cim = @(); wmi = @(); runtime = ''; wow = ''; arch = 'x86'; beklenen = 'desteklenmiyor' },
    @{ cim = @(); wmi = @(); runtime = ''; wow = 'bilinmeyen'; arch = 'AMD64'; beklenen = 'desteklenmiyor' },
    @{ cim = @(); wmi = @(); runtime = ''; wow = ''; arch = ''; beklenen = 'desteklenmiyor' }
)
function Get-CimInstance { param($ClassName, $ErrorAction)
    if ($ClassName -ne 'Win32_Processor') { throw 'Yanlış CIM sınıfı' }
    if ($s.cim.Count -eq 0) { throw 'CIM yok' }
    foreach ($deger in $s.cim) { [pscustomobject]@{ Architecture = $deger } }
}
function Get-WmiObject { param($Class, $ErrorAction)
    if ($Class -ne 'Win32_Processor') { throw 'Yanlış WMI sınıfı' }
    foreach ($deger in $s.wmi) { [pscustomobject]@{ Architecture = $deger } }
}
function AtaRuntimeMimarisi {
    if ($s.runtime) { return $s.runtime }
    & $runtimeOku -BilgiTipi ([AtaLegacyRuntimeInformation])
}
foreach ($s in $senaryolar) {
    $env:PROCESSOR_ARCHITEW6432 = $s.wow
    $env:PROCESSOR_ARCHITECTURE = $s.arch
    try { $sonuc = AtaWindowsAsset } catch { $sonuc = $_.Exception.Message }
    if ($sonuc -notlike "*$($s.beklenen)*") { throw "Algılama hatası: $($s | ConvertTo-Json -Compress): $sonuc" }
}
foreach ($deger in @('AMD64', 'X64', '9')) { if ((AtaMimariNormalize $deger) -ne 'x64') { throw 'x64 normalization' } }
foreach ($deger in @('ARM64', '12')) { if ((AtaMimariNormalize $deger) -ne 'arm64') { throw 'arm64 normalization' } }
foreach ($deger in @('x86', '0')) { if ((AtaMimariNormalize $deger) -ne 'x86') { throw 'x86 normalization' } }
if ((AtaMimariNormalize 'bilinmeyen') -ne 'bilinmeyen') { throw 'Bilinmeyen mimari' }
Write-Output "Mimari regresyonu başarılı: $($PSVersionTable.PSVersion)"
`;
    const sonuç = Bun.spawnSync([kabuk, "-NoProfile", "-Command", kod]);
    expect(sonuç.exitCode, sonuç.stderr.toString() || sonuç.stdout.toString()).toBe(0);
    expect(sonuç.stdout.toString()).toContain("Mimari regresyonu başarılı");
  },
  ENTEGRASYON_ZAMAN_ASIMI_MS,
);
