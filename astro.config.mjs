import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://eastviewsoccer.com",
  trailingSlash: "ignore",
  build: { format: "directory" },
});
