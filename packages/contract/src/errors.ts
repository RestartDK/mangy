import { Schema } from "effect";

import { ErrorWithoutTag } from "./schema";

export class BadRequest extends ErrorWithoutTag<BadRequest>("BadRequest")(
  {
    _tag: Schema.tagDefaultOmit("BadRequest"),
    message: Schema.String,
  },
  { httpApiStatus: 400 }
) {}
