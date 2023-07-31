import { safeGlobal } from './global';

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
    this.poller = safeGlobal.setInterval(this.action, this.ms);
    void this.action();
  }

  public stop() {
    if (!this.poller) {
      return;
    }
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    safeGlobal.clearInterval(this.poller);
    this.poller = undefined;
  }

  public isRunning(): boolean {
    return this.poller !== undefined;
  }
}
