import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

test("Vercel entry exports Express without starting a local listener", () => {
  const output = execFileSync(process.execPath, ["--input-type=module", "--eval",
    'const { default: app } = await import("./app.js"); console.log(typeof app);'], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, GUESSR_DB_PATH: ":memory:", NODE_ENV: "test", VERCEL: "",
      PORT: "0", EMAIL_MODE: "console", SESSION_SECRET: "test-entry-secret" },
    encoding: "utf8",
    timeout: 5000,
  });
  assert.equal(output.trim(), "function");
});

test("Vercel entry starts when the deployed function omits the browser analytics package", () => {
  const output = execFileSync(process.execPath, [
    "--input-type=module", "--eval",
    `import { register } from "node:module";
     register(${JSON.stringify(new URL("./fixtures/missing-analytics-loader.js", import.meta.url).href)}, import.meta.url);
     const { default: app } = await import("./app.js"); console.log(typeof app);`,
  ], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, GUESSR_DB_PATH: ":memory:", NODE_ENV: "test", VERCEL: "",
      PORT: "0", EMAIL_MODE: "console", SESSION_SECRET: "test-entry-secret" },
    encoding: "utf8",
    timeout: 5000,
  });
  assert.equal(output.trim(), "function");
});
