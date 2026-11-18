/** Base of every error the domain and the use cases raise on purpose; the console prints its message as is. */
export class SpecmateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
