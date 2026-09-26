// An invite link opened while signed out: remembered across the GitHub OAuth
// round trip so /login can send the user straight back to accept it (the
// same idea as cliAuth.ts's pending CLI login).
const KEY = "feedbackkit.pendingInvite";

export function stashPendingInvite(token: string) {
  try {
    sessionStorage.setItem(KEY, token);
  } catch {
    // Without storage the user just lands on /projects and can reopen the link.
  }
}

export function takePendingInvite(): string | null {
  try {
    const token = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return token && /^fki_[0-9a-f]+$/.test(token) ? token : null;
  } catch {
    return null;
  }
}
