/**
 * Patch removeChild to avoid errors when removing nodes that are added
 * mutate/inject actions.
 */
export const patchRemoveChild = () => {
  HTMLElement.prototype.removeChild = function <T extends Node>(n: T): T {
    if (!n || n.parentNode === this) {
      return Node.prototype.removeChild.call(this, n) as T;
    }
    return n;
  };
};

const detectStyleCSP = () => {
  const el = new DOMParser().parseFromString(
    '<i style="color:red"></i>',
    'text/html',
  ).body.firstChild as HTMLElement;
  return !el.style.cssText;
};

const setStyle = (el: HTMLElement) => {
  el.style.cssText = el.getAttribute('style') || '';
  for (const child of el.children) {
    setStyle(child as HTMLElement);
  }
};

/**
 * Patch DOMParser to set inline styles programmatically to work around restrictive style CSP
 */
export const patchDOMParser = () => {
  if (!window['__domParserParseFromString'] && detectStyleCSP()) {
    const parseFromString = DOMParser.prototype.parseFromString;
    window['__domParserParseFromString'] = parseFromString;

    DOMParser.prototype.parseFromString = function (content, contentType) {
      const doc = parseFromString.apply(this, [content, contentType]);
      if (contentType === 'text/html') {
        setStyle(doc.body);
      }
      return doc;
    };
  }
};
