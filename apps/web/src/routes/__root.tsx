import { RegistryProvider } from "@effect/atom-react";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

import "../index.css";

export type RouterAppContext = Record<string, never>;

const RootComponent = () => (
  <>
    <HeadContent />
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      disableTransitionOnChange
      enableSystem
    >
      <RegistryProvider>
        <div className="bg-background text-foreground min-h-svh">
          <Outlet />
        </div>
        <Toaster />
      </RegistryProvider>
    </ThemeProvider>
    <TanStackRouterDevtools position="bottom-left" />
  </>
);
export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
  head: () => ({
    links: [
      {
        href: "/favicon.ico",
        rel: "icon",
        type: "image/x-icon",
      },
      {
        href: "/apple-touch-icon.png",
        rel: "apple-touch-icon",
      },
    ],
    meta: [
      {
        title: "Mangy",
      },
      {
        content: "Mangy is a manga discovery and download app for Komga.",
        name: "description",
      },
    ],
  }),
});
