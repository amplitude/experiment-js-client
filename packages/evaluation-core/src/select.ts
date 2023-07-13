export const select = (
  selectable: any,
  selector: string[] | undefined,
): any | undefined => {
  if (!selector || selector.length === 0) {
    return undefined;
  }
  for (const selectorElement of selector) {
    if (!selectorElement || !selectable || typeof selectable !== 'object') {
      return undefined;
    }
    selectable = selectable[selectorElement];
  }
  if (!selectable) {
    return undefined;
  } else {
    return selectable;
  }
};
