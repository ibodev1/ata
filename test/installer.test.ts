import { expect, test } from "bun:test";
import { chmod, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const kök = fileURLToPath(new URL("../", import.meta.url));
const windows = process.platform === "win32";
const sh = windows
  ? resolve(
      dirname(dirname(Bun.which("git") ?? "C:/Program Files/Git/cmd/git.exe")),
      "bin/bash.exe",
    )
  : "sh";
const abc = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

function unixYolu(yol: string) {
  return windows
    ? yol
        .replaceAll("\\", "/")
        .replace(/^([A-Za-z]):/, (_, harf: string) => `/${harf.toLowerCase()}`)
    : yol;
}

function psYazısı(metin: string) {
  return `'${metin.replaceAll("'", "''")}'`;
}

test.each([{ ilk: true }, { ilk: false }])(
  "ağ installer URL’si doğru ve HTTP hatasında kurulum durur: %j",
  async ({ ilk }) => {
    const geçici = await mkdtemp(join(tmpdir(), "ata-http-test-"));
    try {
      const dizin = join(geçici, "bin");
      const kayıt = join(geçici, "urls.txt");
      let sonuç;
      if (windows) {
        const giriş = join(geçici, "http.ps1");
        await Bun.write(
          giriş,
          `function Invoke-WebRequest { param($Uri, $OutFile, [switch]$UseBasicParsing)\nAdd-Content -LiteralPath ${psYazısı(kayıt)} -Value $Uri\nif (${ilk ? "$true" : "$Uri.EndsWith('/SHA256SUMS.txt')"}) { throw 'HTTP 404' }\n[IO.File]::WriteAllText($OutFile, 'abc')\n}\n& ${psYazısı(join(kök, "scripts/kur.ps1"))} -KurulumDizini ${psYazısı(dizin)} -PathGuncelle:$false\nexit $LASTEXITCODE\n`,
        );
        sonuç = Bun.spawnSync(
          [Bun.which("pwsh") ?? "powershell.exe", "-NoProfile", "-File", giriş],
          { env: { ...process.env, ATA_REPO: "ibodev1/ata" } },
        );
      } else {
        await Bun.write(
          join(geçici, "uname"),
          '#!/bin/sh\ncase "$1" in -s) echo Linux;; -m) echo x86_64;; esac\n',
        );
        await Bun.write(
          join(geçici, "curl"),
          `#!/bin/sh\nwhile [ "$#" -gt 0 ]; do case "$1" in --output) out=$2; shift 2;; https:*) url=$1; shift;; *) shift;; esac; done\nprintf '%s\\n' "$url" >> "$ATA_TEST_LOG"\n${ilk ? "exit 22" : 'case "$url" in *SHA256SUMS.txt) exit 22;; esac\nprintf abc > "$out"'}\n`,
        );
        await Promise.all(["uname", "curl"].map((ad) => chmod(join(geçici, ad), 0o755)));
        sonuç = Bun.spawnSync([sh, join(kök, "scripts/kur.sh"), "--install-dir", dizin], {
          env: {
            ...process.env,
            PATH: `${geçici}:/usr/bin:/bin`,
            ATA_TEST_LOG: kayıt,
            ATA_REPO: "ibodev1/ata",
          },
        });
      }
      expect(sonuç.exitCode).not.toBe(0);
      expect(await Bun.file(join(dizin, windows ? "ata.exe" : "ata")).exists()).toBe(false);
      const asset = windows ? "ata-windows-x64.exe" : "ata-linux-x64";
      const urls = (await Bun.file(kayıt).text()).trim().split(/\r?\n/);
      expect(urls).toEqual([
        `https://github.com/ibodev1/ata/releases/download/v0.1.0-rc.1/${asset}`,
        ...(!ilk
          ? ["https://github.com/ibodev1/ata/releases/download/v0.1.0-rc.1/SHA256SUMS.txt"]
          : []),
      ]);
    } finally {
      await rm(geçici, { recursive: true, force: true });
    }
  },
);

test.each([
  { os: "Linux", arch: "x86_64", asset: "ata-linux-x64" },
  { os: "Darwin", arch: "x86_64", asset: "ata-darwin-x64" },
  { os: "Darwin", arch: "arm64", asset: "ata-darwin-arm64" },
  { os: "Darwin", arch: "aarch64", asset: "ata-darwin-arm64" },
  { os: "Linux", arch: "aarch64", asset: "" },
  { os: "Windows_NT", arch: "x86_64", asset: "" },
])("sh installer platform seçimi ve uninstall: %j", async ({ os, arch, asset }) => {
  const geçici = await mkdtemp(join(tmpdir(), "ata-sh-test-"));
  try {
    const uname = join(geçici, "uname");
    // OS bilgisi dış sınırdır; installer/checksum mantığı gerçekten çalışır.
    await Bun.write(
      uname,
      `#!/bin/sh\ncase "$1" in -s) echo '${os}';; -m) echo '${arch}';; *) exit 1;; esac\n`,
    );
    await chmod(uname, 0o755);
    const yerel = join(geçici, asset || "ata-linux-x64");
    await Bun.write(yerel, "abc");
    await Bun.write(join(geçici, "SHA256SUMS.txt"), `${abc}  ${asset || "ata-linux-x64"}\n`);
    const dizin = join(geçici, "bin");
    const env = { ...process.env, PATH: `${unixYolu(geçici)}:/usr/bin:/bin` };
    const sonuç = Bun.spawnSync(
      [
        sh,
        unixYolu(join(kök, "scripts/kur.sh")),
        "--local-file",
        unixYolu(yerel),
        "--install-dir",
        unixYolu(dizin),
      ],
      { env },
    );
    expect(sonuç.exitCode).toBe(asset ? 0 : 1);
    if (!asset) {
      expect(sonuç.stderr.toString()).toContain("desteklenmiyor");
      expect(await Bun.file(join(dizin, "ata")).exists()).toBe(false);
      return;
    }
    expect(await Bun.file(join(dizin, "ata")).text()).toBe("abc");
    await Bun.write(join(dizin, "koru"), "başka dosya");
    const kaldır = [sh, unixYolu(join(kök, "scripts/kaldir.sh")), "--install-dir", unixYolu(dizin)];
    expect(Bun.spawnSync(kaldır, { env }).exitCode).toBe(0);
    expect(await Bun.file(join(dizin, "ata")).exists()).toBe(false);
    expect(await Bun.file(join(dizin, "koru")).text()).toBe("başka dosya");
    expect(Bun.spawnSync(kaldır, { env }).exitCode).toBe(0);
    await Bun.write(join(dizin, "ata"), "Ata olmayan dosya");
    expect(Bun.spawnSync(kaldır, { env }).exitCode).toBe(1);
    expect(await Bun.file(join(dizin, "ata")).text()).toBe("Ata olmayan dosya");
  } finally {
    await rm(geçici, { recursive: true, force: true });
  }
});

test.each([
  { ad: "uyuşmazlık", metin: `${"0".repeat(64)}  ASSET\n` },
  { ad: "eksik asset", metin: `${abc}  baska\n` },
  { ad: "bozuk", metin: "bozuk  ASSET\n" },
  { ad: "yinelenen", metin: `${abc}  ASSET\n${abc}  ASSET\n` },
])("gerçek yerel installer checksum hatasında hedefe yazmaz: $ad", async ({ metin }) => {
  const geçici = await mkdtemp(join(tmpdir(), "ata-checksum-test-"));
  try {
    const asset = windows
      ? "ata-windows-x64.exe"
      : process.platform === "darwin"
        ? `ata-darwin-${process.arch}`
        : "ata-linux-x64";
    const yerel = join(geçici, asset);
    await Bun.write(yerel, "abc");
    await Bun.write(join(geçici, "SHA256SUMS.txt"), metin.replaceAll("ASSET", asset));
    const dizin = join(geçici, "bin");
    const komut = windows
      ? [
          Bun.which("pwsh") ?? "powershell.exe",
          "-NoProfile",
          "-Command",
          `& ${psYazısı(join(kök, "scripts/kur.ps1"))} -YerelDosya ${psYazısı(yerel)} -KurulumDizini ${psYazısı(dizin)} -PathGuncelle:$false; exit $LASTEXITCODE`,
        ]
      : [sh, join(kök, "scripts/kur.sh"), "--local-file", yerel, "--install-dir", dizin];
    const sonuç = Bun.spawnSync(komut);
    expect(sonuç.exitCode).toBe(1);
    expect(sonuç.stderr.toString()).toMatch(/SHA-256|SHA256SUMS|checksum/);
    expect(await Bun.file(join(dizin, windows ? "ata.exe" : "ata")).exists()).toBe(false);
  } finally {
    await rm(geçici, { recursive: true, force: true });
  }
});
