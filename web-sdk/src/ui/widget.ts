import { canvasToPngBlob, captureViewport, type CapturedScreenshot } from "../capture";
import { collectEnvironment } from "../environment";
import { submitReport } from "../submit";
import type {
  CaptureOptions,
  FeedbackAttachment,
  FeedbackEnvironment,
  FeedbackKitConfiguration,
  FeedbackLogEntry,
  FeedbackProduct,
  FeedbackReport,
  FeedbackTheme,
} from "../types";
import { AnnotationEditor, COLORS, type Tool } from "./editor";
import { icons } from "./icons";
import { styles } from "./styles";

export interface WidgetDeps {
  configuration(): FeedbackKitConfiguration | null;
  theme(): FeedbackTheme | null;
  products(): Promise<FeedbackProduct[]>;
  defaultProductKey(): string | undefined;
  logs(): FeedbackLogEntry[];
  captureOptions(): CaptureOptions;
  currentScreen(): string | null;
}

export interface OpenOptions {
  /** POST the report to the configured endpoint before resolving. */
  submit: boolean;
  /** Called with the finished report (after a successful submit, when `submit` is true). */
  onReport?: (report: FeedbackReport) => void | Promise<void>;
  /** Called if submitting fails. The dialog stays open so the user can retry. */
  onError?: (error: unknown) => void;
}

export interface TriggerOptions {
  position?: "bottom-right" | "bottom-left";
  /** Button text. Default "Feedback". */
  label?: string;
  /** Icon-only round button. */
  compact?: boolean;
}

/** Max attachment size accepted by the composer (base64 in a JSON body grows it by a third). */
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const TOOLS: { tool: Tool; label: string; icon: string }[] = [
  { tool: "pen", label: "Draw", icon: icons.pen },
  { tool: "rectangle", label: "Rectangle", icon: icons.rectangle },
  { tool: "arrow", label: "Arrow", icon: icons.arrow },
  { tool: "text", label: "Text", icon: icons.text },
  { tool: "move", label: "Move / resize", icon: icons.move },
];

const HINTS: Record<Tool, string> = {
  pen: "Draw on the screenshot to highlight the problem",
  rectangle: "Drag to box an area",
  arrow: "Drag to point at something",
  text: "Click to add a note",
  move: "Drag to move · scroll to resize · Shift+scroll to rotate · Delete to remove",
};

/**
 * Owns the widget's Shadow DOM host: the floating trigger button and the
 * capture → annotate → describe → send dialog. One per page.
 */
export class Widget {
  private host: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private trigger: HTMLButtonElement | null = null;
  private pending: Promise<FeedbackReport | null> | null = null;

  constructor(private readonly deps: WidgetDeps) {}

  /** True for the widget's own host element — used to keep it out of screenshots. */
  isOwnNode = (node: Node): boolean => node === this.host;

  get isOpen(): boolean {
    return this.pending !== null;
  }

  showTrigger(options: TriggerOptions, onClick: () => void): void {
    const shadow = this.mount();
    this.trigger?.remove();
    const button = document.createElement("button");
    button.type = "button";
    button.className = "fk-trigger";
    button.dataset.position = options.position ?? "bottom-right";
    button.dataset.compact = String(!!options.compact);
    const label = options.label ?? "Feedback";
    button.setAttribute("aria-label", label);
    button.innerHTML = `${icons.feedback}<span class="fk-trigger-label"></span>`;
    (button.querySelector(".fk-trigger-label") as HTMLElement).textContent = label;
    button.addEventListener("click", onClick);
    shadow.append(button);
    this.trigger = button;
    this.applyTheme();
  }

  hideTrigger(): void {
    this.trigger?.remove();
    this.trigger = null;
  }

  destroy(): void {
    this.hideTrigger();
    this.host?.remove();
    this.host = null;
    this.shadow = null;
  }

