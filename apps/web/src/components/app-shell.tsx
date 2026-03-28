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
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
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
  { to: "/search", label: "Search", icon: Search },
  { to: "/library", label: "Library", icon: BookMarked },
  { to: "/queue", label: "Queue", icon: Download },
] as const;

const secondaryNavigationItems = [
  { to: "/", label: "Discover", icon: Compass },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/settings", label: "Settings", icon: Settings },
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
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader>
          <Link
            className="flex flex-col gap-1 rounded-md px-2 py-1"
            to="/search"
          >
            <span className="font-heading font-semibold text-sidebar-foreground text-sm">
              Mangy
            </span>
            <span className="text-sidebar-foreground/70 text-xs">
              Manga management
            </span>
          </Link>
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workflows</SidebarGroupLabel>
            <SidebarMenu>
              {primaryNavigationItems.map((item) => {
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
          <SidebarGroup>
            <SidebarGroupLabel>More</SidebarGroupLabel>
            <SidebarMenu>
              {secondaryNavigationItems.map((item) => {
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
      <SidebarInset>
        <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:px-6 lg:px-8">
            <SidebarTrigger className="md:hidden" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-heading font-medium text-sm">
                Mangy
              </div>
              <div className="truncate text-muted-foreground text-xs">
                Search, queue, and manage manga in one place.
              </div>
            </div>
          </div>
        </div>
        <div className={cn("app-page", contentClassName)}>{children}</div>
        <Separator />
      </SidebarInset>
    </SidebarProvider>
  );
};
