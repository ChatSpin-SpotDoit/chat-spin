import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env["DATABASE_URL"] || "postgres://chatspin:chatspin_dev_pass@127.0.0.1:5439/chatspin_db",
  },
});
