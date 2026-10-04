import http from "node:http";

const lanHost = process.env.SATARK_LAN_HOST;
if (!lanHost) throw new Error("SATARK_LAN_HOST is required.");

const routes = new Map([
  [5173, 4175],
  [5174, 4176],
]);
const servers = [];

const apiRewrite = `<script>
(() => {
  const localApi = /^https?:\\/\\/(?:127\\.0\\.0\\.1|localhost):8000(?=\\/|$)/i;
  const rewrite = (url) => {
    if (typeof url !== "string" || !localApi.test(url)) return url;
    return url.replace(localApi, "http://" + location.hostname + ":8000");
  };
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (input instanceof Request) {
      const url = rewrite(input.url);
      return nativeFetch(url === input.url ? input : new Request(url, input), init);
    }
    return nativeFetch(rewrite(input), init);
  };
  const nativeOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    return nativeOpen.call(this, method, rewrite(url), ...args);
  };
  const nativeSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value) {
    return nativeSetAttribute.call(
      this,
      name,
      name.toLowerCase() === "src" ? rewrite(value) : value
    );
  };
  const imageSource = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
  if (imageSource && imageSource.set) {
    Object.defineProperty(HTMLImageElement.prototype, "src", {
      ...imageSource,
      set(value) { imageSource.set.call(this, rewrite(value)); }
    });
  }
})();
</script>`;

function createBridge(port, targetPort) {
  const server = http.createServer((request, response) => {
    const upstreamHeaders = { ...request.headers, host: `127.0.0.1:${targetPort}` };
    delete upstreamHeaders.origin;
    delete upstreamHeaders["accept-encoding"];

    const upstream = http.request({
      hostname: "127.0.0.1",
      port: targetPort,
      method: request.method,
      path: request.url,
      headers: upstreamHeaders,
    }, (upstreamResponse) => {
      const headers = { ...upstreamResponse.headers };
      delete headers["content-length"];
      delete headers["content-encoding"];
      headers["access-control-allow-private-network"] = "true";
      response.writeHead(upstreamResponse.statusCode || 502, headers);

      if (!(headers["content-type"] || "").includes("text/html")) {
        upstreamResponse.pipe(response);
        return;
      }

      const chunks = [];
      upstreamResponse.on("data", (chunk) => chunks.push(chunk));
      upstreamResponse.on("end", () => {
        const html = Buffer.concat(chunks).toString("utf8");
        const insertionPoint = html.indexOf("<head>");
        const patched = insertionPoint < 0
          ? `${apiRewrite}${html}`
          : `${html.slice(0, insertionPoint + 6)}${apiRewrite}${html.slice(insertionPoint + 6)}`;
        response.end(patched);
      });
    });

    upstream.on("error", (error) => {
      console.error(`LAN bridge ${port} could not reach local app ${targetPort}: ${error.message}`);
      if (!response.headersSent) response.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Satark Drishti is starting or unavailable on the laptop.");
    });
    request.pipe(upstream);
  });

  server.listen(port, lanHost, () => {
    console.log(`LAN bridge listening at http://${lanHost}:${port} -> 127.0.0.1:${targetPort}`);
  });
  servers.push(server);
}

for (const [port, targetPort] of routes) createBridge(port, targetPort);

function closeServers() {
  for (const server of servers) server.close();
}

process.on("SIGINT", closeServers);
process.on("SIGTERM", closeServers);
