import { FeedbackKit, type FeedbackReport, type FeedbackTheme } from "feedbackkit-web";
import "./styles.css";

/** What a desktop shell plugs into the shared demo. */
export interface DemoHost {
  /** "Tauri" or "Electron" — shown in the UI. */
  runtimeName: string;
  /** Configures FeedbackKit through the shell's package (it adds the OS/app details). */
  applySettings(settings: { apiKey: string; endpointUrl: string }): Promise<void>;
  /** Shell-specific triggers to list in Settings (menu item, global shortcut, …). */
  triggerHints: string[];
}

export const DEFAULT_ENDPOINT = "https://gpucoladcyvijefdjudf.supabase.co/functions/v1/ingest-feedback";

/** The brand presets in Settings > Branding — the same as the other demos. */
const BRANDINGS: { id: string; name: string; theme: FeedbackTheme | null }[] = [
  { id: "system", name: "System Blue", theme: null },
  { id: "sunset", name: "Sunset", theme: { primaryColorHex: "#7C3AED", secondaryColorHex: "#F97316" } },
  { id: "ocean", name: "Ocean", theme: { primaryColorHex: "#0EA5E9", secondaryColorHex: "#14B8A6" } },
  { id: "forest", name: "Forest", theme: { primaryColorHex: "#16A34A", secondaryColorHex: "#CA8A04" } },
];

const CATALOG = [
  { name: "Wireless Headphones", price: 59.99, icon: "🎧", tint: "#8E44AD" },
  { name: "Canvas Tote Bag", price: 24.99, icon: "👜", tint: "#2E9E5B" },
  { name: "Classic T-Shirt", price: 19.99, icon: "👕", tint: "#F07A1A" },
];

interface CartItem {
  name: string;
  price: number;
  quantity: number;
  tint: string;
}

const STORAGE = {
  apiKey: "com.feedbackkit.demo.apiKey",
  endpoint: "com.feedbackkit.demo.endpointURL",
  branding: "com.feedbackkit.demo.branding",
};

function read(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked — settings just won't persist.
  }
}

const price = (value: number) => `$${value.toFixed(2)}`;

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  node.append(...children);
  return node;
}

