import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import { AsyncResult } from "effect/reactivity";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { apiKeysQuery, createApiKey, revokeApiKey } from "@/atoms/api-keys";
import type { ApiKey } from "@/atoms/api-keys";
import { reactivityKey } from "@/atoms/keys";
import { EmptyState } from "@/components/empty-state";
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
import { formatDateTime, getErrorMessage } from "@/lib/format";
import { notifyMutation } from "@/lib/notify-mutation";

const apiKeyFieldIds = {
  name: "api-key-name",
} as const;

const ApiKeysSkeleton = () => (
  <section className="panel">
    <div className="panel-header">
      <h2 className="panel-title">API keys</h2>
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

export const ApiKeysPanel = () => {
  const apiKeysResult = useAtomValue(apiKeysQuery);
  const createApiKeyRequest = useAtomSet(createApiKey, { mode: "promise" });
  const revokeApiKeyRequest = useAtomSet(revokeApiKey, { mode: "promise" });
  const createApiKeyResult = useAtomValue(createApiKey);
  const revokeApiKeyResult = useAtomValue(revokeApiKey);
  const isCreatingApiKey = AsyncResult.isWaiting(createApiKeyResult);
  const isRevokingApiKey = AsyncResult.isWaiting(revokeApiKeyResult);
  const [apiKeyName, setApiKeyName] = useState("");
  const [createdApiKeySecret, setCreatedApiKeySecret] = useState<string | null>(
    null
  );
  const [apiKeyPendingRevoke, setApiKeyPendingRevoke] = useState<ApiKey | null>(
    null
  );

  if (AsyncResult.isInitial(apiKeysResult)) {
    return <ApiKeysSkeleton />;
  }

  const apiKeys = Option.getOrElse(
    AsyncResult.value(apiKeysResult),
    (): readonly ApiKey[] => []
  );

  const addApiKey = async (): Promise<void> => {
    try {
      const created = await createApiKeyRequest({
        payload: { name: apiKeyName },
        reactivityKeys: [reactivityKey.apiKeys],
      });

      setApiKeyName("");
      setCreatedApiKeySecret(created.secret);
    } catch (createError) {
      toast.error(getErrorMessage(createError, "Unable to create an API key"));
    }
  };

  const revokeApiKeyById = async (apiKeyId: ApiKey["id"]): Promise<void> => {
    const revoked = await notifyMutation(
      revokeApiKeyRequest({
        params: { apiKeyId },
        reactivityKeys: [reactivityKey.apiKeys],
      }),
      { failure: "Unable to revoke this API key", success: "API key revoked" }
    );

    if (revoked) {
      setApiKeyPendingRevoke(null);
    }
  };

  const copyCreatedApiKey = async (): Promise<void> => {
    if (createdApiKeySecret === null) {
      toast.error("Nothing to copy");
      return;
    }

    try {
      await navigator.clipboard.writeText(createdApiKeySecret);
      toast.success("API key copied");
    } catch {
      toast.error("Unable to copy the API key. Select it and copy manually.");
    }
  };

  return (
    <>
      <section className="panel">
        <div className="panel-header">
          <h2 className="panel-title">API keys</h2>
          <span className="meta">
            {apiKeys.length === 0 ? "None" : `${apiKeys.length} active`}
          </span>
        </div>

        {apiKeys.length > 0 ? (
          <div className="rows">
            {apiKeys.map((apiKey) => (
              <div className="row" key={apiKey.id}>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h3 className="truncate text-sm font-medium">
                      {apiKey.name}
                    </h3>
                    <span className="meta font-mono">{apiKey.prefix}...</span>
                  </div>
                  <p className="meta">
                    Created {formatDateTime(apiKey.createdAt)}.{" "}
                    {Option.isSome(apiKey.lastUsedAt)
                      ? `Last used ${formatDateTime(apiKey.lastUsedAt.value)}`
                      : "Never used"}
                  </p>
                </div>
                <Button
                  aria-label={`Revoke ${apiKey.name}`}
                  className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0"
                  disabled={isRevokingApiKey}
                  onClick={() => {
                    setApiKeyPendingRevoke(apiKey);
                  }}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            className="border-border rounded-none border-0 border-b"
            description="Create a key to call the API from a script instead of a browser session."
            title="No API keys yet"
          />
        )}

        <form
          className="space-y-4 p-4"
          onSubmit={(event) => {
            event.preventDefault();

            void addApiKey();
          }}
        >
          <h3 className="panel-title">Create key</h3>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={apiKeyFieldIds.name}>Name</FieldLabel>
              <Input
                className="h-8"
                id={apiKeyFieldIds.name}
                onChange={(event) => {
                  setApiKeyName(event.target.value);
                }}
                placeholder="Backup script"
                value={apiKeyName}
              />
              <FieldDescription className="text-xs">
                Only used to recognise the key in this list.
              </FieldDescription>
            </Field>
          </FieldGroup>

          <Button
            className="w-full"
            disabled={isCreatingApiKey || apiKeyName.trim().length === 0}
            size="lg"
            type="submit"
          >
            {isCreatingApiKey ? "Creating..." : "Create key"}
          </Button>
        </form>
      </section>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setCreatedApiKeySecret(null);
          }
        }}
        open={createdApiKeySecret !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy your API key</DialogTitle>
            <DialogDescription>
              This is the only time the full key is shown. Send it as the
              x-api-key header on requests that should run as you.
            </DialogDescription>
          </DialogHeader>
          <code className="border-border bg-muted block rounded-md border p-3 font-mono text-xs break-all">
            {createdApiKeySecret}
          </code>
          <DialogFooter>
            <Button
              onClick={() => {
                void copyCreatedApiKey();
              }}
              type="button"
            >
              Copy key
            </Button>
            <Button
              onClick={() => {
                setCreatedApiKeySecret(null);
              }}
              type="button"
              variant="outline"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setApiKeyPendingRevoke(null);
          }
        }}
        open={apiKeyPendingRevoke !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke API key</DialogTitle>
            <DialogDescription>
              {apiKeyPendingRevoke
                ? `Revoke ${apiKeyPendingRevoke.name}? Requests that use it start failing immediately.`
                : "Revoke this API key?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => {
                const apiKeyId = apiKeyPendingRevoke?.id;
                if (apiKeyId === undefined) {
                  return;
                }

                void revokeApiKeyById(apiKeyId);
              }}
              type="button"
              variant="destructive"
            >
              {isRevokingApiKey ? "Revoking..." : "Revoke"}
            </Button>
            <Button
              disabled={isRevokingApiKey}
              onClick={() => {
                setApiKeyPendingRevoke(null);
              }}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
