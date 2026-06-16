/**
 * One-shot local setup: apply migrations, then seed the demo account.
 *   npm run setup
 */
import { execSync } from "node:child_process";

function run(cmd: string) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

run("npm run db:migrate");
run("npm run seed");
console.log("\nSetup complete. Start the app with `npm run dev`.");
