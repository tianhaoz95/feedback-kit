import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { windowsVersion, parseOsRelease, parseRegValue, osDetails } = require("../dist/environment.js");

test("windowsVersion tells Windows 11 from 10 by build number", () => {
  assert.equal(windowsVersion("10.0.26100"), "11 (26100)");
  assert.equal(windowsVersion("10.0.22000"), "11 (22000)");
  assert.equal(windowsVersion("10.0.19045"), "10 (19045)");
  assert.equal(windowsVersion("6.1.7601"), "6.1.7601");
});

test("parseOsRelease reads PRETTY_NAME", () => {
  const text = 'NAME="Ubuntu"\nVERSION_ID="24.04"\nPRETTY_NAME="Ubuntu 24.04.1 LTS"\nID=ubuntu\n';
  assert.equal(parseOsRelease(text), "Ubuntu 24.04.1 LTS");
  assert.equal(parseOsRelease("ID=arch\nPRETTY_NAME=Arch Linux\n"), "Arch Linux");
  assert.equal(parseOsRelease(""), "");
});

test("parseRegValue reads values from reg query output", () => {
  const output = [
    "",
    "HKEY_LOCAL_MACHINE\\HARDWARE\\DESCRIPTION\\System\\BIOS",
    "    BIOSVendor    REG_SZ    Microsoft Corporation",
    "    SystemManufacturer    REG_SZ    Microsoft Corporation",
    "    SystemProductName    REG_SZ    Surface Laptop 7",
    "",
  ].join("\r\n");
  assert.equal(parseRegValue(output, "SystemProductName"), "Surface Laptop 7");
  assert.equal(parseRegValue(output, "SystemManufacturer"), "Microsoft Corporation");
  assert.equal(parseRegValue(output, "Missing"), "");
});

test("osDetails describes this machine", async () => {
  const details = await osDetails();
  assert.ok(details.osName.length > 0);
  assert.ok(details.osVersion.length > 0);
  assert.ok(details.deviceModel.length > 0);
  if (process.platform === "darwin") assert.equal(details.osName, "macOS");
});

test("the preload is self-contained (sandboxed preloads can only require electron)", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../dist/preload.js", import.meta.url), "utf8");
  const requires = [...source.matchAll(/require\("([^"]+)"\)/g)].map((m) => m[1]);
  assert.deepEqual(requires, ["electron"]);
  const shared = require("../dist/shared.js");
  for (const channel of Object.values(shared.CHANNELS)) assert.ok(source.includes(`"${channel}"`), channel);
  assert.ok(source.includes(`"${shared.BRIDGE_KEY}"`));
});
