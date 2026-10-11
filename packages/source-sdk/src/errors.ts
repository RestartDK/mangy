import { Data } from "effect";

import type { BrowserUnavailableError } from "./adapters/shared/browser";
import type { HttpError } from "./adapters/shared/http";

export class SourceParseError extends Data.TaggedError("SourceParseError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export type SourceAdapterError =
  | HttpError
  | BrowserUnavailableError
  | SourceParseError;
