import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/domain/player/schema.ts",
  out: "./db/migrations",
});
