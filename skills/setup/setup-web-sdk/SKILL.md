---
name: setup-web-sdk
description: Integrate the FeedbackKit web SDK (npm feedbackkit-web) into a website or web app (React, Next.js, Vue, Svelte, plain HTML) — installs the package, configures the project key client-side, adds a feedback trigger, and wires route-based screen names.
---

# setup-web-sdk

Integrates FeedbackKit's web SDK into a web application. The agent installs `feedbackkit-web`, configures it in client-only code, adds a trigger (floating button, keyboard shortcut, or an existing menu/button), and keeps `FeedbackKit.currentScreen` in sync with the router so reports name the page they came from.

## When to Use

- Use when adding in-app feedback / bug reporting with screenshots and annotations to a website or web app.
- Trigger phrases: "add feedbackkit to my web app", "setup feedbackkit web", "add a feedback button to the site", "install feedbackkit-web".

## Prerequisites

- A browser-based app (any framework, or none).
- A FeedbackKit project key (and endpoint URL when self-hosting) from the dashboard's **SDK setup** tab — optional if the app only handles reports locally via `FeedbackKit.present()`.

## Step-by-Step Instructions

### Step 1 -- Install

```bash
npm install feedbackkit-web
```

No bundler? Add the script tag instead (exposes `window.FeedbackKit`):

```html
<script src="https://cdn.jsdelivr.net/npm/feedbackkit-web/dist/feedbackkit.iife.js"></script>
```

### Step 2 -- Configure client-side, as early as possible

The SDK uses `window`/`document`, so it must never run during server rendering. Configure it early so console errors from startup are captured too.

#### Vite / CRA / plain SPA (`src/main.tsx` or equivalent)
```ts
import { FeedbackKit } from "feedbackkit-web";

FeedbackKit.configure({
  projectKey: "<PROJECT_KEY>",
  endpoint: "<ENDPOINT_URL>", // omit to use the hosted dashboard
  appVersion: import.meta.env.VITE_APP_VERSION, // optional
});
```

#### Next.js App Router (`app/feedback.tsx`, rendered once from `app/layout.tsx`)
```tsx
"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { FeedbackKit } from "feedbackkit-web";

export function Feedback() {
  const pathname = usePathname();
  useEffect(() => {
    FeedbackKit.configure({ projectKey: process.env.NEXT_PUBLIC_FEEDBACKKIT_KEY! });
    FeedbackKit.showFloatingTriggerButton();
    return () => FeedbackKit.destroy();
  }, []);
  useEffect(() => {
    FeedbackKit.currentScreen = pathname;
  }, [pathname]);
  return null;
}
```

#### Vue / Nuxt / SvelteKit
Configure inside a client-only plugin (`plugins/feedbackkit.client.ts` in Nuxt) or `onMount`.

### Step 3 -- Add a trigger

Pick what fits the existing UI:

- Floating button: `FeedbackKit.showFloatingTriggerButton()` (`{ position: "bottom-left", compact: true }` to tweak)
- Keyboard shortcut ⌘⇧F / Ctrl+Shift+F: `FeedbackKit.enableKeyboardShortcut()`
- An existing "Help"/"Report a problem" menu item or button: `onClick={() => FeedbackKit.presentAndSubmit()}`

### Step 4 -- Screen names

Set `FeedbackKit.currentScreen` from the router on every navigation (a readable title such as "Checkout" beats a raw path). Without it, reports fall back to `location.pathname`.

### Step 5 -- Optional

- Branding: `FeedbackKit.theme = { primaryColorHex: "#RRGGBB", secondaryColorHex: "#RRGGBB" }` using the app's brand color.
- Console/network log capture is on by default; pass `captureLogs: false` to `configure` if the app's policy forbids it.
- Remind the user to add the site's origin(s) under **Settings → Allowed web origins** in the dashboard, since the project key is visible in page source.

### Step 6 -- Close the loop: "is it fixed?" (recommended)

Call `FeedbackKit.enableFixVerification()` right after `configure`. Once a fix for something reported from this browser ships, a small card shows the reporter their original screenshot and asks "is it fixed?". "Still broken" reopens the capture dialog, and developer/agent questions show up there too. Each browser gets an anonymous reporter id, so no sign-in is needed.

```ts
FeedbackKit.configure({ projectKey: "pk_...", appBuild: import.meta.env.VITE_BUILD_ID }); // appBuild optional
FeedbackKit.enableFixVerification();
FeedbackKit.setUser(user ? { id: user.id, email: user.email } : null); // optional
```

- With a dotted-number `appBuild` (e.g. a timestamp), only fixes shipped in that build or earlier are shown. Any other build id (like a git SHA) counts as live once announced, which is right for a site that's replaced on every deploy.
- Deploys should announce themselves: run `npx feedbackkit-cli release --build <id>` after deploying, with `FEEDBACKKIT_RELEASE_TOKEN` set in CI. The `setup-release-loop` skill wires that up.

## Verification

1. Build the app (`npm run build`) — confirm no SSR errors about `window`/`document`.
2. Run it, open the dialog via the chosen trigger, draw on the screenshot, type a description and send.
3. With a project key configured, confirm the report appears in the dashboard with a **Web** badge.
