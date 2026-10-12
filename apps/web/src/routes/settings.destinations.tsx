import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";
import { Option } from "effect";
import { AsyncResult } from "effect/reactivity";
import { Trash2 } from "lucide-react";
import { useState } from "react";

import { reactivityKey } from "@/atoms/keys";
import {
  createDestination,
  deleteDestination,
  settingsBootstrapQuery,
} from "@/atoms/settings";
import type { SettingsBootstrap } from "@/atoms/settings";
import { EmptyState } from "@/components/empty-state";
import { SectionError } from "@/components/settings/section-error";
import { ToggleRow } from "@/components/settings/toggle-row";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { hasText } from "@/lib/format";
import { notifyMutation } from "@/lib/notify-mutation";

const destinationFieldIds = {
  absolutePath: "destination-absolute-path",
  komgaLibraryId: "destination-komga-library-id",
  name: "destination-name",
} as const;

const DestinationsSkeleton = () => (
  <section className="panel">
    <div className="panel-header">
      <h2 className="panel-title">Destinations</h2>
    </div>
    <div className="rows">
      <div className="row">
        <div className="w-full space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>
    </div>
  </section>
);

const DestinationsRouteComponent = () => {
  const settingsResult = useAtomValue(settingsBootstrapQuery);
  const createDestinationRequest = useAtomSet(createDestination, {
    mode: "promise",
  });
  const deleteDestinationRequest = useAtomSet(deleteDestination, {
    mode: "promise",
  });
  const createDestinationResult = useAtomValue(createDestination);
  const deleteDestinationResult = useAtomValue(deleteDestination);
  const isSaving = AsyncResult.isWaiting(createDestinationResult);
  const isRemoving = AsyncResult.isWaiting(deleteDestinationResult);
  const [name, setName] = useState("");
  const [absolutePath, setAbsolutePath] = useState("");
  const [komgaLibraryId, setKomgaLibraryId] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [destinationPendingRemoval, setDestinationPendingRemoval] = useState<
    SettingsBootstrap["destinations"][number] | null
  >(null);

  const settings = Option.getOrUndefined(AsyncResult.value(settingsResult));
  if (AsyncResult.isInitial(settingsResult)) {
    return <DestinationsSkeleton />;
  }

  const addDestination = async (): Promise<void> => {
    const libraryId = komgaLibraryId.trim();
    const saved = await notifyMutation(
      createDestinationRequest({
        payload: {
          absolutePath,
          isDefault,
          name,
          ...(hasText(libraryId) ? { komgaLibraryId: libraryId } : {}),
        },
        reactivityKeys: [reactivityKey.settingsBootstrap],
      }),
      { failure: "Unable to save destination", success: "Destination saved" }
    );

    if (saved) {
      setAbsolutePath("");
      setIsDefault(false);
      setKomgaLibraryId("");
      setName("");
    }
  };

  const removeDestination = async (destinationId: string): Promise<void> => {
    const removed = await notifyMutation(
      deleteDestinationRequest({
        params: { destinationId },
        reactivityKeys: [
          reactivityKey.settingsBootstrap,
          reactivityKey.library,
          reactivityKey.librarySeriesState,
        ],
      }),
      {
        failure: "Unable to remove destination",
        success: "Destination removed",
      }
    );

    if (removed) {
      setDestinationPendingRemoval(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionError
        cause={AsyncResult.cause(settingsResult)}
        title="Unable to load destinations"
      />

      {settings === undefined ? null : (
        <>
          <section className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Destinations</h2>
              <span className="meta">{settings.destinations.length} saved</span>
            </div>

            {settings.destinations.length > 0 ? (
              <div className="rows">
                {settings.destinations.map((destination) => {
                  const libraryId = Option.getOrUndefined(
                    destination.komgaLibraryId
                  );

                  return (
                    <div className="row" key={destination.id}>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <h3 className="truncate text-sm font-medium">
                            {destination.name}
                          </h3>
                          {destination.isDefault ? (
                            <StatusBadge tone="brand">Default</StatusBadge>
                          ) : null}
                          {destination.isEnabled ? null : (
                            <StatusBadge tone="neutral">Disabled</StatusBadge>
                          )}
                        </div>
                        <p className="meta break-all">
                          {destination.absolutePath}
                        </p>
                        {hasText(libraryId) ? (
                          <p className="meta break-all">
                            Komga library {libraryId}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        aria-label={`Remove ${destination.name}`}
                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0 self-end sm:self-auto"
                        disabled={isRemoving}
                        onClick={() => {
                          setDestinationPendingRemoval(destination);
                        }}
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                className="border-border rounded-none border-0 border-b"
                description="Add a folder so queued chapters know where to go."
                title="No destinations yet"
              />
            )}
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Add destination</h2>
            </div>
            <form
              className="space-y-4 p-4"
              onSubmit={(event) => {
                event.preventDefault();

                void addDestination();
              }}
            >
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor={destinationFieldIds.name}>
                    Name
                  </FieldLabel>
                  <Input
                    className="h-8"
                    id={destinationFieldIds.name}
                    onChange={(event) => {
                      setName(event.target.value);
                    }}
                    placeholder="Main library"
                    value={name}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor={destinationFieldIds.absolutePath}>
                    Absolute path
                  </FieldLabel>
                  <Input
                    className="h-8"
                    id={destinationFieldIds.absolutePath}
                    onChange={(event) => {
                      setAbsolutePath(event.target.value);
                    }}
                    placeholder="/srv/media/manga"
                    value={absolutePath}
                  />
                  <FieldDescription className="text-xs">
                    Folder where downloads are written.
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor={destinationFieldIds.komgaLibraryId}>
                    Komga library ID
                  </FieldLabel>
                  <Input
                    className="h-8"
                    id={destinationFieldIds.komgaLibraryId}
                    onChange={(event) => {
                      setKomgaLibraryId(event.target.value);
                    }}
                    placeholder="Optional"
                    value={komgaLibraryId}
                  />
                  <FieldDescription className="text-xs">
                    Only needed to tie this folder to a Komga library.
                  </FieldDescription>
                </Field>
              </FieldGroup>

              <ToggleRow
                checked={isDefault}
                description="Use this folder when a series has no destination."
                label="Default destination"
                onCheckedChange={setIsDefault}
              />

              <Button
                className="w-full"
                disabled={
                  isSaving ||
                  name.trim().length === 0 ||
                  absolutePath.trim().length === 0
                }
                size="lg"
                type="submit"
              >
                {isSaving ? "Saving..." : "Save destination"}
              </Button>
            </form>
          </section>
        </>
      )}

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setDestinationPendingRemoval(null);
          }
        }}
        open={destinationPendingRemoval !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove destination</DialogTitle>
            <DialogDescription>
              {destinationPendingRemoval
                ? `Remove ${destinationPendingRemoval.name}? Series using it keep tracking, but auto-download turns off.`
                : "Remove this destination?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => {
                const destinationId = destinationPendingRemoval?.id;
                if (destinationId === undefined || destinationId.length === 0) {
                  return;
                }

                void removeDestination(destinationId);
              }}
              type="button"
              variant="destructive"
            >
              {isRemoving ? "Removing..." : "Remove"}
            </Button>
            <Button
              disabled={isRemoving}
              onClick={() => {
                setDestinationPendingRemoval(null);
              }}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export const Route = createFileRoute("/settings/destinations")({
  component: DestinationsRouteComponent,
});
