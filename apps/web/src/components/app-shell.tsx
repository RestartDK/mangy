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
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useLiveUpdates } from "@/hooks/use-live-updates";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const primaryNavigationItems = [
  { to: "/", label: "Discover", icon: Compass },
  { to: "/search", label: "Search", icon: Search },
  { to: "/library", label: "Library", icon: BookMarked },
  { to: "/queue", label: "Queue", icon: Download },
] as const;

const secondaryNavigationItems = [
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const navigationItems = [
  ...primaryNavigationItems,
  ...secondaryNavigationItems,
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
      <Sidebar collapsible="offcanvas" variant="inset">
        <SidebarHeader>
          <Link className="flex items-center gap-2 rounded-md px-2 py-1" to="/">
            <img
              alt="Mangy Logo"
              className="h-6 w-auto"
              height="24"
              src="/mangy.png"
              width="24"
            />
            <span className="font-heading text-sidebar-foreground text-sm font-semibold">
              Mangy
            </span>
          </Link>
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              {navigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
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
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <ShellUserMenu
            email={session?.user.email}
            name={session?.user.name}
          />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-h-0 overflow-hidden">
        <div className="flex h-14 items-center px-4 sm:px-6 lg:px-8">
          <SidebarTrigger className="-ml-1" />
        </div>
        <div
          className={cn(
            "app-page min-h-0 overflow-y-auto pt-0",
            contentClassName
          )}
        >
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};
