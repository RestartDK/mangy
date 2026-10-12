import { Api, apiCredentials, apiHttpClient } from "@mangy/contract";
import { Atom, AtomHttpApi } from "effect/reactivity";

import { getServerOrigin } from "@/lib/server-origin";

// FetchHttpClient reads the credentials default from the request fiber's context, which the
// httpClient layer does not reach, so a cross-origin request would ship no session cookie.
Atom.runtime.addGlobalLayer(apiCredentials);

export class ApiAtoms extends AtomHttpApi.Service<ApiAtoms>()("mangy/Api", {
  api: Api,
  baseUrl: getServerOrigin(),
  httpClient: apiHttpClient,
}) {}
