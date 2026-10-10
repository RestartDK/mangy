import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  BookMarked,
  Compass,
  Download,
  Search,
  Settings,
} from "lucide-react";
import type { PropsWithChildren } from "react";

import { ShellUserMenu } from "@/components/shell-user-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useLiveUpdates } from "@/hooks/use-live-updates";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const navigationGroups = [
  {
    label: "Browse",
    items: [
      { to: "/", label: "Discover", icon: Compass },
      { to: "/search", label: "Search", icon: Search },
    ],
  },
  {
    label: "Manage",
    items: [
      { to: "/library", label: "Library", icon: BookMarked },
      { to: "/queue", label: "Queue", icon: Download },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/notifications", label: "Notifications", icon: Bell },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
] as const;

interface AppShellProps extends PropsWithChildren {
  contentClassName?: string;
}

const isActiveRoute = (pathname: string, to: string): boolean => {
  if (to === "/") {
    return pathname === "/";
  }

  return pathname === to || pathname.startsWith(`${to}/`);
};

export const AppShell = ({ children, contentClassName }: AppShellProps) => {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const { data: session } = authClient.useSession();

  useLiveUpdates(Boolean(session?.user.id));

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <Sidebar collapsible="offcanvas">
        <SidebarHeader className="px-3 py-4">
          <Link className="flex items-center gap-2.5 px-1" to="/">
            <img
              alt=""
              className="size-7 rounded-md"
              height="28"
              src="/mangy-mark.png"
              width="28"
            />
            <span className="font-heading text-sm font-semibold tracking-tight">
              Mangy
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent className="gap-4">
          {navigationGroups.map((group) => (
            <SidebarGroup className="gap-1 py-0" key={group.label}>
              <SidebarGroupLabel className="text-muted-foreground px-2 text-xs font-normal">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton
                          asChild
                          className="h-8 px-2 data-[active=true]:font-medium"
                          isActive={isActiveRoute(pathname, item.to)}
                        >
                          <Link to={item.to}>
                            <Icon className="size-4" />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
      </Sidebar>
      <SidebarInset className="min-h-0 overflow-hidden">
        <header className="border-border flex h-14 shrink-0 items-center justify-between gap-2 border-b px-3 sm:px-4">
          <SidebarTrigger className="-ml-1" />
          <ShellUserMenu
            email={session?.user.email}
            name={session?.user.name}
          />
        </header>
        <div
          className={cn("app-page min-h-0 overflow-y-auto", contentClassName)}
        >
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};
