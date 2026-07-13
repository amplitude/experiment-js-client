import { getClearInterval, getSetInterval } from './global';

export class Poller {
  public readonly action: () => Promise<void>;
  private readonly ms;
  private poller: unknown | undefined = undefined;
  constructor(action: () => Promise<void>, ms: number) {
    this.action = action;
    this.ms = ms;
  }
  public start() {
    if (this.poller) {
      return;
    }
    const setInterval = getSetInterval();
    if (!setInterval) {
      return;
    }
    this.poller = setInterval(() => {
      void this.action();
    }, this.ms);
    void this.action();
  }

  public stop() {
    if (!this.poller) {
      return;
    }
    const clearInterval = getClearInterval();
    if (clearInterval) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      clearInterval(this.poller);
    }
    this.poller = undefined;
  }
}
