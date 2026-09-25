/** `https://app.example.com` or `https://*.example.com` (optional port), no path. */
export function normalizeOrigin(input: string): string | null {
  const value = input.trim().toLowerCase().replace(/\/+$/, "");
  if (value === "*") return null;
  const match = value.match(/^(https?):\/\/(\*\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)*)(:\d{1,5})?$/);
  return match ? value : null;
}
