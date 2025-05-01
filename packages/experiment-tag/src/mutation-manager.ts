function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number,
  options: { maxWait?: number } = {},
): T & { cancel: () => void } {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let lastInvokeTime = 0;
  let maxTimeout: ReturnType<typeof setTimeout> | null = null;

  const debounced = function (...args: Parameters<T>) {
    const now = Date.now();

    if (options.maxWait && !maxTimeout) {
      lastInvokeTime = now;
      maxTimeout = setTimeout(() => {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        maxTimeout = null;
        func(...args);
      }, options.maxWait);
    }

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      if (maxTimeout) {
        clearTimeout(maxTimeout);
        maxTimeout = null;
      }
      func(...args);
    }, wait);
  } as T & { cancel: () => void };

  debounced.cancel = () => {
    if (timeout) clearTimeout(timeout);
    if (maxTimeout) clearTimeout(maxTimeout);
    timeout = null;
    maxTimeout = null;
  };

  return debounced;
}

type MutationFilter = (mutation: MutationRecord) => boolean;
type MutationHandler = (mutations: MutationRecord[]) => void;

interface DebouncedMutationManagerOptions {
  observerOptions?: MutationObserverInit;
  debounceMs?: number;
}

const DEFAULT_OPTIONS = {
  observerOptions: {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class'],
  },
  debounceMs: 150,
} satisfies DebouncedMutationManagerOptions;

export class DebouncedMutationManager {
  private static readonly MAX_PENDING_MUTATIONS = 1000;
  private readonly filters: ReadonlyArray<MutationFilter>;

  private readonly options: Required<DebouncedMutationManagerOptions>;
  private readonly onMutations: MutationHandler;
  private readonly target: Element;
  private readonly processMutationsDebounced: ReturnType<typeof debounce>;

  private mutationObserver: MutationObserver | null = null;
  private pendingMutations: MutationRecord[] = [];

  constructor(
    target: Element,
    onMutations: MutationHandler,
    filters: ReadonlyArray<MutationFilter> = [],
    options: DebouncedMutationManagerOptions = {},
  ) {
    this.target = target;
    this.onMutations = onMutations;
    this.filters = filters;
    this.options = { ...DEFAULT_OPTIONS, ...options };

    this.processMutationsDebounced = debounce(
      this.processMutationsImmediately,
      this.options.debounceMs,
      {
        maxWait: this.options.debounceMs * 2,
      },
    );
  }

  private shouldProcessMutation(mutation: MutationRecord): boolean {
    if (this.filters.length === 0) {
      return true;
    }

    try {
      return this.filters.every((filter) => filter(mutation));
    } catch (error) {
      return false;
    }
  }

  private processMutationsImmediately = (): void => {
    if (!this.mutationObserver) return;

    try {
      if (this.pendingMutations.length > 0) {
        this.onMutations(this.pendingMutations);
      }
    } catch (error) {
      // do nothing
    } finally {
      this.pendingMutations = [];
    }
  };

  private handleMutations = (mutationList: MutationRecord[]): void => {
    try {
      const filteredBatch = mutationList.filter((mutation) =>
        this.shouldProcessMutation(mutation),
      );

      if (filteredBatch.length === 0) {
        return;
      }

      const totalPending = this.pendingMutations.length + filteredBatch.length;
      if (totalPending > DebouncedMutationManager.MAX_PENDING_MUTATIONS) {
        this.pendingMutations.push(...filteredBatch);
        this.processMutationsDebounced.cancel();
        this.processMutationsImmediately();
        return;
      }

      this.pendingMutations.push(...filteredBatch);
      this.processMutationsDebounced();
    } catch (error) {
      // do nothing
    }
  };

  private cleanup(): void {
    this.processMutationsDebounced.cancel();
    this.mutationObserver?.disconnect();
    this.pendingMutations = [];
    this.mutationObserver = null;
  }

  public observe(): () => void {
    if (this.mutationObserver) {
      this.cleanup();
    }

    this.mutationObserver = new MutationObserver(this.handleMutations);
    this.mutationObserver.observe(this.target, this.options.observerOptions);

    return () => {
      this.cleanup();
    };
  }
}
