import { redirect } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";

export const requireAuth = async () => {
  const session = await authClient.getSession();
  if (!session.data) {
    throw redirect({ to: "/login" });
  }

  return session.data;
};

export const redirectIfAuthenticated = async () => {
  const session = await authClient.getSession();
  if (session.data) {
    throw redirect({ to: "/" });
  }
};
