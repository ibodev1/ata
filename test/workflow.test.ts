import { expect, test } from "bun:test";
import { dirname, resolve } from "node:path";

interface Workflow {
  on: Record<string, unknown> | string[];
  permissions: { contents: string };
  jobs: Record<
    string,
    {
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
  expect(ci.permissions.contents).toBe("read");
  expect(release.on).toEqual({ workflow_dispatch: null, push: { tags: ["v*"] } });
  expect(release.permissions.contents).toBe("read");
  expect(release.jobs.publish!.permissions!.contents).toBe("write");
  expect(release.jobs.publish!.if).toBe(
    "github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')",
  );
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
