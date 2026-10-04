function optional(key: string): string | undefined {
  return import.meta.env[key] as string | undefined;
}

export const env = {
  // Unset builds are origin-agnostic: getServerOrigin falls back to the
  // window origin, so same-origin deployments need no build-time URL.
  VITE_SERVER_URL: optional("VITE_SERVER_URL"),
} as const;

export type Env = typeof env;
