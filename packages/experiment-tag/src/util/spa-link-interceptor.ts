import { getGlobalScope } from '@amplitude/experiment-core';
import type { ElementRecord } from 'dom-mutator/dist/types';

declare global {
  interface Element {
    __mutationRecord__?: ElementRecord;
  }
  interface Window {
    next?: {
      router?: {
        push: (href: string) => void;
      };
    };
  }
}

// determine if navigating within same window
function isSameWindowNavigation(
  event: MouseEvent,
  target: string | null,
): boolean {
  const isModified =
    (target && target !== '_self') ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button > 0;

  return !isModified;
}

function detectSpaRouting(anchor: HTMLAnchorElement) {
  // detect React and NextJS router links
  // caveat: not 100% guaranteed to be a <Link> component that utilizes the router
  const fiberKey = Object.keys(anchor).find((k) =>
    k.startsWith('__reactFiber'),
  );
  if (!fiberKey) return false;

  // <Link> components should have an onClick handler that checks for event.defaultPrevented
  return String(anchor[fiberKey]?.memoizedProps?.onClick).includes(
    '.defaultPrevented',
  );
}

// guard against double scripts
const initFlag = Symbol.for('@amplitude/spa-link-interceptor-initiated');

export function installSpaLinkInterceptor() {
  const globalScope = getGlobalScope();
  if (!globalScope) {
    return;
  }

  if (globalScope[initFlag]) {
    return;
  }
  globalScope[initFlag] = true;

  const handler = (e: MouseEvent) => {
    const eventTarget = e.target;
    if (!(eventTarget instanceof Element)) {
      return;
    }
    const anchor = eventTarget.closest('a');
    if (!anchor) return;

    // only intercept if the href has been mutated
    const mutationRecord = anchor.__mutationRecord__;
    if (!mutationRecord?.attributes?.href?.mutations.length) {
      return;
    }

    // check for typical SPA page navigation
    const href = anchor.getAttribute('href');
    const target = anchor.getAttribute('target');
    if (
      !href ||
      !isSameWindowNavigation(e, target) ||
      !detectSpaRouting(anchor)
    ) {
      return;
    }

    e.preventDefault();
    navigateSpa(href);
  };

  document.addEventListener('click', handler, true);
}

function navigateSpa(href: string): void {
  const globalScope = getGlobalScope();
  if (!globalScope) {
    return;
  }

  let url: URL | undefined;
  try {
    url = new URL(href, globalScope.location.href);
  } catch {
    // ignore
  }
  if (url && url.origin !== globalScope.location.origin) {
    // this external URL needs to do a full page reload anyways
    globalScope.location.href = href;
    return;
  }

  // special case for NextJS router
  if (globalScope.next?.router?.push) {
    globalScope.next.router.push(href);
    return;
  }

  // other routers use pushState
  history.pushState(null, '', href);
  globalScope.dispatchEvent(
    new PopStateEvent('popstate', { state: history.state }),
  );
}
