import { createServer, type Server } from "node:http";
import { randomBytes } from "node:crypto";
import { hostname } from "node:os";
import open from "open";
import { CREDENTIALS_PATH, saveCredentials } from "../config.js";

const DEFAULT_DASHBOARD_URL = "https://feedback-kit.tianhaozhou95.workers.dev";
const AUTH_TIMEOUT_MS = 5 * 60_000;

interface CallbackResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

const SUCCESS_HTML = `<!doctype html><html><head><title>FeedbackKit CLI</title></head>
<body style="font-family:-apple-system,system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;">
<p>Logged in. You can close this tab and return to your terminal.</p>
</body></html>`;

const ERROR_HTML = `<!doctype html><html><head><title>FeedbackKit CLI</title></head>
<body style="font-family:-apple-system,system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;">
<p>Something went wrong finishing login. Go back to your terminal and try again.</p>
</body></html>`;

function waitForCallback(expectedState: string): {
  port: Promise<number>;
  result: Promise<CallbackResult>;
  close: () => void;
} {
  let server!: Server;
  let resolveResult!: (r: CallbackResult) => void;
  let rejectResult!: (e: Error) => void;
  const result = new Promise<CallbackResult>((res, rej) => {
    resolveResult = res;
    rejectResult = rej;
  });

  const port = new Promise<number>((resolvePort, rejectPort) => {
    server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      if (url.pathname !== "/callback") {
        res.writeHead(404).end();
        return;
      }

      const state = url.searchParams.get("state");
      const accessToken = url.searchParams.get("access_token");
      const refreshToken = url.searchParams.get("refresh_token");
      const expiresAtRaw = url.searchParams.get("expires_at");
      const supabaseUrl = url.searchParams.get("supabase_url");
      const supabaseAnonKey = url.searchParams.get("supabase_anon_key");

      const valid = state === expectedState && accessToken && refreshToken && supabaseUrl && supabaseAnonKey;

      res.writeHead(valid ? 200 : 400, { "Content-Type": "text/html" });
      res.end(valid ? SUCCESS_HTML : ERROR_HTML);

      if (valid) {
        resolveResult({
          accessToken,
          refreshToken,
          expiresAt: expiresAtRaw ? Number(expiresAtRaw) : null,
          supabaseUrl,
          supabaseAnonKey,
        });
      } else {
        rejectResult(new Error("Received an invalid or mismatched callback — try `feedbackkit login` again."));
      }
    });

    server.on("error", rejectPort);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address && typeof address === "object") {
        resolvePort(address.port);
      } else {
        rejectPort(new Error("Failed to start the local callback server."));
      }
    });
  });

  return { port, result, close: () => server.close() };
}

export async function login(options: { dashboardUrl?: string }): Promise<void> {
  const dashboardUrl = (
    options.dashboardUrl ??
    process.env.FEEDBACKKIT_DASHBOARD_URL ??
    DEFAULT_DASHBOARD_URL
  ).replace(/\/+$/, "");

  const state = randomBytes(24).toString("hex");
  const label = `CLI on ${hostname()}`;

  const { port, result, close } = waitForCallback(state);

  try {
    const authorizeUrl = new URL(`${dashboardUrl}/cli-auth`);
    authorizeUrl.searchParams.set("port", String(await port));
    authorizeUrl.searchParams.set("state", state);
    authorizeUrl.searchParams.set("label", label);

    console.log(`Opening your browser to authorize this CLI:\n\n  ${authorizeUrl.toString()}\n`);
    console.log("If it doesn't open automatically, copy that link into your browser.\n");
    open(authorizeUrl.toString()).catch(() => {
      /* the URL was already printed above */
    });

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Timed out waiting for browser authorization (5 minutes).")),
        AUTH_TIMEOUT_MS,
      ),
    );

    const callback = await Promise.race([result, timeout]);

    saveCredentials({
      supabaseUrl: callback.supabaseUrl,
      supabaseAnonKey: callback.supabaseAnonKey,
      accessToken: callback.accessToken,
      refreshToken: callback.refreshToken,
      expiresAt: callback.expiresAt,
    });

    console.log(`Logged in. Credentials saved to ${CREDENTIALS_PATH}.`);
  } finally {
    close();
  }
}
