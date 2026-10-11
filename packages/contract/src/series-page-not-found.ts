import { Schema } from "effect";

import { ErrorWithoutTag } from "./schema";

export class SeriesPageNotFound extends ErrorWithoutTag<SeriesPageNotFound>(
  "SeriesPageNotFound"
)(
  {
    _tag: Schema.tagDefaultOmit("SeriesPageNotFound"),
    message: Schema.String,
  },
  { httpApiStatus: 404 }
) {}
