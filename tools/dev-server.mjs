import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT || 4173);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

const server = createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);
  const requestedPath = decodeURIComponent(url.pathname);
  const filePath = resolvePath(requestedPath);

  if (!filePath) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  const target = getFileTarget(filePath);

  if (!target) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "Content-Type": mimeTypes[extname(target)] || "application/octet-stream"
  });
  createReadStream(target).pipe(response);
});

server.listen(port, () => {
  console.log(`http://localhost:${port}/`);
});

function resolvePath(pathname) {
  const cleaned = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const fullPath = resolve(join(root, cleaned));
  return fullPath === root || fullPath.startsWith(root + sep) ? fullPath : null;
}

function getFileTarget(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }

  const stats = statSync(filePath);

  if (stats.isDirectory()) {
    const indexPath = join(filePath, "index.html");
    return existsSync(indexPath) ? indexPath : null;
  }

  return stats.isFile() ? filePath : null;
}
