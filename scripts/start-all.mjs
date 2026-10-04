import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const backendRoot = path.join(projectRoot, "backend");
const mediaConfig = path.join(projectRoot, "camera", "mediamtx.yml");
const python = path.join(backendRoot, ".venv", "Scripts", "python.exe");
const mediaMtx = process.env.MEDIA_MTX_PATH
  || path.join(
    process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE, "AppData", "Local"),
    "SatarkDrishti",
    "MediaMTX-v1.21.1",
    "mediamtx.exe",
  );
const vite = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");

for (const requiredPath of [python, mediaConfig, mediaMtx, vite]) {
  if (!existsSync(requiredPath)) {
    console.error(`Required server file not found: ${requiredPath}`);
    process.exit(1);
  }
}

const children = [];
let stopping = false;

function stopAll(exitCode) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill();
  }
  process.exitCode = exitCode;
}

function startServer(name, executable, args, cwd) {
  const child = spawn(executable, args, { cwd, stdio: "inherit", windowsHide: true });
  children.push(child);
  child.on("error", (error) => {
    console.error(`${name} failed to start: ${error.message}`);
    stopAll(1);
  });
  child.on("exit", (code, signal) => {
    if (stopping) return;
    console.error(`${name} stopped unexpectedly (${signal || `exit ${code}`}).`);
    stopAll(code && code !== 0 ? code : 1);
  });
}

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));

startServer(
  "Authority and Inspector web app",
  process.execPath,
  [vite, "dev", "--host", "127.0.0.1", "--port", "5173"],
  projectRoot,
);
startServer(
  "FastAPI backend",
  python,
  ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
  backendRoot,
);
startServer("MediaMTX", mediaMtx, [mediaConfig], projectRoot);

console.log("Satark Drishti servers are starting. Press Ctrl+C to stop all three.");
