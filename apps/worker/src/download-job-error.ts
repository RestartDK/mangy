import { Data } from "effect";

export class DownloadJobError extends Data.TaggedError("DownloadJobError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}
