import debounce from 'lodash/debounce';

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
      // logger.error('Error in mutation filter:', { error, mutation });
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
      // logger.error('Error processing mutations:', {
      //   error,
      //   pendingCount: this.pendingMutations.length,
      // });
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
      // logger.error('Error handling mutations:', { error, mutationCount: mutationList.length });
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
