// After-fix previews (attach-preview): what a file really is, from its bytes
// rather than the client's Content-Type, and how long an MP4 runs, from its
// `mvhd` header. Pure functions so they're unit-tested (media.test.ts).

export const MAX_PREVIEW_BYTES = 20 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 30;

export interface MediaKind {
  mediaType: "image/png" | "image/jpeg" | "image/gif" | "image/webp" | "video/mp4";
  extension: string;
  isVideo: boolean;
}

export function sniffMedia(bytes: Uint8Array): MediaKind | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(1, 4) === "PNG") {
    return { mediaType: "image/png", extension: "png", isVideo: false };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mediaType: "image/jpeg", extension: "jpg", isVideo: false };
  }
  if (bytes.length >= 6 && (ascii(0, 6) === "GIF87a" || ascii(0, 6) === "GIF89a")) {
    return { mediaType: "image/gif", extension: "gif", isVideo: false };
  }
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
    return { mediaType: "image/webp", extension: "webp", isVideo: false };
  }
  if (bytes.length >= 12 && ascii(4, 8) === "ftyp") {
    return { mediaType: "video/mp4", extension: "mp4", isVideo: true };
  }
  return null;
}

/**
 * Duration in seconds from the movie header (`moov` → `mvhd`), or null when
 * the file has none we can read. Walks top-level boxes only as far as
 * `moov`, so a large `mdat` is skipped by its size, not scanned.
 */
export function mp4DurationSeconds(bytes: Uint8Array): number | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const type = (at: number) => String.fromCharCode(...bytes.subarray(at + 4, at + 8));

  const findBox = (start: number, end: number, wanted: string): [number, number] | null => {
    let at = start;
    while (at + 8 <= end) {
      let size = view.getUint32(at);
      let header = 8;
      if (size === 1) {
        if (at + 16 > end) return null;
        const big = view.getBigUint64(at + 8);
        if (big > BigInt(Number.MAX_SAFE_INTEGER)) return null;
        size = Number(big);
        header = 16;
      } else if (size === 0) {
        size = end - at;
      }
      if (size < header || at + size > end) return null;
      if (type(at) === wanted) return [at + header, at + size];
      at += size;
    }
    return null;
  };

  const moov = findBox(0, bytes.length, "moov");
  if (!moov) return null;
  const mvhd = findBox(moov[0], moov[1], "mvhd");
  if (!mvhd) return null;
  const [body, end] = mvhd;
  const version = bytes[body];
  let timescale: number;
  let duration: number;
  if (version === 1) {
    if (body + 32 > end) return null;
    timescale = view.getUint32(body + 20);
    duration = Number(view.getBigUint64(body + 24));
  } else {
    if (body + 20 > end) return null;
    timescale = view.getUint32(body + 12);
    duration = view.getUint32(body + 16);
  }
  if (!timescale) return null;
  return duration / timescale;
}
