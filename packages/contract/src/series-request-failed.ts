import { Schema } from "effect";

import { ErrorWithoutTag } from "./schema";

export class SeriesRequestFailed extends ErrorWithoutTag<SeriesRequestFailed>(
  "SeriesRequestFailed"
)(
  {
    _tag: Schema.tagDefaultOmit("SeriesRequestFailed"),
    message: Schema.String,
  },
  { httpApiStatus: 400 }
) {}