  open(options: OpenOptions): Promise<FeedbackReport | null> {
    if (this.pending) return this.pending;
    this.pending = this.run(options).finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  private mount(): ShadowRoot {
    if (this.shadow && this.host?.isConnected) return this.shadow;
    const host = document.createElement("div");
    host.setAttribute("data-feedbackkit-root", "");
    // The host itself takes no space; everything inside is position: fixed.
    host.style.cssText = "position:static!important;display:contents!important;";
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = styles;
    shadow.append(style);
    document.body.append(host);
    this.host = host;
    this.shadow = shadow;
    this.applyTheme();
    return shadow;
  }

  private applyTheme(): void {
    const theme = this.deps.theme();
    const host = this.host;
    if (!host) return;
    const primary = validHex(theme?.primaryColorHex);
    const secondary = validHex(theme?.secondaryColorHex);
    if (primary) host.style.setProperty("--fk-primary", primary);
    else host.style.removeProperty("--fk-primary");
    if (secondary) host.style.setProperty("--fk-secondary", secondary);
    else host.style.removeProperty("--fk-secondary");
  }

  private async run(options: OpenOptions): Promise<FeedbackReport | null> {
    const shadow = this.mount();
    this.applyTheme();
    this.trigger?.setAttribute("aria-busy", "true");

    // Everything describing "the moment of the problem" is taken *before*
    // the dialog covers the page.
    const captureOptions = this.deps.captureOptions();
    const [shot, environment] = await Promise.all([
      captureViewport({ ...captureOptions, exclude: this.isOwnNode }).catch((error: unknown) => {
        console.warn("[FeedbackKit] Screenshot capture failed; continuing without one.", error);
        return null;
      }),
      collectEnvironment({
        screenName: this.deps.currentScreen(),
        appVersion: this.deps.configuration()?.appVersion,
        appBuild: this.deps.configuration()?.appBuild,
      }),
    ]);
    const logs = this.deps.logs();
    this.trigger?.removeAttribute("aria-busy");

    return new Promise<FeedbackReport | null>((resolve) => {
      const dialog = new Dialog(shadow, shot, environment, logs, this.deps, options, (result) => {
        resolve(result);
      });
      dialog.show();
    });
  }
}

/** One open feedback dialog. Resolves exactly once via `done`. */
class Dialog {
  private overlay!: HTMLDivElement;
  private editor: AnnotationEditor | null = null;
  private textarea!: HTMLTextAreaElement;
  private sendButton!: HTMLButtonElement;
  private errorBox!: HTMLParagraphElement;
  private stage!: HTMLDivElement;
  private includeScreenshot: boolean;
  private includeLogs = true;
  private attachment: FeedbackAttachment | null = null;
  private selectedProducts = new Set<string>();
  private products: FeedbackProduct[] = [];
  private sending = false;
  private finished = false;
  private resizeObserver: ResizeObserver | null = null;
  private previousFocus: Element | null = null;
  private previousOverflow = "";
  private toolButtons = new Map<Tool, HTMLButtonElement>();
  private swatches: HTMLButtonElement[] = [];
  private undoButton!: HTMLButtonElement;
  private clearButton!: HTMLButtonElement;
  private hint!: HTMLSpanElement;
  private readonly onKeyDown = (e: KeyboardEvent) => this.handleKey(e);

  constructor(
    private readonly shadow: ShadowRoot,
    private readonly shot: CapturedScreenshot | null,
    private readonly environment: FeedbackEnvironment,
    private readonly logs: FeedbackLogEntry[],
    private readonly deps: WidgetDeps,
    private readonly options: OpenOptions,
    private readonly done: (report: FeedbackReport | null) => void,
  ) {
    this.includeScreenshot = shot !== null;
  }

