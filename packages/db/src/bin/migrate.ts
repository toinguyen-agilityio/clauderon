import { connect } from "../client";
import { migrate } from "../migrate";
import { seedSamples } from "../seed";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const handle = connect(url);
try {
  await migrate(handle.db);
  if (process.argv.includes("--seed")) await seedSamples(handle.db);
  console.log("database ready");
} finally {
  await handle.close();
}
