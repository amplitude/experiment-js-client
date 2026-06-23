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

/**
 * Patch DOMParser to set inline styles programmatically to work around restrictive style CSP
 */
export const patchDOMParser = () => {
  if (!window['__domParserParseFromString']) {
    const parseFromString = DOMParser.prototype.parseFromString;
    window['__domParserParseFromString'] = parseFromString;
  
    const setStyle = (el: HTMLElement) => {
      el.style.cssText = el.getAttribute('style') || '';
      for (const child of el.children) {
        setStyle(child as HTMLElement);
      }
    };
  
    DOMParser.prototype.parseFromString = function (content, contentType) {
      const doc = parseFromString.apply(this, [content, contentType]);
      if (contentType === 'text/html') {
        setStyle(doc.body);
      }
      return doc;
    };
  }
}
