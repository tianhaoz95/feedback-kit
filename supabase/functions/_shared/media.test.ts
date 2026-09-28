import { assertAlmostEquals, assertEquals } from "jsr:@std/assert@1";
import { mp4DurationSeconds, sniffMedia } from "./media.ts";

function box(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + body.length);
  new DataView(out.buffer).setUint32(0, out.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(body, 8);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

function mvhd(version: 0 | 1, timescale: number, duration: number): Uint8Array {
  const body = new Uint8Array(version === 1 ? 108 : 96);
  const v = new DataView(body.buffer);
  body[0] = version;
  if (version === 1) {
    v.setUint32(20, timescale);
    v.setBigUint64(24, BigInt(duration));
  } else {
    v.setUint32(12, timescale);
    v.setUint32(16, duration);
  }
  return box("mvhd", body);
}

const ftyp = box("ftyp", new TextEncoder().encode("isom\0\0\0\0isomiso2mp41"));

Deno.test("sniffMedia recognizes images and MP4 by their bytes", () => {
  assertEquals(sniffMedia(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.mediaType, "image/png");
  assertEquals(sniffMedia(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.mediaType, "image/jpeg");
  assertEquals(sniffMedia(new TextEncoder().encode("GIF89a......"))?.mediaType, "image/gif");
  assertEquals(sniffMedia(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))?.mediaType, "image/webp");
  assertEquals(sniffMedia(ftyp)?.mediaType, "video/mp4");
  assertEquals(sniffMedia(new TextEncoder().encode("<svg xmlns=...")), null);
  assertEquals(sniffMedia(new Uint8Array([])), null);
});

Deno.test("mp4DurationSeconds reads mvhd (v0 and v1), past a large mdat", () => {
  const mdat = box("mdat", new Uint8Array(4096));
  assertAlmostEquals(mp4DurationSeconds(concat(ftyp, mdat, box("moov", mvhd(0, 600, 7200))))!, 12);
  assertAlmostEquals(mp4DurationSeconds(concat(ftyp, box("moov", concat(mvhd(1, 1000, 31_500)))))!, 31.5);
});

Deno.test("mp4DurationSeconds refuses what it can't read", () => {
  assertEquals(mp4DurationSeconds(ftyp), null); // no moov
  assertEquals(mp4DurationSeconds(concat(ftyp, box("moov", new Uint8Array(0)))), null); // no mvhd
  const truncated = concat(ftyp, box("moov", mvhd(0, 600, 7200))).subarray(0, 40);
  assertEquals(mp4DurationSeconds(truncated), null);
  assertEquals(mp4DurationSeconds(concat(ftyp, box("moov", mvhd(0, 0, 10)))), null); // timescale 0
});
