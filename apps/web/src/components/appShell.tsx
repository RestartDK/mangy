import { Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  BookMarked,
  Compass,
  Download,
  Search,
  Settings,
} from "lucide-react";
import type { PropsWithChildren } from "react";

import { Button } from "@/components/ui/button";
import { useLiveUpdates } from "@/hooks/useLiveUpdates";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const navigationItems = [
  { to: "/", label: "Discover", icon: Compass },
  { to: "/search", label: "Search", icon: Search },
  { to: "/library", label: "Library", icon: BookMarked },
  { to: "/queue", label: "Queue", icon: Download },
  { to: "/notifications", label: "Alerts", icon: Bell },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

interface AppShellProps extends PropsWithChildren {
  title: string;
  subtitle: string;
}

export const AppShell = ({ children, title, subtitle }: AppShellProps) => {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();

  useLiveUpdates(Boolean(session?.user.id));

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="pageFrame py-6">
        <header className="panelSurface mb-6 overflow-hidden">
          <div className="grid gap-6 p-6 lg:grid-cols-[1.25fr_0.75fr] lg:p-8">
            <div>
              <div className="eyebrow">Mangy</div>
              <h1 className="mt-3 text-balance font-display text-4xl text-primary md:text-5xl">
                {title}
              </h1>
              <p className="mt-3 max-w-2xl text-base text-muted-foreground md:text-lg">
                {subtitle}
              </p>
            </div>
            <div className="flex flex-col justify-between gap-4 rounded-[28px] border border-border/60 bg-card/70 p-5">
              <div>
                <div className="text-muted-foreground text-xs uppercase tracking-[0.3em]">
                  Session
                </div>
                <div className="mt-2 font-medium text-lg">
                  {session?.user.name ?? "Signed in"}
                </div>
                <div className="text-muted-foreground text-sm">
                  {session?.user.email ?? "Ready for discovery"}
                </div>
              </div>
              <Button
                onClick={() => {
                  authClient.signOut({
                    fetchOptions: {
                      onSuccess: () => {
                        navigate({ to: "/login" });
                      },
                    },
                  });
                }}
                variant="outline"
              >
                Sign out
              </Button>
            </div>
          </div>
        </header>

        <nav className="mb-6 flex flex-wrap gap-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                activeProps={{
                  className: "bg-primary text-primary-foreground",
                }}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm transition-colors hover:border-primary/40 hover:text-primary"
                )}
                key={item.to}
                to={item.to}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {children}
      </div>
    </div>
  );
};
