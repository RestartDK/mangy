import { useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { getInitials } from "@/lib/format";

interface ShellUserMenuProps {
  name: string | null | undefined;
  email: string | null | undefined;
}

export const ShellUserMenu = ({ email, name }: ShellUserMenuProps) => {
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton className="h-12" size="lg">
          <Avatar className="size-8">
            <AvatarFallback>{getInitials(name ?? email)}</AvatarFallback>
          </Avatar>
          <span className="grid text-left">
            <span className="text-sidebar-foreground truncate text-sm font-medium">
              {name ?? "Signed in"}
            </span>
            <span className="text-sidebar-foreground/70 truncate text-xs">
              {email ?? "Manage account"}
            </span>
          </span>
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="grid gap-1">
          <span>{name ?? "Signed in"}</span>
          <span className="text-muted-foreground text-xs font-normal">
            {email ?? "Manage your account"}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            authClient.signOut({
              fetchOptions: {
                onSuccess: () => {
                  navigate({ to: "/login" });
                },
              },
            });
          }}
        >
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
