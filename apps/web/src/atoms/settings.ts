import { Effect } from "effect";
import { Atom } from "effect/reactivity";

import { ApiAtoms } from "@/atoms/client";
import { reactivityKey } from "@/atoms/keys";
import { getBrowserPushClientState } from "@/lib/browser-push";

export type { SettingsBootstrap } from "@mangy/contract";

export const settingsBootstrapQuery = ApiAtoms.query("settings", "bootstrap", {
  reactivityKeys: [reactivityKey.settingsBootstrap],
});

export const browserPushSettingsQuery = ApiAtoms.query("settings", "getPush", {
  reactivityKeys: [reactivityKey.browserPushSettings],
});

export const browserPushClientState = Atom.make(
  Effect.promise(async () => await getBrowserPushClientState())
).pipe(Atom.withReactivity([reactivityKey.browserPushClientState]));

export const createDestination = ApiAtoms.mutation(
  "settings",
  "createDestination"
);

export const deleteDestination = ApiAtoms.mutation(
  "settings",
  "deleteDestination"
);

export const updateBrowserPushPreferences = ApiAtoms.mutation(
  "settings",
  "updatePushPreferences"
);

export const savePushSubscription = ApiAtoms.mutation(
  "settings",
  "savePushSubscription"
);

export const removePushSubscription = ApiAtoms.mutation(
  "settings",
  "removePushSubscription"
);

export const sendTestPush = ApiAtoms.mutation("settings", "sendTestPush");
