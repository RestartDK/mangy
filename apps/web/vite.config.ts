import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const resolvePath = (relativePath: string): string =>
  decodeURIComponent(new URL(relativePath, import.meta.url).pathname);

export default defineConfig(({ mode }) => {
  const envDir = resolvePath("../..");
  const env = loadEnv(mode, envDir, "");
  const backendOrigin = env.VITE_SERVER_URL || "http://127.0.0.1:3000";

  return {
    envDir,
    plugins: [tailwindcss(), tanstackRouter({}), react()],
    resolve: {
      alias: {
        "@": resolvePath("./src"),
      },
    },
    server: {
      host: "0.0.0.0",
      port: 3001,
      proxy: {
        "/api": {
          target: backendOrigin,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    preview: {
      host: "0.0.0.0",
      port: 3001,
    },
  };
});
