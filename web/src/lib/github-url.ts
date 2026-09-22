/**
 * Normalizes and extracts owner and repository name from either a
 * canonical `owner/repo` string or any GitHub URL (HTTPS, SSH, web link with path/hash).
 */
export function extractRepo(input: string): { owner: string; repo: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. Try URL patterns:
  //    https://github.com/owner/repo
  //    https://github.com/owner/repo/issues/42
  //    git@github.com:owner/repo.git
  const urlMatch = trimmed.match(/(?:github\.com[/:])([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git|\/.*)?$/i);
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2] };
  }

  // 2. Try owner/repo format:
  const clean = trimmed.replace(/^\/+|\/+$/g, "");
  const parts = clean.split("/");
  if (parts.length === 2 && parts[0].length > 0 && parts[1].length > 0) {
    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/i, "");
    if (/^[a-zA-Z0-9_.-]+$/.test(owner) && /^[a-zA-Z0-9_.-]+$/.test(repo)) {
      return { owner, repo };
    }
  }

  return null;
}
