import type { FixUpdate } from "../types";
import { icons } from "./icons";

export type FixCardOutcome =
  | { type: "verified" }
  /** The widget then opens the capture flow in "still broken" mode. */
  | { type: "stillBroken" }
  | { type: "replied"; text: string }
  | { type: "later" };

/**
 * "We fixed something you reported — is it fixed?" A small non-modal card in
 * the page's bottom corner (above the trigger), inside the widget's Shadow
 * DOM. Web counterpart of Swift's `FixVerificationView`; same copy on purpose.
 */
export class FixCard {
  private root: HTMLElement | null = null;
  private settled = false;

  constructor(
    private readonly shadow: ShadowRoot,
    private readonly update: FixUpdate,
    private readonly onOutcome: (outcome: FixCardOutcome) => void,
  ) {}

  show(position: "bottom-right" | "bottom-left"): void {
    const u = this.update;
    const card = el("section", "fk-fixcard");
    card.dataset.position = position;
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-labelledby", "fk-fixcard-title");

    const header = el("div", "fk-fixcard-header");
    const title = el("h2", "fk-title");
    title.id = "fk-fixcard-title";
    title.textContent = u.needsVerification ? "We fixed something you reported" : "A question about your report";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "fk-close";
    close.innerHTML = icons.close;
    close.setAttribute("aria-label", "Remind me later");
    close.title = "Remind me later";
    close.addEventListener("click", () => this.settle({ type: "later" }));
    header.append(title, close);
    card.append(header);

    if (u.needsVerification && u.fixedInBuild) {
      card.append(text("p", "fk-meta", `Fixed in build ${u.fixedInBuild}.`));
    }

    if (u.screenshotUrl) {
      const img = document.createElement("img");
      img.className = "fk-fixcard-shot";
      img.alt = "Your screenshot from the original report";
      img.src = u.screenshotUrl;
      img.addEventListener("error", () => img.remove());
      card.append(img);
    }

    card.append(text("p", "fk-meta", "You reported"));
    card.append(text("p", "fk-fixcard-quote", u.text ? `“${u.text}”` : "(no description)"));
    if (u.needsVerification && u.fixSummary) {
      card.append(text("p", "fk-fixcard-summary", `What changed: ${u.fixSummary}`));
    }
    for (const m of u.messages.filter((m) => m.kind === "comment")) {
      const msg = el("div", "fk-fixcard-message");
      msg.append(text("span", "fk-meta", m.author), text("p", "", m.body));
      card.append(msg);
    }

    const actions = el("div", "fk-fixcard-actions");
    if (u.needsVerification) {
      const yes = button("fk-btn fk-btn-primary", "Yes, it's fixed");
      yes.addEventListener("click", () => this.settle({ type: "verified" }));
      const no = button("fk-btn fk-btn-secondary", "No, still broken");
      no.addEventListener("click", () => this.settle({ type: "stillBroken" }));
      actions.append(yes, no);
    } else if (u.openQuestion) {
      actions.append(text("p", "fk-fixcard-question", u.openQuestion.body));
      const input = document.createElement("textarea");
      input.className = "fk-textarea";
      input.placeholder = "Your answer";
      input.setAttribute("aria-label", "Your answer");
      const send = button("fk-btn fk-btn-primary", "Send");
      send.disabled = true;
      input.addEventListener("input", () => (send.disabled = input.value.trim() === ""));
      send.addEventListener("click", () => this.settle({ type: "replied", text: input.value.trim() }));
      actions.append(input, send);
    }
    card.append(actions);

    this.root = card;
    this.shadow.append(card);
  }

  /** Close as "later" (e.g. `FeedbackKit.disableFixVerification()`). */
  dismiss(): void {
    this.settle({ type: "later" });
  }

  /** Remove without reporting an outcome (the widget is being destroyed). */
  remove(): void {
    this.settled = true;
    this.root?.remove();
    this.root = null;
  }

  private settle(outcome: FixCardOutcome): void {
    if (this.settled) return;
    this.settled = true;
    this.root?.remove();
    this.root = null;
    this.onOutcome(outcome);
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function text<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, content: string): HTMLElementTagNameMap[K] {
  const node = el(tag, className);
  node.textContent = content;
  return node;
}

function button(className: string, label: string): HTMLButtonElement {
  const b = el("button", className);
  b.type = "button";
  b.textContent = label;
  return b;
}
