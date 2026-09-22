import { createAppAuth } from "npm:@octokit/auth-app@^6.0.0";

export function getGitHubAuth() {
  const appId = Deno.env.get("GITHUB_APP_ID");
  const privateKey = Deno.env.get("GITHUB_APP_PRIVATE_KEY");
  const clientId = Deno.env.get("GITHUB_APP_CLIENT_ID");

  if (!appId || !privateKey) {
    return null;
  }

  return createAppAuth({
    appId,
    privateKey: privateKey.replace(/\\n/g, "\n"),
    clientId,
  });
}

export async function getInstallationIdForRepo(
  owner: string,
  repo: string,
): Promise<number | null> {
  const auth = getGitHubAuth();
  if (!auth) return null;
  const appAuth = await auth({ type: "app" });

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/installation`, {
    headers: {
      Authorization: `Bearer ${appAuth.token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "FeedbackKit",
    },
  });

  if (!res.ok) {
    return null;
  }
  const data = await res.json();
  return data.id ?? null;
}

export async function getInstallationToken(
  installationId: number,
): Promise<string | null> {
  const auth = getGitHubAuth();
  if (!auth) return null;
  const installationAuth = await auth({
    type: "installation",
    installationId,
  });
  return installationAuth.token;
}

export async function uploadScreenshotToRepo(
  token: string,
  owner: string,
  repo: string,
  feedbackId: string,
  imageBytes: Uint8Array,
): Promise<string | null> {
  try {
    const path = `.feedback/screenshots/${feedbackId}.png`;
    let binary = "";
    const len = imageBytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(imageBytes[i]);
    }
    const content = btoa(binary);

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "FeedbackKit",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `chore(feedback): upload screenshot for feedback ${feedbackId}`,
        content,
      }),
    });

    if (res.ok) {
      return `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${path}`;
    }
  } catch (err) {
    console.warn("Failed to commit screenshot to repo contents:", err);
  }
  return null;
}

export async function createGitHubIssue(
  token: string,
  owner: string,
  repo: string,
  title: string,
  body: string,
): Promise<{ number: number; html_url: string }> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "FeedbackKit",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title,
      body,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GitHub API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return {
    number: data.number,
    html_url: data.html_url,
  };
}

export interface GitHubAppRepo {
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  installation_id: number;
  owner: string;
}

export async function listAppRepositories(userLogin?: string | null): Promise<GitHubAppRepo[]> {
  const auth = getGitHubAuth();
  if (!auth) return [];
  const appAuth = await auth({ type: "app" });

  const res = await fetch("https://api.github.com/app/installations?per_page=100", {
    headers: {
      Authorization: `Bearer ${appAuth.token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "FeedbackKit",
    },
  });

  if (!res.ok) {
    console.error("Failed to fetch app installations:", res.status, await res.text());
    return [];
  }

  const installations: Array<{ id: number; account: { login: string; type: string } }> = await res.json();
  const allRepos: GitHubAppRepo[] = [];

  for (const inst of installations) {
    const token = await getInstallationToken(inst.id);
    if (!token) continue;

    try {
      const repoRes = await fetch("https://api.github.com/installation/repositories?per_page=100", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "FeedbackKit",
        },
      });

      if (repoRes.ok) {
        const repoData = await repoRes.json();
        const repos = repoData.repositories || [];
        for (const r of repos) {
          allRepos.push({
            name: r.name,
            full_name: r.full_name,
            private: Boolean(r.private),
            description: r.description ?? null,
            installation_id: inst.id,
            owner: r.owner?.login ?? inst.account.login,
          });
        }
      }
    } catch (e) {
      console.warn(`Failed to list repos for installation ${inst.id}:`, e);
    }
  }

  // If userLogin is specified, sort matching repos first
  if (userLogin) {
    const lowerUser = userLogin.toLowerCase();
    allRepos.sort((a, b) => {
      const aMatches = a.owner.toLowerCase() === lowerUser;
      const bMatches = b.owner.toLowerCase() === lowerUser;
      if (aMatches && !bMatches) return -1;
      if (!aMatches && bMatches) return 1;
      return a.full_name.localeCompare(b.full_name);
    });
  } else {
    allRepos.sort((a, b) => a.full_name.localeCompare(b.full_name));
  }

  return allRepos;
}

