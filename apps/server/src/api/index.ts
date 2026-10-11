import { HttpApi } from "effect/http-api";

import { TrackingApi } from "./tracking";

export const Api = HttpApi.make("mangy-api").add(TrackingApi);

export * from "./auth";
export * from "./tracking";
