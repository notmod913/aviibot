import { createServer } from "node:http";
import { Readable } from "node:stream";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dashboardHandler from "../dist/server/server.js";

const desktopDirectory = path.dirname(fileURLToPath(import.meta.url));
const appDirectory = path.resolve(desktopDirectory, "..");
const dashboardDirectory = path.join(appDirectory, "dist", "client");
const inspectorDirectory = path.join(appDirectory, "inspector-portal", "dist");
const LOCAL_ORIGINS = new Map([
  [4175, "http://127.0.0.1:4175"],
  [4176, "http://127.0.0.1:4176"],
]);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

async function findStaticFile(root, requestPath) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(requestPath);
  } catch {
    return null;
  }

  const rootPath = path.resolve(root);
  const filePath = path.resolve(rootPath, `.${decodedPath}`);
  if (!filePath.startsWith(`${rootPath}${path.sep}`)) return null;
  try {
    const info = await fs.stat(filePath);
    return info.isFile() ? filePath : null;
  } catch {
    return null;
  }
}

async function serveFile(response, filePath, headOnly = false) {
  const body = headOnly ? undefined : await fs.readFile(filePath);
  applySecurityHeaders(response);
  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Length": (await fs.stat(filePath)).size,
    "Content-Type": contentTypes[path.extname(filePath).toLowerCase()] ?? "application/octet-stream",
  });
  response.end(body);
}

function applySecurityHeaders(response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
}

function rejectUntrustedRequest(request, response, port) {
  applySecurityHeaders(response);
  const expectedOrigin = LOCAL_ORIGINS.get(port);
  const expectedHost = new URL(expectedOrigin).host;
  const requestOrigin = request.headers.origin;

  if (request.headers.host !== expectedHost || (requestOrigin && requestOrigin !== expectedOrigin)) {
    response.writeHead(403, {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
    });
    response.end("Forbidden");
    return true;
  }

  return false;
}

async function serveDashboard(request, response) {
  applySecurityHeaders(response);
  if (rejectUntrustedRequest(request, response, 4175)) return;
  const requestUrl = new URL(request.url ?? "/", LOCAL_ORIGINS.get(4175));
  if (requestUrl.origin !== LOCAL_ORIGINS.get(4175)) {
    response.writeHead(400).end("Invalid request target");
    return;
  }
  if (request.method === "GET" || request.method === "HEAD") {
    const filePath = await findStaticFile(dashboardDirectory, requestUrl.pathname);
    if (filePath) {
      await serveFile(response, filePath, request.method === "HEAD");
      return;
    }
  }

  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  }
  const init = { method: request.method, headers };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = Readable.toWeb(request);
    init.duplex = "half";
  }

  const webResponse = await dashboardHandler.fetch(
    new Request(`http://127.0.0.1${requestUrl.pathname}${requestUrl.search}`, init),
    {},
    {},
  );
  const responseHeaders = Object.fromEntries(webResponse.headers.entries());
  response.writeHead(webResponse.status, responseHeaders);
  response.end(request.method === "HEAD" ? undefined : Buffer.from(await webResponse.arrayBuffer()));
}

async function serveInspector(request, response) {
  applySecurityHeaders(response);
  if (rejectUntrustedRequest(request, response, 4176)) return;
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405).end();
    return;
  }
  const requestUrl = new URL(request.url ?? "/", LOCAL_ORIGINS.get(4176));
  if (requestUrl.origin !== LOCAL_ORIGINS.get(4176)) {
    response.writeHead(400).end("Invalid request target");
    return;
  }
  const requestPath = requestUrl.pathname;
  const filePath = await findStaticFile(inspectorDirectory, requestPath === "/" ? "/index.html" : requestPath);
  const fallback = filePath ?? path.join(inspectorDirectory, "index.html");
  await serveFile(response, fallback, request.method === "HEAD");
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve();
    });
  });
}

export async function startDesktopServers() {
  const dashboardServer = createServer((request, response) => {
    void serveDashboard(request, response).catch((error) => {
      console.error("Dashboard request failed:", error);
      if (!response.headersSent) response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("The dashboard could not render. Try restarting Satark Drishti.");
    });
  });
  const inspectorServer = createServer((request, response) => {
    void serveInspector(request, response).catch((error) => {
      console.error("Inspector portal request failed:", error);
      if (!response.headersSent) response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("The inspector portal could not load. Try restarting Satark Drishti.");
    });
  });

  await listen(dashboardServer, 4175);
  try {
    await listen(inspectorServer, 4176);
  } catch (error) {
    dashboardServer.close();
    throw error;
  }

  return {
    dashboardUrl: "http://127.0.0.1:4175/",
    inspectorUrl: "http://127.0.0.1:4176/",
    close: () => {
      dashboardServer.close();
      inspectorServer.close();
    },
  };
}