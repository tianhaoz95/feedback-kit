import { assertEquals } from "jsr:@std/assert@1";
import { prVerification } from "./prStatus.ts";

Deno.test("no linked reports → no status", () => {
  assertEquals(prVerification([]), null);
});

Deno.test("pending until every linked report is verified", () => {
  assertEquals(prVerification(["pr_open"])?.state, "pending");
  assertEquals(prVerification(["pr_open"])?.description, "0/1 report verified; ship a preview build to check it");
  assertEquals(prVerification(["verified", "shipped"])?.description, "1/2 reports verified; waiting on the preview check");
  assertEquals(prVerification(["verified", "verified"]), { state: "success", description: "All 2 reports verified" });
});

Deno.test("a reopened report fails the check", () => {
  assertEquals(prVerification(["verified", "reopened"])?.state, "failure");
});
