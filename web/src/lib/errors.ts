/**
 * Supabase's PostgrestError/AuthError shapes are plain `{ message, ... }`
 * objects, not `Error` instances, so `err instanceof Error` misses them and
 * falls through to a generic fallback — hiding the actual reason a query
 * failed. This checks for a string `message` field on anything thrown.
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (
    err &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    return (err as { message: string }).message;
  }
  return fallback;
}
