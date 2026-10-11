import { Schema } from "effect";

import { ErrorWithoutTag } from "./schema";

export class Unauthorized extends ErrorWithoutTag<Unauthorized>("Unauthorized")(
  {
    _tag: Schema.tagDefaultOmit("Unauthorized"),
    message: Schema.String,
  },
  { httpApiStatus: 401 }
) {}
