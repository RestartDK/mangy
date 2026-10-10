import { createFileRoute } from "@tanstack/react-router";
import { BookMarked, Download, Search } from "lucide-react";

import { AuthPanel } from "@/components/auth-panel";
import { MetricCard } from "@/components/metric-card";
import { redirectIfAuthenticated } from "@/lib/require-auth";

export const Route = createFileRoute("/login")({
  beforeLoad: redirectIfAuthenticated,
  component: LoginRouteComponent,
});

function LoginRouteComponent() {
  return (
    <div className="bg-background text-foreground min-h-svh">
      <div className="mx-auto grid min-h-svh w-full max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
        <section className="space-y-6">
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm font-medium">Mangy</p>
            <h1 className="font-heading max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
              Search manga, queue chapters, and keep your library in sync.
            </h1>
            <p className="text-muted-foreground max-w-xl text-base sm:text-lg">
              A focused manga manager for finding titles, choosing destinations,
              and tracking new releases.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard
              helper="Find titles fast"
              icon={<Search className="size-4" />}
              label="Search"
              value="Browse"
            />
            <MetricCard
              helper="Send chapters to the queue"
              icon={<Download className="size-4" />}
              label="Queue"
              value="Download"
            />
            <MetricCard
              helper="Manage tracked series"
              icon={<BookMarked className="size-4" />}
              label="Library"
              value="Organize"
            />
          </div>
        </section>
        <div className="flex justify-center lg:justify-end">
          <AuthPanel />
        </div>
      </div>
    </div>
  );
}
