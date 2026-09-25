/**
 * Widget CSS, scoped inside the host's Shadow DOM so neither the page's
 * styles nor ours leak across. `:host { all: initial }` also blocks inherited
 * properties (font, color, line-height) from the page.
 */
export const styles = /* css */ `
:host {
  all: initial;
  --fk-primary: #007aff;
  --fk-secondary: #6b7280;
  --fk-bg: #ffffff;
  --fk-surface: #f5f5f7;
  --fk-border: rgba(0, 0, 0, 0.1);
  --fk-text: #111114;
  --fk-muted: #6b6b73;
  --fk-danger: #d92d20;
  --fk-backdrop: rgba(10, 10, 14, 0.55);
  --fk-shadow: 0 24px 64px rgba(0, 0, 0, 0.28), 0 2px 8px rgba(0, 0, 0, 0.12);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  font-size: 14px;
  line-height: 1.4;
  color: var(--fk-text);
}
@media (prefers-color-scheme: dark) {
  :host(:not([data-color-scheme="light"])) {
    --fk-bg: #1c1c1f;
    --fk-surface: #26262a;
    --fk-border: rgba(255, 255, 255, 0.12);
    --fk-text: #f2f2f5;
    --fk-muted: #a0a0a8;
    --fk-backdrop: rgba(0, 0, 0, 0.65);
  }
}
:host([data-color-scheme="dark"]) {
  --fk-bg: #1c1c1f;
  --fk-surface: #26262a;
  --fk-border: rgba(255, 255, 255, 0.12);
  --fk-text: #f2f2f5;
  --fk-muted: #a0a0a8;
  --fk-backdrop: rgba(0, 0, 0, 0.65);
}
*, *::before, *::after { box-sizing: border-box; }
button { font: inherit; color: inherit; cursor: pointer; }
button:disabled { cursor: not-allowed; opacity: 0.45; }
:focus-visible { outline: 2px solid var(--fk-primary); outline-offset: 2px; }

/* ---------- floating trigger ---------- */
.fk-trigger {
  position: fixed;
  z-index: 2147483000;
  bottom: 20px;
  right: 20px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 16px 0 14px;
  border: 0;
  border-radius: 22px;
  background: var(--fk-primary);
  color: #fff;
  font-weight: 600;
  font-size: 14px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.22);
  transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
}
.fk-trigger[data-position="bottom-left"] { right: auto; left: 20px; }
.fk-trigger:hover { transform: translateY(-1px); box-shadow: 0 10px 26px rgba(0, 0, 0, 0.26); }
.fk-trigger[data-compact="true"] { width: 48px; height: 48px; padding: 0; justify-content: center; border-radius: 24px; }
.fk-trigger[data-compact="true"] .fk-trigger-label { display: none; }
.fk-trigger[aria-busy="true"] { opacity: 0.6; pointer-events: none; }

/* ---------- overlay ---------- */
.fk-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483001;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--fk-backdrop);
  animation: fk-fade 0.16s ease-out;
}
@keyframes fk-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes fk-rise { from { opacity: 0; transform: translateY(8px) scale(0.99); } to { opacity: 1; transform: none; } }
.fk-dialog {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  width: min(1180px, 100%);
  height: min(780px, 100%);
  overflow: hidden;
  border-radius: 16px;
  background: var(--fk-bg);
  box-shadow: var(--fk-shadow);
  animation: fk-rise 0.2s ease-out;
}
.fk-stage {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: var(--fk-surface);
  border-right: 1px solid var(--fk-border);
}
.fk-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  padding: 10px 12px;
  border-bottom: 1px solid var(--fk-border);
}
.fk-toolbar-sep { width: 1px; height: 22px; margin: 0 6px; background: var(--fk-border); }
.fk-tool {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--fk-muted);
}
.fk-tool:hover:not(:disabled) { background: var(--fk-border); color: var(--fk-text); }
.fk-tool[aria-pressed="true"] { background: var(--fk-primary); color: #fff; }
.fk-swatch {
  width: 22px;
  height: 22px;
  margin: 0 2px;
  padding: 0;
  border-radius: 11px;
  border: 2px solid var(--fk-bg);
  box-shadow: 0 0 0 1px var(--fk-border);
}
.fk-swatch[aria-pressed="true"] { box-shadow: 0 0 0 2px var(--fk-text); }
.fk-hint { margin-left: auto; font-size: 12px; color: var(--fk-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fk-canvas-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  overflow: hidden;
}
.fk-canvas-box { position: relative; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.18); border-radius: 6px; overflow: hidden; }
.fk-canvas-box canvas { display: block; }
.fk-canvas-box .fk-ink { position: absolute; inset: 0; touch-action: none; }
.fk-stage[data-screenshot="off"] .fk-canvas-box { opacity: 0.25; filter: grayscale(1); }
.fk-stage[data-screenshot="off"] .fk-toolbar button { pointer-events: none; opacity: 0.35; }
.fk-off-note {
  position: absolute;
  inset: 0;
  display: none;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: var(--fk-muted);
  pointer-events: none;
}
.fk-stage[data-screenshot="off"] .fk-off-note { display: flex; }
.fk-text-input {
  position: absolute;
  z-index: 2;
  min-width: 120px;
  padding: 6px 8px;
  border: 2px solid var(--fk-primary);
  border-radius: 8px;
  background: var(--fk-bg);
  color: var(--fk-text);
  font: bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  outline: none;
}

/* ---------- composer ---------- */
.fk-composer { display: flex; flex-direction: column; min-height: 0; padding: 18px; gap: 14px; overflow-y: auto; }
.fk-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.fk-title { margin: 0; font-size: 17px; font-weight: 650; letter-spacing: -0.01em; }
.fk-close { display: inline-flex; width: 30px; height: 30px; align-items: center; justify-content: center; border: 0; border-radius: 15px; background: var(--fk-surface); color: var(--fk-muted); }
.fk-close:hover { color: var(--fk-text); }
.fk-label { display: block; margin-bottom: 6px; font-size: 12px; font-weight: 600; color: var(--fk-muted); text-transform: uppercase; letter-spacing: 0.04em; }
.fk-textarea {
  width: 100%;
  min-height: 140px;
  resize: vertical;
  padding: 10px 12px;
  border: 1px solid var(--fk-border);
  border-radius: 10px;
  background: var(--fk-bg);
  color: var(--fk-text);
  font: inherit;
  line-height: 1.45;
}
.fk-textarea:focus { outline: none; border-color: var(--fk-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--fk-primary) 22%, transparent); }
.fk-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.fk-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 11px;
  border: 1px solid var(--fk-border);
  border-radius: 14px;
  background: var(--fk-bg);
  font-size: 13px;
}
.fk-chip[aria-pressed="true"] { border-color: var(--fk-primary); background: color-mix(in srgb, var(--fk-primary) 12%, transparent); color: var(--fk-primary); font-weight: 600; }
.fk-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.fk-switch { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; user-select: none; }
.fk-switch input { position: absolute; opacity: 0; width: 0; height: 0; }
.fk-switch-track { position: relative; width: 36px; height: 22px; border-radius: 11px; background: var(--fk-border); transition: background 0.15s; }
.fk-switch-track::after { content: ""; position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 9px; background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3); transition: transform 0.15s; }
.fk-switch input:checked + .fk-switch-track { background: var(--fk-primary); }
.fk-switch input:checked + .fk-switch-track::after { transform: translateX(14px); }
.fk-switch input:focus-visible + .fk-switch-track { outline: 2px solid var(--fk-primary); outline-offset: 2px; }
.fk-attach {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border: 1px dashed var(--fk-secondary);
  border-radius: 8px;
  background: transparent;
  color: var(--fk-secondary);
  font-size: 13px;
}
.fk-file { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; padding: 4px 6px 4px 10px; border-radius: 8px; background: var(--fk-surface); font-size: 12px; }
.fk-file span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fk-file button { display: inline-flex; border: 0; background: transparent; color: var(--fk-muted); padding: 2px; }
.fk-meta { font-size: 12px; color: var(--fk-muted); }
.fk-meta details summary { cursor: pointer; }
.fk-meta pre { max-height: 140px; overflow: auto; margin: 6px 0 0; padding: 8px; border-radius: 8px; background: var(--fk-surface); font-size: 11px; white-space: pre-wrap; word-break: break-word; }
.fk-spacer { flex: 1; }
.fk-actions { display: flex; gap: 8px; }
.fk-btn {
  display: inline-flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 40px;
  border-radius: 10px;
  font-weight: 600;
}
.fk-btn-secondary { border: 1px solid var(--fk-border); background: transparent; color: var(--fk-secondary); }
.fk-btn-primary { border: 0; background: var(--fk-primary); color: #fff; }
.fk-btn-primary:hover:not(:disabled) { filter: brightness(1.06); }
.fk-error { margin: 0; padding: 8px 10px; border-radius: 8px; background: color-mix(in srgb, var(--fk-danger) 12%, transparent); color: var(--fk-danger); font-size: 13px; }
.fk-spinner { width: 16px; height: 16px; border: 2px solid rgba(255, 255, 255, 0.45); border-top-color: #fff; border-radius: 50%; animation: fk-spin 0.7s linear infinite; }
@keyframes fk-spin { to { transform: rotate(360deg); } }
.fk-done { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; flex: 1; text-align: center; }
.fk-done-icon { display: inline-flex; width: 48px; height: 48px; align-items: center; justify-content: center; border-radius: 24px; background: var(--fk-primary); color: #fff; }
.fk-done-icon svg { width: 26px; height: 26px; }
.fk-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

/* ---------- "is it fixed?" card (fixCard.ts) ---------- */
.fk-fixcard {
  position: fixed;
  z-index: 2147483000;
  right: 20px;
  bottom: 76px;
  width: min(360px, calc(100vw - 32px));
  max-height: min(640px, calc(100vh - 96px));
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  border: 1px solid var(--fk-border);
  border-radius: 16px;
  background: var(--fk-bg);
  box-shadow: var(--fk-shadow);
  animation: fk-rise 0.2s ease-out;
}
.fk-fixcard[data-position="bottom-left"] { right: auto; left: 20px; }
.fk-fixcard > *, .fk-fixcard-actions > * { flex-shrink: 0; }
.fk-fixcard p { margin: 0; }
.fk-fixcard-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.fk-fixcard-shot { display: block; width: 100%; max-height: 220px; object-fit: contain; border-radius: 10px; background: var(--fk-surface); }
.fk-fixcard-quote { font-size: 14px; }
.fk-fixcard-summary { font-size: 13px; padding: 8px 10px; border-radius: 8px; background: var(--fk-surface); }
.fk-fixcard-message p { font-size: 13px; }
.fk-fixcard-question { font-weight: 600; }
.fk-fixcard-actions { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
.fk-fixcard-actions .fk-btn { flex: none; width: 100%; }
.fk-fixcard-actions .fk-textarea { min-height: 64px; }
@keyframes fk-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

/* ---------- narrow screens: stack stage over composer ---------- */
@media (max-width: 760px) {
  .fk-overlay { padding: 0; }
  .fk-dialog { grid-template-columns: 1fr; grid-template-rows: minmax(0, 1fr) auto; width: 100%; height: 100%; border-radius: 0; }
  .fk-stage { border-right: 0; border-bottom: 1px solid var(--fk-border); }
  .fk-hint { display: none; }
  .fk-canvas-wrap { padding: 10px; }
  .fk-composer { max-height: 55vh; padding: 14px; gap: 10px; }
  .fk-textarea { min-height: 84px; }
  .fk-fixcard, .fk-fixcard[data-position] { right: 16px; left: 16px; width: auto; bottom: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  .fk-overlay, .fk-dialog, .fk-fixcard { animation: none; }
}
`;
