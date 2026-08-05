import { mkdir } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const cache = path.join(root, ".cache", "electron-builder");
await mkdir(cache, { recursive: true });

const pnpmCli = process.env.npm_execpath;
if (!pnpmCli) throw new Error("pnpm CLI path is unavailable");
const child = spawn(
  process.execPath,
  [pnpmCli, "exec", "electron-builder", "--win", "portable", "--x64", "--publish", "never"],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      CSC_IDENTITY_AUTO_DISCOVERY: "false",
      ELECTRON_BUILDER_CACHE: cache,
    },
  },
);

const exitCode = await new Promise((resolve, reject) => {
  child.once("error", reject);
  child.once("exit", (code) => resolve(code ?? 1));
});
process.exitCode = exitCode;
