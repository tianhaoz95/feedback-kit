import { createAppAuth } from "npm:@octokit/auth-app@^6.0.0";

export function getGitHubAuth() {
  const appId = Deno.env.get("GITHUB_APP_ID");
  const privateKey = Deno.env.get("GITHUB_APP_PRIVATE_KEY");
  const clientId = Deno.env.get("GITHUB_APP_CLIENT_ID");

  if (!appId || !privateKey) {
    return null;
  }

  const normalizedKey = privateKey.trim().replace(/^"|"$/g, "").replace(/\\n/g, "\n");

  return createAppAuth({
    appId,
    privateKey: normalizedKey,
    clientId,
  });
}

export async function getInstallationIdForRepo(
  owner: string,
  repo: string,
): Promise<number | null> {
  try {
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
  } catch (err) {
    console.warn("Failed to get installation ID for repo:", err);
    return null;
  }
}

export async function getInstallationToken(
  installationId: number,
): Promise<string | null> {
  try {
    const auth = getGitHubAuth();
    if (!auth) return null;
    const installationAuth = await auth({
      type: "installation",
      installationId,
    });
    return installationAuth.token;
  } catch (err) {
    console.warn("Failed to get installation token:", err);
    return null;
  }
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
    const chunkSize = 8192;
    for (let i = 0; i < imageBytes.length; i += chunkSize) {
      binary += String.fromCharCode(...imageBytes.subarray(i, i + chunkSize));
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

