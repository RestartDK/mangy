import { Link, useRouterState } from "@tanstack/react-router";

import { settingsSections } from "@/components/settings/sections";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { isActiveRoute } from "@/lib/routes";

export const SettingsNav = () => {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <nav
      aria-label="Settings sections"
      className="min-w-0 lg:sticky lg:top-6 lg:self-start"
    >
      <SidebarMenu className="gap-1">
        {settingsSections.map((section) => {
          const Icon = section.icon;
          const isActive = isActiveRoute(pathname, section.to);

          return (
            <SidebarMenuItem key={section.to}>
              <SidebarMenuButton asChild isActive={isActive}>
                <Link
                  aria-current={isActive ? "page" : undefined}
                  to={section.to}
                >
                  <Icon />
                  <span>{section.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </nav>
  );
};
