import { expect, test } from "bun:test";
import { chmod, copyFile, mkdir, mkdtemp, readdir, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ENTEGRASYON_ZAMAN_ASIMI_MS } from "./entegrasyon.ts";

const kök = fileURLToPath(new URL("../", import.meta.url));
const windows = process.platform === "win32";
const sh = windows
  ? resolve(
      dirname(dirname(Bun.which("git") ?? "C:/Program Files/Git/cmd/git.exe")),
      "bin/bash.exe",
    )
  : "sh";
const abc = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

test(
  "sh installer boşluklu HOME, chmod, temp cleanup ve değiştirilmiş dosya korunumunu sağlar",
  async () => {
    const geçici = await mkdtemp(join(tmpdir(), "ata-sh-home-"));
    try {
      const ev = join(geçici, "ev şğ & ; ' dizini");
      const temp = join(geçici, "temp");
      await Promise.all([mkdir(ev), mkdir(temp)]);
      await Bun.write(join(ev, ".profile"), "değiştirme");
      await Bun.write(
        join(geçici, "uname"),
        '#!/bin/sh\ncase "$1" in -s) echo Linux;; -m) echo x86_64;; esac\n',
      );
      await chmod(join(geçici, "uname"), 0o755);
      await Bun.write(
        join(geçici, "chmod"),
        '#!/bin/sh\nprintf "%s\\n" "$1" >> "$ATA_CHMOD_LOG"\nexec /usr/bin/chmod "$@"\n',
      );
      await chmod(join(geçici, "chmod"), 0o755);
      const yerel = join(geçici, "ata-linux-x64");
      const manifest = join(geçici, "SHA256SUMS.txt");
      await Bun.write(yerel, "abc");
      await Bun.write(manifest, `${abc}  ata-linux-x64\n`);
      const chmodKaydı = join(geçici, "chmod.log");
      const env = {
        ...process.env,
        HOME: unixYolu(ev),
        TMPDIR: unixYolu(temp),
        ATA_CHMOD_LOG: unixYolu(chmodKaydı),
        PATH: `${unixYolu(geçici)}:/usr/bin:/bin`,
      };
      const kur = [sh, unixYolu(join(kök, "scripts/kur.sh")), "--local-file", unixYolu(yerel)];
      const kaldır = [sh, unixYolu(join(kök, "scripts/kaldir.sh"))];
      const ata = join(ev, ".local/bin/ata");
      const sonuç = Bun.spawnSync(kur, { env });
      expect(sonuç.exitCode, sonuç.stderr.toString()).toBe(0);
      expect(sonuç.stdout.toString()).toContain("PATH");
      expect((await Bun.file(chmodKaydı).text()).trim()).toBe("755");
      // NTFS/MSYS test -x, POSIX mode bitlerini temsil etmez.
      if (!windows)
        expect(Bun.spawnSync([sh, "-c", 'test -x "$HOME/.local/bin/ata"'], { env }).exitCode).toBe(
          0,
        );
      expect(await readdir(temp)).toEqual([]);
      expect(await Bun.file(join(ev, ".profile")).text()).toBe("değiştirme");
      await Bun.write(ata, "kullanıcı değişikliği");
      expect(Bun.spawnSync(kur, { env }).exitCode).toBe(1);
      expect(Bun.spawnSync(kaldır, { env }).exitCode).toBe(1);
      expect(await Bun.file(ata).text()).toBe("kullanıcı değişikliği");
      expect(await readdir(temp)).toEqual([]);
      await Bun.write(ata, "abc");
      expect(Bun.spawnSync(kaldır, { env }).exitCode).toBe(0);
      expect(await Bun.file(ata).exists()).toBe(false);
      await Bun.write(manifest, "bozuk\n");
      expect(Bun.spawnSync(kur, { env }).exitCode).toBe(1);
      expect(await readdir(temp)).toEqual([]);
      expect(await Bun.file(ata).exists()).toBe(false);
    } finally {
      await rm(geçici, { recursive: true, force: true });
    }
  },
  ENTEGRASYON_ZAMAN_ASIMI_MS,
);

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

