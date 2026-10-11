import { Api, apiHttpClient } from "@mangy/contract";
import { AtomHttpApi } from "effect/reactivity";

import { getServerOrigin } from "@/lib/server-origin";

export class ApiAtoms extends AtomHttpApi.Service<ApiAtoms>()("mangy/Api", {
  api: Api,
  baseUrl: getServerOrigin(),
  httpClient: apiHttpClient,
}) {}
