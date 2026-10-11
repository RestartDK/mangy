import type { LiveStatePayload } from "@mangy/contract";
import { liveStatePayloadSchema } from "@mangy/contract";
import { Effect, Layer, Option, Schema } from "effect";
import { Atom, Reactivity } from "effect/reactivity";

import { reactivityKey } from "@/atoms/keys";
import type { ReactivityKey } from "@/atoms/keys";
import { getServerOrigin } from "@/lib/server-origin";

const decodeStatePayload = Schema.decodeUnknownOption(
  Schema.fromJsonString(liveStatePayloadSchema)
);

const keysFor = (payload: LiveStatePayload): readonly ReactivityKey[] => {
  const keys: ReactivityKey[] = [];

  if (payload.downloadsChanged) {
    keys.push(reactivityKey.downloads, reactivityKey.library);
  }

  if (payload.trackingChanged) {
    keys.push(
      reactivityKey.library,
      reactivityKey.librarySeriesState,
      reactivityKey.tracking
    );
  }

  if (payload.notificationsChanged) {
    keys.push(
      reactivityKey.notifications,
      reactivityKey.notificationPreferences,
      reactivityKey.settingsBootstrap
    );
  }

  return keys;
};

// The live atom yields `Reactivity`, which only a runtime atom puts in the effect context.
const liveRuntime = Atom.runtime(Layer.empty);

export const liveUpdates = liveRuntime.atom(
  Effect.gen(function* liveUpdatesEffect() {
    const reactivity = yield* Reactivity.Reactivity;
    const source = new EventSource(`${getServerOrigin()}/api/live/events`, {
      withCredentials: true,
    });

    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        source.close();
      })
    );
    yield* Effect.sync(() => {
      source.addEventListener("state", (event) => {
        if (
          !(event instanceof MessageEvent) ||
          typeof event.data !== "string"
        ) {
          return;
        }

        const payload = Option.getOrUndefined(decodeStatePayload(event.data));

        if (payload === undefined) {
          return;
        }

        const keys = keysFor(payload);

        if (keys.length > 0) {
          reactivity.invalidateUnsafe(keys);
        }
      });
    });

    return yield* Effect.never;
  })
);
