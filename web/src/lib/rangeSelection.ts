/**
 * Computes the updated set of selected item IDs when an item is clicked,
 * optionally with the Shift key held to select a range.
 */
export function computeRangeSelection(
  visibleIds: string[],
  lastSelectedId: string | null,
  targetId: string,
  currentSelectedIds: Set<string>,
  shiftKey: boolean
): { nextSelectedIds: Set<string>; nextLastSelectedId: string } {
  const next = new Set(currentSelectedIds);

  if (shiftKey && lastSelectedId) {
    const fromIndex = visibleIds.indexOf(lastSelectedId);
    const toIndex = visibleIds.indexOf(targetId);

    if (fromIndex !== -1 && toIndex !== -1) {
      const start = Math.min(fromIndex, toIndex);
      const end = Math.max(fromIndex, toIndex);
      const rangeIds = visibleIds.slice(start, end + 1);
      const shouldSelect = !currentSelectedIds.has(targetId);

      for (const id of rangeIds) {
        if (shouldSelect) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }
      return { nextSelectedIds: next, nextLastSelectedId: targetId };
    }
  }

  // Normal toggle
  if (next.has(targetId)) {
    next.delete(targetId);
  } else {
    next.add(targetId);
  }
  return { nextSelectedIds: next, nextLastSelectedId: targetId };
}
