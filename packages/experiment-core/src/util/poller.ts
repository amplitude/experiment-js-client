import { safeGlobal } from './global';

export class Poller {
  public readonly action: () => Promise<void>;
  private poller: unknown | undefined = undefined;
  constructor(action: () => Promise<void>) {
    this.action = action;
  }
  public start() {
    if (this.poller) {
      return;
    }
    this.poller = safeGlobal.setInterval(this.action);
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
