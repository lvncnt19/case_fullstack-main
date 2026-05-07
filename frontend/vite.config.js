import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const rootEnv = loadEnv(mode, "..", "");
  const apiAuthToken = rootEnv.API_AUTH_TOKEN || "";

  return {
    // Read vars from repository root .env
    envDir: "..",
    define: {
      "import.meta.env.VITE_API_AUTH_TOKEN": JSON.stringify(apiAuthToken)
    },
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": "http://localhost:8000",
        "/output": "http://localhost:8000"
      }
    }
  };
});
