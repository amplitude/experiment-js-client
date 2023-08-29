export const select = (
  selectable: unknown,
  selector: string[] | undefined,
): unknown | undefined => {
  if (!selector || selector.length === 0) {
    return undefined;
  }
  for (const selectorElement of selector) {
    if (!selectorElement || !selectable || typeof selectable !== 'object') {
      return undefined;
    }
    selectable = (selectable as Record<string, unknown>)[selectorElement];
  }
  if (!selectable) {
    return undefined;
  } else {
    return selectable;
  }
};
