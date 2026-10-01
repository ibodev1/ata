import { expect, test } from "bun:test";
import { dirname, resolve } from "node:path";

interface Workflow {
  on: Record<string, unknown> | string[];
  permissions: { contents: string };
  jobs: Record<
    string,
    {
      "runs-on": string;
      needs?: string | string[];
      "timeout-minutes"?: number;
      if?: string;
      permissions?: { contents: string };
      steps: { uses?: string; run?: string; with?: Record<string, unknown> }[];
    }
  >;
}

const kök = resolve(import.meta.dir, "..");
const bash =
  process.platform === "win32"
    ? resolve(dirname(dirname(Bun.which("git")!)), "bin/bash.exe")
    : "bash";
const release = Bun.YAML.parse(
  await Bun.file(resolve(kök, ".github/workflows/release.yml")).text(),
) as Workflow;

test.each([
  { önSürüm: "true", sürüm: "0.1.0-rc.3", beklenen: true },
  { önSürüm: "false", sürüm: "0.1.0", beklenen: false },
])("yayın workflow komutu RC/final ayrımını korur: %j", ({ önSürüm, sürüm, beklenen }) => {
  const komut = release.jobs.publish!.steps.at(-1)!.run!;
  // Dış gh sınırı taklit edilir; YAML'daki gerçek shell komutu çalışır. Yayın yapılmaz.
  const sonuç = Bun.spawnSync([bash, "-c", `gh() { printf '%s\\n' "$@"; };\n${komut}`], {
    cwd: kök,
    env: { ...process.env, PRERELEASE: önSürüm, VERSION: sürüm, RELEASE_TAG: `v${sürüm}` },
  });
  expect(sonuç.exitCode, sonuç.stderr.toString()).toBe(0);
  const args = sonuç.stdout.toString().trim().split(/\r?\n/);
  expect(args.slice(0, 3)).toEqual(["release", "create", `v${sürüm}`]);
  expect(args).toContain("--verify-tag");
  expect(args.includes("--prerelease")).toBe(beklenen);
  expect(args.includes("--latest=false")).toBe(beklenen);
});

test("CI/release YAML kalite ve en düşük izin sözleşmesini korur", async () => {
  const ci = Bun.YAML.parse(
    await Bun.file(resolve(kök, ".github/workflows/ci.yml")).text(),
  ) as Workflow;
  expect(ci.on).toEqual(["push", "pull_request"]);
  expect(ci.jobs.check!["runs-on"]).toBe("ubuntu-24.04");
  expect(ci.jobs["windows-installer"]!["runs-on"]).toBe("windows-latest");
  expect(release.jobs.build!["runs-on"]).toBe("ubuntu-24.04");
  expect(release.jobs.publish!["runs-on"]).toBe("ubuntu-24.04");
  expect(ci.permissions.contents).toBe("read");
  expect(release.on).toEqual({ workflow_dispatch: null, push: { tags: ["v*"] } });
  expect(release.permissions.contents).toBe("read");
  expect(release.jobs.publish!.permissions!.contents).toBe("write");
  expect(release.jobs.publish!.if).toBe(
    "github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')",
  );
  const platformlar = [
    ["verify-linux-x64", "ubuntu-24.04", "bash", "ata-linux-x64"],
    ["verify-windows-x64", "windows-latest", "pwsh", "yayın-platform-smoke.ps1"],
    ["verify-macos-x64", "macos-15-intel", "bash", "ata-darwin-x64"],
    ["verify-macos-arm64", "macos-15", "bash", "ata-darwin-arm64"],
  ] as const;
  expect(release.jobs.publish!.needs).toEqual(["build", ...platformlar.map(([ad]) => ad)]);
  for (const [ad, runner, shell, komut] of platformlar) {
    const job = release.jobs[ad]!;
    expect(job).toBeDefined();
    expect(job["runs-on"]).toBe(runner);
    expect(job.needs).toBe("build");
    expect(job.if).toBeUndefined();
    expect(job["timeout-minutes"]).toBe(15);
    expect(job.permissions?.contents ?? release.permissions.contents).toBe("read");
    const indirme = job.steps.find((step) => step.uses?.startsWith("actions/download-artifact@"))!;
    expect(indirme.with).toEqual({
      name: "ata-${{ needs.build.outputs.version }}-release-candidate",
      path: "dist/release",
    });
    expect(job.steps.some((step) => step.uses?.startsWith("oven-sh/setup-bun@"))).toBe(false);
    const smoke = job.steps.at(-1)! as { run: string; shell: string };
    expect(smoke.shell).toBe(shell);
    expect(smoke.run).toContain(komut);
    expect(smoke.run).not.toMatch(/\bbun\b|release:prepare|\bbuild\b/);
  }
  for (const workflow of [ci, release]) {
    for (const job of Object.values(workflow.jobs)) {
      for (const step of job.steps) {
        if (step.uses)
          expect(step.uses).toMatch(
            /^(actions\/(?:checkout|upload-artifact|download-artifact)|oven-sh\/setup-bun)@[a-f0-9]{40}$/,
          );
        if (step.uses?.startsWith("oven-sh/setup-bun@"))
          expect(step.with?.["bun-version"]).toBe("1.4.2");
      }
    }
  }
  const kalite = release.jobs.build!.steps.map((step) => step.run);
  expect(kalite).toContain("bun ci");
  expect(kalite).toContain("bun run check");
  expect(kalite).toContain("bun run test:installer");
});
