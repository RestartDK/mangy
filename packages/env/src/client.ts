const optional = (key: string): string | undefined => import.meta.env[key];

export const env = {
  // Unset builds are origin-agnostic: getServerOrigin falls back to the
  // window origin, so same-origin deployments need no build-time URL.
  VITE_SERVER_URL: optional("VITE_SERVER_URL"),
} as const;

export type Env = typeof env;
