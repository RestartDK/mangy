import { useAtomMount } from "@effect/atom-react";
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

import { liveUpdates } from "@/atoms/live";
import { ShellUserMenu } from "@/components/shell-user-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const navigationItems = [
  { icon: Compass, label: "Discover", to: "/" },
  { icon: Search, label: "Search", to: "/search" },
  { icon: BookMarked, label: "Library", to: "/library" },
  { icon: Download, label: "Queue", to: "/queue" },
  { icon: Bell, label: "Notifications", to: "/notifications" },
  { icon: Settings, label: "Settings", to: "/settings" },
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

  useAtomMount(liveUpdates);

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
        <SidebarContent>
          <SidebarGroup className="gap-1 py-0">
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {navigationItems.map((item) => {
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
