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

function isLocalNavigation(
  event: MouseEvent,
  href: string,
  target: string | null,
): boolean {
  const isModified =
    (target && target !== '_self') ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button > 0;

  const url = new URL(href, window.location.href);

  // ignore if link is just changing the hash
  const samePage =
    url.href.split('#')[0] === window.location.href.split('#')[0];
  const sameOrigin = url.origin === window.location.origin;

  return !isModified && sameOrigin && !samePage;
}

function detectSpaRouter(anchor: HTMLAnchorElement) {
  // detect NextJS router
  if (window.next?.router?.push) {
    return true;
  }

  // detect React app, caveats:
  // not guaranteed for react-router to be used
  // not guaranteed to be a <Link> component that utilizes the router
  const fiberKey = Object.keys(anchor).find((k) =>
    k.startsWith('__reactFiber'),
  );
  if (!fiberKey) return false;

  // SPA link components should have an onClick handler
  return Boolean(anchor[fiberKey]?.memoizedProps?.onClick);
}

export function installSpaLinkInterceptor() {
  const handler = (e: MouseEvent) => {
    const anchor = (e.target as Element).closest(
      'a',
    ) as HTMLAnchorElement | null;
    if (!anchor) return;

    // only intercept if the href has been mutated
    const mutationRecord = anchor.__mutationRecord__;
    if (!mutationRecord?.attributes?.href?.mutations.length) {
      return;
    }

    // checK for typical SPA page navigation
    const href = anchor.getAttribute('href');
    const target = anchor.getAttribute('target');
    if (!href || !isLocalNavigation(e, href, target)) {
      return;
    }

    if (!detectSpaRouter(anchor)) {
      return;
    }

    e.preventDefault();
    navigateSpa(href);
  };

  document.addEventListener('click', handler, true);
}

function navigateSpa(href: string): void {
  // special case for NextJS router
  if (window.next?.router?.push) {
    window.next.router.push(href);
    return;
  }

  // other routers use pushState
  history.pushState(null, '', href);
  window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
}
