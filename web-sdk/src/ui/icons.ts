// Inline stroke icons (24×24, currentColor) so the widget has no asset requests.
const svg = (body: string) =>
  `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const icons = {
  feedback: svg(
    '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/><path d="M8.5 10.5h7M8.5 14h4.5"/>',
  ),
  pen: svg('<path d="M4 20l4-1L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4Z"/><path d="M14.5 6.5l3 3"/>'),
  rectangle: svg('<rect x="4" y="6" width="16" height="12" rx="1.5"/>'),
  arrow: svg('<path d="M6 18L18 6"/><path d="M9 6h9v9"/>'),
  text: svg('<path d="M5 6V5h14v1"/><path d="M12 5v14"/><path d="M9 19h6"/>'),
  move: svg(
    '<path d="M12 3v18M3 12h18"/><path d="M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
  ),
  undo: svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
  trash: svg('<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  paperclip: svg(
    '<path d="M21 11.5l-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2l-8.6 8.6a1.8 1.8 0 0 1-2.6-2.6l7.9-7.9"/>',
  ),
  send: svg('<path d="M4 12l16-8-6 16-3-7-7-1Z"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
};
