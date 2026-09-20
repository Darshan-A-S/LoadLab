import { createServer } from "node:http";

const PORT = process.env.PORT || 3000;

const routes = {
  GET: {
    "/": () => ({ message: "hello from loadlab test server", methods: Object.keys(routes) }),
    "/api/health": () => ({ status: "ok", uptime: process.uptime() }),
    "/api/users": () => ({ count: 3, users: ["alice", "bob", "carol"] }),
    "/api/slow": () => delay(500).then(() => ({ status: "done", waited: 500 })),
    "/api/error": () => { throw Object.assign(new Error("boom"), { status: 500 }); },
    "/api/json-large": () => ({ rows: Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `item-${i}` })) }),
    "/api/echo": (req) => ({ query: Object.fromEntries(new URL(req.url, "http://x").searchParams) }),
  },
  POST: {
    "/api/health": () => ({ status: "ok" }),
    "/api/echo": (req) => readBody(req).then((body) => ({ body })),
    "/api/create": () => ({ created: true, id: Date.now() }),
  },
  PUT: { "/api/echo": (req) => readBody(req).then((body) => ({ body, method: "PUT" })) },
  PATCH: { "/api/echo": (req) => readBody(req).then((body) => ({ body, method: "PATCH" })) },
  DELETE: { "/api/users/:id": (req) => ({ deleted: parseInt(urlParam(req, "/api/users/"), 10), method: "DELETE" }) },
  OPTIONS: { "/api/health": () => ({ status: "ok", method: "OPTIONS" }) },
  HEAD: { "/api/health": () => ({ status: "ok", method: "HEAD" }) },
};

function urlParam(req, prefix) {
  return new URL(req.url, "http://x").pathname.slice(prefix.length);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try { resolve(JSON.parse(data || null)); } catch { resolve(data); }
    });
  });
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204); return res.end();
  }

  const handler = routes[req.method]?.[new URL(req.url, "http://x").pathname] ||
                  routes[req.method]?.["/api/users/:id"];

  if (!handler) {
    res.writeHead(404, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "not found", path: new URL(req.url, "http://x").pathname }));
  }

  Promise.resolve()
    .then(() => handler(req))
    .then((json) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(json));
    })
    .catch((e) => {
      res.writeHead(e.status || 500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    });
}).listen(PORT, () => console.log(`LoadLab test server on http://localhost:${PORT}`));