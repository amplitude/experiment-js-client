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
    if (safeGlobal) {
      this.poller = safeGlobal.setInterval(this.action, this.ms);
    } else {
      throw Error('Cannot start poller, global is not defined');
    }
    void this.action();
  }

  public stop() {
    if (!this.poller) {
      return;
    }
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    safeGlobal?.clearInterval(this.poller); // If it can start, it can stop
    this.poller = undefined;
  }
}