test(
  "sh release smoke symlink TMPDIR'dan bağımsızdır; installer bağlantılı hedefi reddeder",
  async () => {
    const geçici = await realpath(await mkdtemp(join(tmpdir(), "ata-smoke-link-")));
    try {
      const fiziksel = join(geçici, "physical");
      const bağlantı = join(geçici, "var");
      await mkdir(fiziksel);
      await symlink(fiziksel, bağlantı, windows ? "junction" : "dir");
      expect(Bun.spawnSync([sh, "-c", 'test -L "$1"', "test", unixYolu(bağlantı)]).exitCode).toBe(
        0,
      );
      await Bun.write(
        join(geçici, "uname"),
        '#!/bin/sh\ncase "$1" in -s) echo Linux;; -m) echo x86_64;; esac\n',
      );
      await chmod(join(geçici, "uname"), 0o755);
      const asset = join(geçici, "ata-linux-x64");
      // CLI dış sınırı fixture'dır; gerçek Linux/macOS binary'si çalıştırılmaz.
      await Bun.write(
        asset,
        '#!/bin/sh\ncase "$1" in\nsürüm) echo "Ata Dil 0.1.0-rc.3";;\nyardım) echo "ata <komut>";;\ndenetle) echo "Denetim başarılı.";;\nçalıştır) printf "İbrahim: yönetici\\n"; case "$2" in *Unicode*) printf "Şğİı öçü ✓\\n";; esac;;\n*) exit 1;;\nesac\n',
      );
      await chmod(asset, 0o755);
      const satırlar = await Promise.all(
        ["ata-linux-x64", "kur.sh", "kaldir.sh"].map(async (ad) => {
          if (ad !== "ata-linux-x64") await copyFile(join(kök, "scripts", ad), join(geçici, ad));
          return `${new Bun.CryptoHasher("sha256").update(await Bun.file(join(geçici, ad)).arrayBuffer()).digest("hex")}  ${ad}\n`;
        }),
      );
      await Bun.write(join(geçici, "SHA256SUMS.txt"), satırlar.join(""));
      const env = {
        ...process.env,
        PATH: `${unixYolu(geçici)}:/usr/bin:/bin`,
        TMPDIR: unixYolu(bağlantı),
      };
      const önce = await readdir(kök);
      const smokeKomutu = [
        sh,
        unixYolu(join(kök, "scripts/yayın-platform-smoke.sh")),
        "ata-linux-x64",
        "0.1.0-rc.3",
        unixYolu(geçici),
      ];
      const smoke = Bun.spawnSync(smokeKomutu, { env });
      expect(smoke.exitCode, smoke.stderr.toString()).toBe(0);
      expect(smoke.stdout.toString()).toContain("standalone smoke başarılı");
      expect(await readdir(kök)).toEqual(önce);
      expect(await readdir(fiziksel)).toEqual([]);
      const başarısız = Bun.spawnSync(smokeKomutu.with(3, "0.0.0"), { env });
      expect(başarısız.exitCode).toBe(1);
      expect(başarısız.stderr.toString()).toContain("Beklenen stdout farklı");
      expect(await readdir(kök)).toEqual(önce);
      expect(await readdir(fiziksel)).toEqual([]);
      const kur = [
        sh,
        unixYolu(join(kök, "scripts/kur.sh")),
        "--local-file",
        unixYolu(asset),
        "--install-dir",
      ];
      const reddet = Bun.spawnSync([...kur, unixYolu(join(bağlantı, "bin"))], { env });
      expect(reddet.exitCode).toBe(1);
      expect(reddet.stderr.toString()).toContain("sembolik bağlantı");
      const normal = join(fiziksel, "bin");
      expect(Bun.spawnSync([...kur, unixYolu(normal)], { env }).exitCode).toBe(0);
      const kaldır = [sh, unixYolu(join(kök, "scripts/kaldir.sh")), "--install-dir"];
      expect(Bun.spawnSync([...kaldır, unixYolu(join(bağlantı, "bin"))], { env }).exitCode).toBe(1);
      expect(await Bun.file(join(normal, "ata")).exists()).toBe(true);
      expect(Bun.spawnSync([...kaldır, unixYolu(normal)], { env }).exitCode).toBe(0);
      expect(await Bun.file(join(normal, "ata")).exists()).toBe(false);
    } finally {
      await rm(geçici, { recursive: true, force: true });
    }
  },
  ENTEGRASYON_ZAMAN_ASIMI_MS,
);

const ağSenaryoları = (
  windows
    ? [resolve(process.env.WINDIR!, "System32/WindowsPowerShell/v1.0/powershell.exe"), "pwsh"]
    : ["sh"]
).flatMap((kabuk) => [
  { ilk: true, kabuk },
  { ilk: false, kabuk },
]);

test.each(ağSenaryoları)(
  "ağ installer URL’si doğru ve HTTP hatasında kurulum durur: %j",
  async ({ ilk, kabuk }) => {
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
        sonuç = Bun.spawnSync([kabuk, "-NoProfile", "-File", giriş], {
          env: { ...process.env, ATA_REPO: "ibodev1/ata" },
        });
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
      expect(
        await Bun.file(kayıt).exists(),
        `HTTP mock URL kaydını oluşturmadı (${kabuk}, exitCode=${sonuç.exitCode}): ${sonuç.stderr.toString()}`,
      ).toBe(true);
      const urls = (await Bun.file(kayıt).text()).trim().split(/\r?\n/);
      expect(urls, sonuç.stderr.toString()).toEqual([
        `https://github.com/ibodev1/ata/releases/download/v0.1.0-rc.3/${asset}`,
        ...(!ilk
          ? ["https://github.com/ibodev1/ata/releases/download/v0.1.0-rc.3/SHA256SUMS.txt"]
          : []),
      ]);
    } finally {
      await rm(geçici, { recursive: true, force: true });
    }
  },
  ENTEGRASYON_ZAMAN_ASIMI_MS,
);

test.each([
  { os: "Linux", arch: "x86_64", asset: "ata-linux-x64" },
  { os: "Darwin", arch: "x86_64", asset: "ata-darwin-x64" },
  { os: "Darwin", arch: "arm64", asset: "ata-darwin-arm64" },
  { os: "Darwin", arch: "aarch64", asset: "ata-darwin-arm64" },
  { os: "Linux", arch: "aarch64", asset: "" },
  { os: "Windows_NT", arch: "x86_64", asset: "" },
])(
  "sh installer platform seçimi ve uninstall: %j",
  async ({ os, arch, asset }) => {
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
      const kaldır = [
        sh,
        unixYolu(join(kök, "scripts/kaldir.sh")),
        "--install-dir",
        unixYolu(dizin),
      ];
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
  },
  ENTEGRASYON_ZAMAN_ASIMI_MS,
);

test.each([
  { ad: "uyuşmazlık", metin: `${"0".repeat(64)}  ASSET\n` },
  { ad: "eksik asset", metin: `${abc}  baska\n` },
  { ad: "bozuk", metin: "bozuk  ASSET\n" },
  { ad: "yinelenen", metin: `${abc}  ASSET\n${abc}  ASSET\n` },
])(
  "gerçek yerel installer checksum hatasında hedefe yazmaz: $ad",
  async ({ metin }) => {
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
  },
  ENTEGRASYON_ZAMAN_ASIMI_MS,
);