/** Renders the demo into `root`. */
export function mountDemo(root: HTMLElement, host: DemoHost): void {
  // Shared cart state, so "Add" on Home shows up on Cart — like the native demos' CartStore.
  let cart: CartItem[] = [
    { name: "Wireless Headphones", price: 59.99, quantity: 1, tint: "#8E44AD" },
    { name: "Canvas Tote Bag", price: 24.99, quantity: 2, tint: "#2E9E5B" },
    { name: "Classic T-Shirt", price: 19.99, quantity: 1, tint: "#F07A1A" },
  ];
  let tab: "Home" | "Cart" | "Settings" = "Home";
  let apiKey = read(STORAGE.apiKey, "");
  let endpointUrl = read(STORAGE.endpoint, DEFAULT_ENDPOINT);
  let branding = read(STORAGE.branding, "sunset");

  const content = h("main", { class: "demo-content" });
  const tabBar = h("nav", { class: "demo-tabs" });
  root.replaceChildren(content, tabBar);

  const isConfigured = () => apiKey.trim() !== "";
  // The latest settings change, awaited before opening the flow so the
  // report carries the shell's OS/device details.
  let applied: Promise<void> = Promise.resolve();

  function apply(): Promise<void> {
    FeedbackKit.theme = BRANDINGS.find((b) => b.id === branding)?.theme ?? null;
    applied = host.applySettings({ apiKey: apiKey.trim(), endpointUrl: endpointUrl.trim() || DEFAULT_ENDPOINT });
    return applied;
  }

  function toast(message: string): void {
    const node = h("div", { class: "demo-toast", role: "status" }, message);
    document.body.append(node);
    setTimeout(() => node.remove(), 4000);
  }

  async function reportProblem(): Promise<void> {
    await applied.catch(() => {});
    if (isConfigured()) {
      await FeedbackKit.presentAndSubmit({
        onSubmitted: (report) => toast(`Feedback submitted (ID: ${report.id.slice(0, 8)}).`),
        onError: (error) => toast(`Submission failed: ${String(error)}. Check your API key in Settings.`),
      });
    } else {
      const report: FeedbackReport | null = await FeedbackKit.present();
      if (report) {
        console.log(`[FeedbackKit demo] captured report ${report.id} — "${report.text}"`, report);
        toast("Report captured locally (no project key set) — see the console.");
      }
    }
  }

  function render(): void {
    FeedbackKit.currentScreen = tab;
    content.replaceChildren(tab === "Home" ? home() : tab === "Cart" ? cartScreen() : settings());
    tabBar.replaceChildren(
      ...(["Home", "Cart", "Settings"] as const).map((name) => {
        const icon = name === "Home" ? "🏠" : name === "Cart" ? "🛒" : "⚙️";
        const badge = name === "Cart" && cart.length > 0 ? h("span", { class: "demo-badge" }, String(cart.length)) : "";
        const button = h("button", { class: `demo-tab${tab === name ? " is-active" : ""}`, type: "button" }, h("span", {}, icon), name, badge);
        button.addEventListener("click", () => {
          tab = name;
          render();
        });
        return button;
      }),
    );
  }

  function home(): HTMLElement {
    const report = h("button", { class: "demo-primary", type: "button", id: "report-problem" }, "Report a Problem");
    report.addEventListener("click", () => void reportProblem());
    return h(
      "section",
      { class: "demo-screen" },
      h("p", { class: "demo-eyebrow" }, `FeedbackKit ${host.runtimeName} Demo`),
      h("h1", {}, "Welcome back"),
      h(
        "p",
        { class: "demo-subtitle" },
        `Sample screen for exercising FeedbackKit in this ${host.runtimeName} app. Use the floating Feedback button, the Help menu or the keyboard shortcut to report an issue with whatever's on screen.`,
      ),
      ...CATALOG.map((product) => {
        const add = h("button", { class: "demo-add", type: "button", style: `color:${product.tint};border-color:${product.tint}` }, "+ Add");
        add.addEventListener("click", () => {
          const existing = cart.find((item) => item.name === product.name);
          cart = existing
            ? cart.map((item) => (item === existing ? { ...item, quantity: item.quantity + 1 } : item))
            : [...cart, { name: product.name, price: product.price, quantity: 1, tint: product.tint }];
          add.textContent = "✓ Added";
          add.disabled = true;
          setTimeout(() => render(), 1200);
        });
        return h(
          "div",
          { class: "demo-card" },
          h("div", { class: "demo-icon", style: `background:${product.tint}26` }, product.icon),
          h("div", { class: "demo-card-body" }, h("strong", {}, product.name), h("span", {}, price(product.price))),
          add,
        );
      }),
      report,
    );
  }

  function cartScreen(): HTMLElement {
    const report = h("button", { class: "demo-primary", type: "button" }, "Report a Problem");
    report.addEventListener("click", () => void reportProblem());
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const rows = cart.length
      ? cart.map((item, index) => {
          const remove = h("button", { class: "demo-remove", type: "button", "aria-label": `Remove ${item.name}` }, "🗑");
          remove.addEventListener("click", () => {
            cart = cart.filter((_, i) => i !== index);
            render();
          });
          return h(
            "div",
            { class: "demo-row" },
            h("div", { class: "demo-swatch", style: `background:${item.tint}` }),
            h("div", { class: "demo-card-body" }, h("strong", {}, item.name), h("span", {}, `Qty ${item.quantity} × ${price(item.price)}`)),
            remove,
          );
        })
      : [h("p", { class: "demo-empty" }, "Your cart is empty. Add something from Home to see it here.")];
    return h(
      "section",
      { class: "demo-screen" },
      h("h1", {}, "Cart"),
      h("div", { class: "demo-list" }, ...rows),
      h("p", { class: "demo-subtotal" }, `Subtotal: ${price(subtotal)}`),
      report,
    );
  }

  function settings(): HTMLElement {
    const key = h("input", { class: "demo-input", placeholder: "Project API Key (pk_…)", spellcheck: "false" });
    key.value = apiKey;
    key.addEventListener("change", () => {
      apiKey = key.value.trim();
      write(STORAGE.apiKey, apiKey);
      void apply().then(render);
    });
    const endpoint = h("input", { class: "demo-input", spellcheck: "false" });
    endpoint.value = endpointUrl;
    endpoint.addEventListener("change", () => {
      endpointUrl = endpoint.value.trim() || DEFAULT_ENDPOINT;
      write(STORAGE.endpoint, endpointUrl);
      void apply().then(render);
    });
    const test = h("button", { class: "demo-tonal", type: "button" }, "Test Feedback Flow");
    test.addEventListener("click", () => void reportProblem());

    const brands = BRANDINGS.map((option) => {
      const row = h(
        "button",
        { class: `demo-brand${branding === option.id ? " is-active" : ""}`, type: "button" },
        h("span", {}, branding === option.id ? "◉" : "○"),
        h("span", { class: "demo-grow" }, option.name),
        h("span", { class: "demo-dot", style: `background:${option.theme?.primaryColorHex ?? "#007AFF"}` }),
        h("span", { class: "demo-dot", style: `background:${option.theme?.secondaryColorHex ?? "#8E8E93"}` }),
      );
      row.addEventListener("click", () => {
        branding = option.id;
        write(STORAGE.branding, branding);
        void apply().then(render);
      });
      return row;
    });

    return h(
      "section",
      { class: "demo-screen" },
      h("h1", {}, "Settings"),
      section(
        "Web Portal Connection",
        "Paste your Project Key from the FeedbackKit dashboard (Project Settings → SDK setup). When configured, every report is submitted straight to your project.",
        h(
          "p",
          { class: "demo-status" },
          h("span", { class: "demo-dot", style: `background:${isConfigured() ? "#34C759" : "#FF9500"}` }),
          isConfigured() ? "Connected to Portal — Live Submission" : "Local Demo Mode — Unconfigured",
        ),
        key,
        test,
      ),
      section(
        "Custom Ingestion Endpoint",
        "Defaults to the hosted FeedbackKit endpoint. Only change this for a local or self-hosted backend.",
        endpoint,
      ),
      section("Branding", "FeedbackKit.theme customizes the feedback dialog's accent colors. Takes effect immediately.", ...brands),
      section(
        "Triggers wired up in this demo",
        null,
        ...["The floating Feedback button", ...host.triggerHints, "“Report a Problem” on Home and Cart"].map((text) => h("p", {}, `• ${text}`)),
      ),
    );
  }

  function section(title: string, footer: string | null, ...children: Node[]): HTMLElement {
    return h(
      "div",
      { class: "demo-section" },
      h("h2", {}, title.toUpperCase()),
      h("div", { class: "demo-group" }, ...children),
      ...(footer ? [h("p", { class: "demo-footer" }, footer)] : []),
    );
  }

  void apply();
  FeedbackKit.showFloatingTriggerButton();
  render();
}
