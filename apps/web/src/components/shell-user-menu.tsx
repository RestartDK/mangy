import { useNavigate } from "@tanstack/react-router";
import { ChevronsUpDown, LogOut } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
        <Button className="h-8 gap-2 pr-2 pl-1" variant="ghost">
          <Avatar className="size-6">
            <AvatarFallback className="text-xs">
              {getInitials(name ?? email)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-40 truncate text-sm font-normal sm:inline">
            {name ?? "Signed in"}
          </span>
          <ChevronsUpDown className="text-muted-foreground size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
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
