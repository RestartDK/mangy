import { createFileRoute } from "@tanstack/react-router";

import { AuthPanel } from "@/components/authPanel";
import { redirectIfAuthenticated } from "@/lib/requireAuth";

export const Route = createFileRoute("/login")({
  beforeLoad: redirectIfAuthenticated,
  component: LoginRouteComponent,
});

function LoginRouteComponent() {
  return (
    <div className="min-h-svh bg-[radial-gradient(circle_at_top_left,_rgba(214,92,60,0.16),_transparent_38%),linear-gradient(180deg,_rgba(254,247,236,1)_0%,_rgba(248,241,229,1)_100%)]">
      <div className="pageFrame grid min-h-svh items-center gap-8 py-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="eyebrow">Pure TypeScript manga engine</div>
          <h1 className="text-balance font-display text-5xl text-primary md:text-7xl">
            Discover, queue, and deliver manga straight into Komga.
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground md:text-xl">
            Mangy replaces the old JVM stack with a native TypeScript workflow
            for discovery, tracking, queueing, and homelab delivery.
          </p>
        </div>
        <AuthPanel />
      </div>
    </div>
  );
}
