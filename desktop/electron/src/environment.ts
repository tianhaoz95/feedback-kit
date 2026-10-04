import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import os from "node:os";

/**
 * OS name/version and machine model, read the way each OS exposes them —
 * the details a browser user agent can't give (Windows 11 vs 10, the Linux
 * distribution, "MacBookPro18,3"). Plain Node so it's testable outside Electron.
 */

export interface OsDetails {
  osName: string;
  osVersion: string;
  deviceModel: string;
}

function run(command: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    execFile(command, args, { timeout: 3000, windowsHide: true }, (error, stdout) => resolve(error ? "" : String(stdout).trim()));
  });
}

async function readText(path: string): Promise<string> {
  try {
    return (await readFile(path, "utf8")).trim();
  } catch {
    return "";
  }
}

/** "10.0.26100" → "11 (26100)": Windows 11 still reports NT 10.0, with build 22000+. */
export function windowsVersion(release: string): string {
  const [major, , build] = release.split(".");
  const buildNumber = Number(build);
  if (major === "10" && buildNumber >= 22000) return `11 (${build})`;
  if (major === "10" && build) return `10 (${build})`;
  return release;
}

/** `PRETTY_NAME` from /etc/os-release, e.g. "Ubuntu 24.04.1 LTS". */
export function parseOsRelease(text: string): string {
  const line = text.split("\n").find((l) => l.startsWith("PRETTY_NAME="));
  return line ? line.slice("PRETTY_NAME=".length).replace(/^"|"$/g, "") : "";
}

/** Value of `SystemProductName`/`SystemManufacturer` in `reg query` output. */
export function parseRegValue(output: string, name: string): string {
  const line = output.split(/\r?\n/).find((l) => l.trim().startsWith(name));
  return line ? line.trim().split(/\s{2,}|\t/).slice(2).join(" ").trim() : "";
}

export async function osDetails(systemVersion: string = os.release()): Promise<OsDetails> {
  const arch = os.arch();
  switch (process.platform) {
    case "darwin": {
      const model = await run("sysctl", ["-n", "hw.model"]);
      return { osName: "macOS", osVersion: systemVersion, deviceModel: model || `Mac (${arch})` };
    }
    case "win32": {
      const output = await run("reg", ["query", "HKLM\\HARDWARE\\DESCRIPTION\\System\\BIOS"]);
      const vendor = parseRegValue(output, "SystemManufacturer");
      const product = parseRegValue(output, "SystemProductName");
      const model = product ? (vendor && !product.startsWith(vendor) ? `${vendor} ${product}` : product) : "";
      return { osName: "Windows", osVersion: windowsVersion(systemVersion), deviceModel: model || `PC (${arch})` };
    }
    case "linux": {
      const [release, vendor, product] = await Promise.all([
        readText("/etc/os-release"),
        readText("/sys/class/dmi/id/sys_vendor"),
        readText("/sys/class/dmi/id/product_name"),
      ]);
      const model = product ? (vendor && !product.startsWith(vendor) ? `${vendor} ${product}` : product) : "";
      return { osName: "Linux", osVersion: parseOsRelease(release) || systemVersion, deviceModel: model || `PC (${arch})` };
    }
    default:
      return { osName: process.platform, osVersion: systemVersion, deviceModel: arch };
  }
}
