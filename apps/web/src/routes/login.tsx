import { createFileRoute } from "@tanstack/react-router";

import { AuthPanel } from "@/components/auth-panel";
import { redirectIfAuthenticated } from "@/lib/require-auth";

export const Route = createFileRoute("/login")({
  beforeLoad: redirectIfAuthenticated,
  component: LoginRouteComponent,
});

function LoginRouteComponent() {
  return (
    <main className="bg-background text-foreground flex min-h-svh flex-col items-center justify-center gap-8 px-4 py-10">
      <div className="flex items-center gap-2.5">
        <img
          alt=""
          className="size-8 rounded-md"
          height="32"
          src="/mangy-mark.png"
          width="32"
        />
        <span className="font-heading text-base font-semibold tracking-tight">
          Mangy
        </span>
      </div>
      <AuthPanel />
    </main>
  );
}
