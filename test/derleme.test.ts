import { expect, test } from "bun:test";
import { derlemeHedefi } from "../scripts/derle.ts";

test("yerel Windows çıktısı dist köküne gider", () => {
  expect(derlemeHedefi([], "win32", "x64")).toMatchObject({
    ad: "windows-x64",
    hedef: "bun-windows-x64",
    çıktı: "ata.exe",
  });
});

test.each(["windows-x64", "linux-x64", "darwin-x64", "darwin-arm64"])(
  "açık hedef ayrı dizine gider: %s",
  (ad) => {
    const hedef = derlemeHedefi(["--", "--target", ad], "win32", "x64");
    expect(hedef.çıktı).toStartWith(`${ad}/ata`);
    expect(hedef.hedef).toBe(`bun-${ad}`);
  },
);

test.each([
  { args: ["--target", "../../dışarı"] },
  { args: ["--target"] },
  { args: ["--all"] },
  { args: ["--target", "linux-x64", "fazla"] },
])("geçersiz build argümanını reddeder: %j", ({ args }) => {
  expect(() => derlemeHedefi(args, "win32", "x64")).toThrow();
});

test("desteklenmeyen yerel platformu reddeder", () => {
  expect(() => derlemeHedefi([], "freebsd", "x64")).toThrow();
});
