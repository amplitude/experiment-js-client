import { safeGlobal } from './global';

export class Backoff {
  private readonly attempts: number;
  private readonly min: number;
  private readonly max: number;
  private readonly scalar: number;

  private started = false;
  private done = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private timeoutHandle: any;

  public constructor(
    attempts: number,
    min: number,
    max: number,
    scalar: number,
  ) {
    this.attempts = attempts;
    this.min = min;
    this.max = max;
    this.scalar = scalar;
  }

  public async start(fn: () => Promise<void>): Promise<void> {
    if (!this.started) {
      this.started = true;
    } else {
      throw Error('Backoff already started');
    }
    await this.backoff(fn, 0, this.min);
  }

  public cancel(): void {
    this.done = true;
    clearTimeout(this.timeoutHandle);
  }

  private async backoff(
    fn: () => Promise<void>,
    attempt: number,
    delay: number,
  ): Promise<void> {
    if (this.done) {
      return;
    }
    this.timeoutHandle = safeGlobal.setTimeout(async () => {
      try {
        await fn();
      } catch (e) {
        const nextAttempt = attempt + 1;
        if (nextAttempt < this.attempts) {
          console.error('[Experiment] Retry ' + attempt + ' failed: ', e);
          const nextDelay = Math.min(delay * this.scalar, this.max);
          this.backoff(fn, nextAttempt, nextDelay);
        } else {
          console.error(
            '[Experiment] Retries failed after ' +
              this.attempts +
              ' attempts: ',
            e,
          );
        }
      }
    }, delay);
  }
}
