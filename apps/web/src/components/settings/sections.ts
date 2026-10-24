import { Bell, BellRing, FolderDown, Palette, User } from "lucide-react";

export const settingsSections = [
  {
    icon: User,
    label: "Account",
    to: "/settings/account",
  },
  {
    icon: Palette,
    label: "Appearance",
    to: "/settings/appearance",
  },
  {
    icon: Bell,
    label: "Notifications",
    to: "/settings/notifications",
  },
  {
    icon: BellRing,
    label: "Browser notifications",
    to: "/settings/browser-notifications",
  },
  {
    icon: FolderDown,
    label: "Destinations",
    to: "/settings/destinations",
  },
] as const;
