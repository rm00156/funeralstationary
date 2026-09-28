import "dotenv/config";
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set — copy .env.example to .env and adjust it.");
}

// drizzle-kit has no equivalent of src/db/index.ts's TLS-for-TiDB switch, and
// its mysql dialect only takes an `ssl` option alongside discrete host/user/
// password credentials, not alongside a `url`. So fold it into the URL, which
// mysql2 (drizzle-kit's driver) parses from an `?ssl=` query param. Without
// this, migrate-on-deploy's plain DATABASE_URL makes an insecure connection,
// which TiDB Cloud refuses outright.
const url = new URL(process.env.DATABASE_URL);
if (url.hostname.endsWith(".tidbcloud.com") && !url.searchParams.has("ssl")) {
  url.searchParams.set("ssl", JSON.stringify({ rejectUnauthorized: true }));
}

export default defineConfig({
  dialect: "mysql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: url.toString(),
  },
  strict: true,
  verbose: true,
});
