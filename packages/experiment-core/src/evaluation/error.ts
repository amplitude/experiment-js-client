export class FetchError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, FetchError.prototype);
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}
