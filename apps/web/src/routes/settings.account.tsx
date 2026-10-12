import { useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";
import { Option } from "effect";
import { AsyncResult } from "effect/reactivity";

import { settingsBootstrapQuery } from "@/atoms/settings";
import { SectionError } from "@/components/settings/section-error";
import { Skeleton } from "@/components/ui/skeleton";
import { hasText } from "@/lib/format";

const AccountSkeleton = () => (
  <section className="panel">
    <div className="panel-header">
      <h2 className="panel-title">Account</h2>
    </div>
    <div className="rows">
      <div className="row">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="row">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-56" />
      </div>
    </div>
  </section>
);

const AccountRouteComponent = () => {
  const settingsResult = useAtomValue(settingsBootstrapQuery);
  const settings = Option.getOrUndefined(AsyncResult.value(settingsResult));

  if (AsyncResult.isInitial(settingsResult)) {
    return <AccountSkeleton />;
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionError
        cause={AsyncResult.cause(settingsResult)}
        title="Unable to load your account"
      />

      {settings === undefined ? null : (
        <section className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Account</h2>
          </div>
          <dl className="rows">
            <div className="row">
              <dt className="meta">Name</dt>
              <dd className="text-sm">
                {hasText(settings.profile.name)
                  ? settings.profile.name
                  : "Not set"}
              </dd>
            </div>
            <div className="row">
              <dt className="meta">Email</dt>
              <dd className="text-sm">{settings.profile.email}</dd>
            </div>
          </dl>
        </section>
      )}
    </div>
  );
};

export const Route = createFileRoute("/settings/account")({
  component: AccountRouteComponent,
});
