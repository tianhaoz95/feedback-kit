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


async function githubRequest(token: string, method: string, path: string, body?: unknown): Promise<Response> {
  return await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "FeedbackKit",
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/**
 * An installation token for a project's connected repo, discovering (and
 * caching on the project row) the installation id the first time. Null when
 * the GitHub App isn't configured/installed — callers treat GitHub as
 * best-effort unless it's the whole point of the request.
 */
// deno-lint-ignore no-explicit-any
export async function getProjectInstallationToken(adminClient: any, project: {
  id: string;
  github_repo?: string | null;
  github_installation_id?: number | null;
}): Promise<string | null> {
  if (!project.github_repo || !project.github_repo.includes("/")) return null;
  let installationId = project.github_installation_id ?? null;
  if (!installationId) {
    const [owner, repo] = project.github_repo.split("/");
    installationId = await getInstallationIdForRepo(owner, repo);
    if (!installationId) return null;
    await adminClient.from("projects").update({ github_installation_id: installationId }).eq("id", project.id);
  }
  return await getInstallationToken(installationId);
}

export async function addIssueComment(token: string, repoFullName: string, issueNumber: number, body: string): Promise<boolean> {
  try {
    const res = await githubRequest(token, "POST", `/repos/${repoFullName}/issues/${issueNumber}/comments`, { body });
    return res.ok;
  } catch (err) {
    console.warn("Failed to comment on issue:", err);
    return false;
  }
}

export async function setIssueState(
  token: string,
  repoFullName: string,
  issueNumber: number,
  state: "open" | "closed",
): Promise<boolean> {
  try {
    const res = await githubRequest(token, "PATCH", `/repos/${repoFullName}/issues/${issueNumber}`, { state });
    return res.ok;
  } catch (err) {
    console.warn("Failed to change issue state:", err);
    return false;
  }
}

export async function addIssueLabels(token: string, repoFullName: string, issueNumber: number, labels: string[]): Promise<boolean> {
  if (labels.length === 0) return true;
  try {
    const res = await githubRequest(token, "POST", `/repos/${repoFullName}/issues/${issueNumber}/labels`, { labels });
    return res.ok;
  } catch (err) {
    console.warn("Failed to label issue:", err);
    return false;
  }
}

/**
 * Hands an issue to whatever coding agent the project has configured
 * (0014_closed_loop.sql `dispatch_labels`/`dispatch_comment`). Labels are the
 * robust trigger: a label added with a GitHub App installation token fires
 * `issues.labeled` workflows (e.g. claude-code-action's `label_trigger`),
 * while a mention comment works for agents that accept bot mentions.
 * Returns what was actually done, for the timeline.
 */
export async function dispatchIssueToAgent(
  token: string,
  repoFullName: string,
  issueNumber: number,
  settings: { dispatch_labels?: string[] | null; dispatch_comment?: string | null },
  context?: string,
): Promise<{ labels: string[]; commented: boolean } | null> {
  const labels = (settings.dispatch_labels ?? []).filter((l) => l.trim().length > 0);
  const comment = settings.dispatch_comment?.trim();
  if (labels.length === 0 && !comment) return null;

  let labeled: string[] = [];
  if (labels.length > 0) {
    // Re-adding a label that's already present doesn't fire `labeled` again,
    // so a re-dispatch (reporter reopened) removes it first.
    for (const label of labels) {
      try {
        await githubRequest(token, "DELETE", `/repos/${repoFullName}/issues/${issueNumber}/labels/${encodeURIComponent(label)}`);
      } catch {
        // Not present — fine.
      }
    }
    if (await addIssueLabels(token, repoFullName, issueNumber, labels)) labeled = labels;
  }
  let commented = false;
  if (comment) {
    commented = await addIssueComment(token, repoFullName, issueNumber, context ? `${comment}\n\n${context}` : comment);
  }
  return { labels: labeled, commented };
}
