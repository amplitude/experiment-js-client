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