  show(): void {
    this.previousFocus = document.activeElement;
    this.previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    const overlay = el("div", "fk-overlay");
    const dialog = el("div", "fk-dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "fk-title");
    dialog.append(this.buildStage(), this.buildComposer());
    overlay.append(dialog);
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) this.cancel();
    });
    this.overlay = overlay;
    this.shadow.append(overlay);
    // One capture-phase listener on the document sees keys from inside the
    // shadow root too (they're retargeted, not stopped), so the dialog
    // behaves modally without double-handling.
    document.addEventListener("keydown", this.onKeyDown, true);

    this.layoutEditor();
    requestAnimationFrame(() => this.textarea.focus());
    void this.loadProducts();
  }

  // ---------------------------------------------------------------- stage

  private buildStage(): HTMLElement {
    const stage = el("div", "fk-stage");
    this.stage = stage;
    stage.dataset.screenshot = this.includeScreenshot ? "on" : "off";

    const toolbar = el("div", "fk-toolbar");
    toolbar.setAttribute("role", "toolbar");
    toolbar.setAttribute("aria-label", "Annotation tools");
    for (const { tool, label, icon } of TOOLS) {
      const b = iconButton("fk-tool", icon, label);
      b.setAttribute("aria-pressed", String(tool === "pen"));
      b.addEventListener("click", () => this.selectTool(tool));
      this.toolButtons.set(tool, b);
      toolbar.append(b);
    }
    toolbar.append(el("span", "fk-toolbar-sep"));
    COLORS.forEach((color, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "fk-swatch";
      b.style.background = color;
      b.setAttribute("aria-label", `Color ${["red", "yellow", "green", "blue", "black"][i]}`);
      b.setAttribute("aria-pressed", String(i === 0));
      b.addEventListener("click", () => {
        if (this.editor) this.editor.color = color;
        this.swatches.forEach((s) => s.setAttribute("aria-pressed", String(s === b)));
      });
      this.swatches.push(b);
      toolbar.append(b);
    });
    toolbar.append(el("span", "fk-toolbar-sep"));
    this.undoButton = iconButton("fk-tool", icons.undo, "Undo");
    this.undoButton.addEventListener("click", () => this.editor?.undo());
    this.clearButton = iconButton("fk-tool", icons.trash, "Clear all annotations");
    this.clearButton.addEventListener("click", () => this.editor?.clear());
    toolbar.append(this.undoButton, this.clearButton);
    this.hint = el("span", "fk-hint");
    this.hint.textContent = HINTS.pen;
    toolbar.append(this.hint);

    const wrap = el("div", "fk-canvas-wrap");
    if (this.shot) {
      const editor = new AnnotationEditor(this.shot);
      editor.onChange = () => this.refreshState();
      editor.setTool("pen");
      this.editor = editor;
      wrap.append(editor.element);
      this.resizeObserver = new ResizeObserver(() => this.layoutEditor());
      this.resizeObserver.observe(wrap);
    }
    const note = el("div", "fk-off-note");
    note.textContent = this.shot ? "Screenshot won't be included" : "Screenshot unavailable on this page";
    wrap.append(note);
    stage.append(toolbar, wrap);
    return stage;
  }

  private layoutEditor(): void {
    if (!this.editor) return;
    const wrap = this.editor.element.parentElement;
    if (!wrap) return;
    const styles = getComputedStyle(wrap);
    const padX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
    const padY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
    this.editor.layout(Math.max(40, wrap.clientWidth - padX), Math.max(40, wrap.clientHeight - padY));
  }

  private selectTool(tool: Tool): void {
    this.editor?.setTool(tool);
    this.toolButtons.forEach((b, t) => b.setAttribute("aria-pressed", String(t === tool)));
    this.hint.textContent = HINTS[tool];
  }

  // ---------------------------------------------------------------- composer

  private buildComposer(): HTMLElement {
    const composer = el("div", "fk-composer");

    const header = el("div", "fk-header");
    const title = el("h2", "fk-title");
    title.id = "fk-title";
    title.textContent = "Send feedback";
    const close = iconButton("fk-close", icons.close, "Close");
    close.addEventListener("click", () => this.cancel());
    header.append(title, close);

    const textLabel = el("label", "fk-label");
    textLabel.textContent = "What's the problem?";
    textLabel.setAttribute("for", "fk-text");
    this.textarea = document.createElement("textarea");
    this.textarea.id = "fk-text";
    this.textarea.className = "fk-textarea";
    this.textarea.placeholder = "Describe what happened and what you expected instead…";
    this.textarea.addEventListener("input", () => this.refreshState());
    const textGroup = el("div");
    textGroup.append(textLabel, this.textarea);

    const productsGroup = el("div");
    productsGroup.dataset.role = "products";
    productsGroup.hidden = true;

    // Screenshot toggle + attach
    const optionsRow = el("div", "fk-row");
    const toggle = switchControl("Screenshot", this.includeScreenshot, (on) => {
      this.includeScreenshot = on;
      this.stage.dataset.screenshot = on ? "on" : "off";
      this.refreshState();
    });
    if (!this.shot) toggle.querySelector("input")!.disabled = true;
    const attachGroup = el("div");
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.hidden = true;
    const attachButton = document.createElement("button");
    attachButton.type = "button";
    attachButton.className = "fk-attach";
    attachButton.innerHTML = `${icons.paperclip}<span>Attach file</span>`;
    attachButton.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      fileInput.value = "";
      if (!file) return;
      if (file.size > MAX_ATTACHMENT_BYTES) {
        this.showError(`"${file.name}" is larger than 10 MB.`);
        return;
      }
      this.attachment = { filename: file.name, mimeType: file.type || "application/octet-stream", data: file };
      renderAttachment();
    });
    const renderAttachment = () => {
      attachGroup.replaceChildren(fileInput);
      if (this.attachment) {
        const chip = el("span", "fk-file");
        const name = el("span");
        name.textContent = this.attachment.filename;
        const remove = iconButton("", icons.close, `Remove ${this.attachment.filename}`);
        remove.addEventListener("click", () => {
          this.attachment = null;
          renderAttachment();
        });
        chip.append(name, remove);
        attachGroup.append(chip);
      } else {
        attachGroup.append(attachButton);
      }
    };
    renderAttachment();
    optionsRow.append(attachGroup, toggle);

    const meta = this.buildDiagnostics();

    this.errorBox = el("p", "fk-error");
    this.errorBox.setAttribute("role", "alert");
    this.errorBox.hidden = true;

    const actions = el("div", "fk-actions");
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "fk-btn fk-btn-secondary";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => this.cancel());
    this.sendButton = document.createElement("button");
    this.sendButton.type = "button";
    this.sendButton.className = "fk-btn fk-btn-primary";
    this.sendButton.innerHTML = `${icons.send}<span>Send</span>`;
    this.sendButton.title = "Send (⌘/Ctrl + Enter)";
    this.sendButton.addEventListener("click", () => void this.send());
    actions.append(cancel, this.sendButton);

    composer.append(header, textGroup, productsGroup, optionsRow);
    if (meta) composer.append(meta);
    composer.append(el("div", "fk-spacer"), this.errorBox, actions);
    this.refreshState();
    return composer;
  }

  /** Shows the user exactly what page context will be sent, with an opt-out for logs. */
  private buildDiagnostics(): HTMLElement | null {
    const box = el("div", "fk-meta");
    const env = this.environment;
    const summary = `${env.deviceModel} · ${env.osName} ${env.osVersion}`.trim();
    const details = document.createElement("details");
    const s = document.createElement("summary");
    s.textContent = `Included: page URL, ${summary}${this.logs.length ? `, ${this.logs.length} log entr${this.logs.length === 1 ? "y" : "ies"}` : ""}`;
    const pre = document.createElement("pre");
    const lines = [`URL: ${env.pageUrl ?? ""}`, `Viewport: ${env.screenWidthPoints}×${env.screenHeightPoints} @${env.screenScale}x`];
    if (this.logs.length) {
      lines.push("", ...this.logs.map((l) => `[${l.level}] ${l.message}`));
    }
    pre.textContent = lines.join("\n");
    details.append(s, pre);
    box.append(details);
    if (this.logs.length) {
      const logsToggle = switchControl("Include console & network logs", true, (on) => {
        this.includeLogs = on;
      });
      logsToggle.style.marginTop = "8px";
      box.append(logsToggle);
    }
    return box;
  }

  private async loadProducts(): Promise<void> {
    let products: FeedbackProduct[] = [];
    try {
      products = await this.deps.products();
    } catch {
      return; // Products are optional; the composer works without them.
    }
    if (this.finished || products.length === 0) return;
    this.products = products;
    const preferred = this.deps.defaultProductKey();
    const initial =
      (preferred && products.find((p) => p.key === preferred)) || products.find((p) => p.isDefault) || null;
    if (initial) this.selectedProducts.add(initial.key);

    const group = this.overlay.querySelector('[data-role="products"]') as HTMLElement | null;
    if (!group) return;
    const label = el("span", "fk-label");
    label.textContent = "Affected product";
    const chips = el("div", "fk-chips");
    chips.setAttribute("role", "group");
    chips.setAttribute("aria-label", "Affected products");
    for (const product of products) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "fk-chip";
      chip.textContent = product.name || product.key;
      if (product.description) chip.title = product.description;
      chip.setAttribute("aria-pressed", String(this.selectedProducts.has(product.key)));
      chip.addEventListener("click", () => {
        if (this.selectedProducts.has(product.key)) this.selectedProducts.delete(product.key);
        else this.selectedProducts.add(product.key);
        chip.setAttribute("aria-pressed", String(this.selectedProducts.has(product.key)));
      });
      chips.append(chip);
    }
    group.replaceChildren(label, chips);
    group.hidden = false;
  }

  private refreshState(): void {
    const hasText = this.textarea?.value.trim().length > 0;
    const hasMarks = this.includeScreenshot && (this.editor?.annotations.length ?? 0) > 0;
    if (this.sendButton) this.sendButton.disabled = this.sending || (!hasText && !hasMarks);
    if (this.undoButton) this.undoButton.disabled = !this.editor?.canUndo;
    if (this.clearButton) this.clearButton.disabled = !(this.editor && this.editor.annotations.length > 0);
  }

  // ---------------------------------------------------------------- keyboard

  private handleKey(e: KeyboardEvent): void {
    if (this.finished) return;
    const mod = e.metaKey || e.ctrlKey;
    const active = this.shadow.activeElement;
    const typing = active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement;
    // The on-canvas note input handles its own Enter/Escape (commit/cancel the note).
    if (active instanceof HTMLInputElement && active.classList.contains("fk-text-input")) return;

    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      this.cancel();
    } else if (mod && e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      void this.send();
    } else if (mod && !e.shiftKey && e.key.toLowerCase() === "z" && !typing) {
      e.preventDefault();
      e.stopPropagation();
      this.editor?.undo();
    } else if ((e.key === "Backspace" || e.key === "Delete") && !typing) {
      if (this.editor?.deleteSelected()) {
        e.preventDefault();
        e.stopPropagation();
      }
    } else if (e.key === "Tab") {
      this.trapFocus(e);
    }
  }

  private trapFocus(e: KeyboardEvent): void {
    const focusable = [
      ...this.overlay.querySelectorAll<HTMLElement>("button:not(:disabled), textarea, input:not([type=file]):not(:disabled), summary"),
    ].filter((n) => n.offsetParent !== null || n.tagName === "INPUT");
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = this.shadow.activeElement;
    if (e.shiftKey && (active === first || !active)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  // ---------------------------------------------------------------- results

  private showError(message: string | null): void {
    this.errorBox.hidden = !message;
    this.errorBox.textContent = message ?? "";
  }

  private async buildReport(): Promise<FeedbackReport> {
    let screenshotRaw: Blob | null = null;
    let screenshotAnnotated: Blob | null = null;
    let annotations: FeedbackReport["annotations"] = [];
    if (this.includeScreenshot && this.shot && this.editor) {
      const flattened = this.editor.flatten();
      [screenshotRaw, screenshotAnnotated] = await Promise.all([
        canvasToPngBlob(this.shot.canvas),
        canvasToPngBlob(flattened),
      ]);
      annotations = this.editor.annotations.map((a) => ({ ...a }));
    }
    return {
      id: uuid(),
      createdAt: new Date(),
      text: this.textarea.value.trim(),
      screenshotRaw,
      screenshotAnnotated,
      annotations,
      environment: this.environment,
      attachment: this.attachment,
      products: this.products.filter((p) => this.selectedProducts.has(p.key)),
      logs: this.includeLogs ? this.logs : [],
    };
  }

  private async send(): Promise<void> {
    if (this.sending || this.sendButton.disabled) return;
    this.sending = true;
    this.showError(null);
    this.refreshState();
    this.sendButton.innerHTML = `<span class="fk-spinner" aria-hidden="true"></span><span>Sending…</span>`;
    try {
      const report = await this.buildReport();
      if (this.options.submit) {
        const configuration = this.deps.configuration();
        if (!configuration) throw new Error("FeedbackKit.configure() hasn't been called.");
        await submitReport(report, configuration);
      }
      await this.options.onReport?.(report);
      this.showThanks();
      setTimeout(() => this.finish(report), this.options.submit ? 1300 : 0);
    } catch (error) {
      this.sending = false;
      this.sendButton.innerHTML = `${icons.send}<span>Retry</span>`;
      this.showError(error instanceof Error ? error.message : "Something went wrong sending your feedback.");
      this.refreshState();
      this.options.onError?.(error);
    }
  }

  private showThanks(): void {
    if (!this.options.submit) return;
    const composer = this.overlay.querySelector(".fk-composer");
    if (!composer) return;
    const done = el("div", "fk-done");
    done.setAttribute("role", "status");
    const icon = el("span", "fk-done-icon");
    icon.innerHTML = icons.check;
    const title = el("h2", "fk-title");
    title.textContent = "Thanks for the feedback!";
    const sub = el("p", "fk-meta");
    sub.textContent = "It's on its way to the team.";
    done.append(icon, title, sub);
    composer.replaceChildren(done);
  }

  private cancel(): void {
    if (this.sending) return;
    this.finish(null);
  }

  private finish(result: FeedbackReport | null): void {
    if (this.finished) return;
    this.finished = true;
    this.resizeObserver?.disconnect();
    document.removeEventListener("keydown", this.onKeyDown, true);
    this.overlay.remove();
    document.documentElement.style.overflow = this.previousOverflow;
    if (this.previousFocus instanceof HTMLElement) this.previousFocus.focus({ preventScroll: true });
    this.done(result);
  }
}

// ------------------------------------------------------------------ helpers

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function iconButton(className: string, icon: string, label: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  if (className) b.className = className;
  b.innerHTML = icon;
  b.setAttribute("aria-label", label);
  b.title = label;
  return b;
}

function switchControl(label: string, checked: boolean, onChange: (on: boolean) => void): HTMLLabelElement {
  const wrap = el("label", "fk-switch");
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  input.setAttribute("role", "switch");
  input.addEventListener("change", () => onChange(input.checked));
  const track = el("span", "fk-switch-track");
  const text = el("span");
  text.textContent = label;
  wrap.append(input, track, text);
  return wrap;
}

function validHex(hex: string | undefined): string | null {
  if (!hex) return null;
  const cleaned = hex.trim().replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(cleaned) ? `#${cleaned}` : null;
}

export function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
