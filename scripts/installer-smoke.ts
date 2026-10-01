import { strict as assert } from "node:assert";
import { writeFileSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, open, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { version } from "../package.json";
import { assetSeç, sha256 } from "./yayın.ts";
import { projeKökü } from "./derle.ts";

function çalıştır(args: string[], beklenenKod = 0): string {
  const sonuç = Bun.spawnSync(args);
  assert.equal(sonuç.exitCode, beklenenKod, sonuç.stderr.toString() || sonuç.stdout.toString());
  return sonuç.stdout.toString();
}

function alıntı(değer: string): string {
  return `'${değer.replaceAll("'", "''")}'`;
}

function windowsKomutu(pwsh: string, script: string, dizin: string, yerel?: string): string[] {
  // -File ile boolean argüman aktarımı Windows PowerShell 5'te desteklenmez.
  const komut = `& ${alıntı(script)} -KurulumDizini ${alıntı(dizin)} -PathGuncelle:$false${yerel ? ` -YerelDosya ${alıntı(yerel)}` : ""}; exit $LASTEXITCODE`;
  return [pwsh, "-NoProfile", "-Command", komut];
}

async function smoke(pwsh = "") {
  const windows = process.platform === "win32";
  const asset = assetSeç(process.platform, process.arch);
  const release = resolve(projeKökü, "dist/release");
  const geçici = await mkdtemp(join(tmpdir(), "ata-installer-"));
  const yol = join(geçici, "Ata kurulumu şğ");
  const ata = join(yol, windows ? "ata.exe" : "ata");
  const pathOku = [
    pwsh,
    "-NoProfile",
    "-Command",
    "[Environment]::GetEnvironmentVariable('Path', 'User')",
  ];
  const öncekiUserPath = windows ? çalıştır(pathOku) : undefined;
  const kaldır = windows
    ? windowsKomutu(pwsh, join(release, "kaldir.ps1"), yol)
    : ["sh", join(release, "kaldir.sh"), "--install-dir", yol];
  try {
    await mkdir(join(geçici, "asset"));
    const yerel = join(geçici, "asset", asset);
    const sağlama = join(geçici, "asset", "SHA256SUMS.txt");
    await copyFile(join(release, asset), yerel);
    const doğru = await Bun.file(join(release, "SHA256SUMS.txt")).text();
    await Bun.write(sağlama, doğru);
    const kurulum = windows
      ? windowsKomutu(pwsh, join(release, "kur.ps1"), yol, yerel)
      : ["sh", join(release, "kur.sh"), "--install-dir", yol, "--local-file", yerel];
    çalıştır(kurulum);
    assert.equal(çalıştır([ata, "sürüm"]), `Ata Dil ${version}\n`);
    assert.equal(
      çalıştır([ata, "çalıştır", resolve(projeKökü, "örnekler/merhaba.ata")]),
      "Merhaba İbrahim!\nAta Dil çalışıyor.\n",
    );
    await Bun.write(join(yol, "başka-dosya.txt"), "koru");
    çalıştır(kurulum); // Upgrade ve idempotent installer.
    const eskiHash = sha256(new Uint8Array(await Bun.file(ata).arrayBuffer()));
    const dosya = await open(yerel, "r+");
    try {
      await dosya.write(Buffer.from([0]), 0, 1, 0);
    } finally {
      await dosya.close();
    }
    çalıştır(kurulum, 1);
    assert.equal(sha256(new Uint8Array(await Bun.file(ata).arrayBuffer())), eskiHash);
    await copyFile(join(release, asset), yerel);
    for (const bozuk of [
      "bozuk\n",
      doğru
        .split("\n")
        .filter((satır) => !satır.endsWith(`  ${asset}`))
        .join("\n"),
      doğru + doğru,
    ]) {
      // Sıralı: aynı manifest üzerinde gerçek installer denemeleri.
      çalıştırManifest(bozuk, sağlama, kurulum);
    }
    await Bun.file(sağlama).delete();
    çalıştır(kurulum, 1);
    await Bun.write(sağlama, doğru);
    await Bun.write(yerel, "");
    çalıştır(kurulum, 1);
    await copyFile(join(release, asset), yerel);
    // Sahiplik kaydı mevcut olsa da kullanıcının değiştirdiği binary silinemez/değiştirilemez.
    await Bun.write(ata, "Kullanıcı tarafından değiştirilmiş Ata");
    çalıştır(kurulum, 1);
    çalıştır(kaldır, 1);
    assert.equal(await Bun.file(ata).text(), "Kullanıcı tarafından değiştirilmiş Ata");
    // Yalnızca smoke'un kendi temporary dosyasını eski doğrulanmış içeriğe döndür.
    await copyFile(join(release, asset), ata);
    çalıştır(kaldır);
    assert.equal(await Bun.file(ata).exists(), false);
    assert.equal(await Bun.file(join(yol, "başka-dosya.txt")).text(), "koru");
    çalıştır(kaldır); // İdempotent uninstall.
    await Bun.write(ata, "Ata olmayan dosya");
    çalıştır(kaldır, 1);
    assert.equal(await Bun.file(ata).text(), "Ata olmayan dosya");
    if (windows) assert.equal(çalıştır(pathOku), öncekiUserPath);
    console.log(
      `${windows ? `Windows (${pwsh})` : process.platform} installer smoke başarılı: install/upgrade/binary/uninstall; checksum hataları, değiştirilmiş/yabancı dosya korunumu; PATH değiştirilmedi.`,
    );
  } finally {
    // OS temp altında bu işlem için oluşturulan tek dizin.
    await rm(geçici, { recursive: true, force: true });
  }
}

function çalıştırManifest(metin: string, yol: string, komut: string[]) {
  // Sync yazma, aşağıdaki subprocess'in yalnızca bu manifesti okumasını sağlar.
  writeFileSync(yol, metin);
  çalıştır(komut, 1);
}

try {
  if (process.platform === "win32") {
    const kabuklar = [
      resolve(process.env.WINDIR!, "System32/WindowsPowerShell/v1.0/powershell.exe"),
      "pwsh",
    ];
    await kabuklar.reduce((önce, kabuk) => önce.then(() => smoke(kabuk)), Promise.resolve());
  } else await smoke();
} catch (hata) {
  console.error(hata instanceof Error ? hata.message : "Installer smoke başarısız.");
  process.exitCode = 1;
}
