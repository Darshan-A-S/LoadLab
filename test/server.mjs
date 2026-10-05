import { createServer } from "node:http";

const PORT = process.env.PORT || 3000;

// Rate limiter: 1-second window (default 100 req/sec)
const rateLimiter = {
  windowMs: 1000,
  windowStart: Date.now(),
  currentCount: 0,
  check(limit = 100) {
    const now = Date.now();
    if (now - this.windowStart >= this.windowMs) {
      this.windowStart = now;
      this.currentCount = 0;
    }
    this.currentCount++;
    const remaining = Math.max(0, limit - this.currentCount);
    if (this.currentCount > limit) {
      const retryAfter = Math.max(1, Math.ceil((this.windowMs - (now - this.windowStart)) / 1000));
      const err = new Error(`Rate limit exceeded: maximum ${limit} requests per second allowed`);
      err.status = 429;
      err.headers = {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": "0"
      };
      throw err;
    }
    return { limit, remaining };
  }
};

function handleRateLimited(req, res) {
  const url = new URL(req.url, "http://x");
  const queryLimit = parseInt(url.searchParams.get("limit"), 10);
  const limit = Number.isFinite(queryLimit) && queryLimit > 0 ? queryLimit : 100;

  const stats = rateLimiter.check(limit);
  if (res) {
    res.setHeader("X-RateLimit-Limit", String(stats.limit));
    res.setHeader("X-RateLimit-Remaining", String(stats.remaining));
  }
  return {
    status: "ok",
    message: "Request allowed by rate limiter",
    limit: stats.limit,
    remaining: stats.remaining
  };
}

const routes = {
  GET: {
    "/": () => ({
      message: "hello from loadlab test server",
      endpoints: [
        "/api/health",
        "/api/users",
        "/api/slow",
        "/api/error",
        "/api/json-large",
        "/api/echo",
        "/api/rate-limited (default 100 req/sec, customize with ?limit=N)"
      ]
    }),
    "/api/health": () => ({ status: "ok", uptime: process.uptime() }),
    "/api/users": () => ({ count: 3, users: ["alice", "bob", "carol"] }),
    "/api/slow": () => delay(500).then(() => ({ status: "done", waited: 500 })),
    "/api/error": () => { throw Object.assign(new Error("boom"), { status: 500 }); },
    "/api/json-large": () => ({ rows: Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `item-${i}` })) }),
    "/api/echo": (req) => ({ query: Object.fromEntries(new URL(req.url, "http://x").searchParams) }),
    "/api/rate-limited": (req, res) => handleRateLimited(req, res),
  },
  POST: {
    "/api/health": () => ({ status: "ok" }),
    "/api/echo": (req) => readBody(req).then((body) => ({ body })),
    "/api/create": () => ({ created: true, id: Date.now() }),
    "/api/rate-limited": (req, res) => handleRateLimited(req, res),
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

let hitCount = 0;

createServer((req, res) => {
  const count = ++hitCount;
  const start = Date.now();

  // Keep terminal responsive during high-volume benchmarks
  if (count <= 20 || count % 200 === 0) {
    console.log(`[Hit #${count}] ${req.method} ${req.url}`);
  }

  res.on("finish", () => {
    const elapsed = Date.now() - start;
    if (count <= 20 || count % 200 === 0) {
      console.log(`[Hit #${count}] -> ${res.statusCode} (${elapsed}ms)`);
    }
  });

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After");
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
    .then(() => handler(req, res))
    .then((json) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(json));
    })
    .catch((e) => {
      res.writeHead(e.status || 500, {
        "Content-Type": "application/json",
        ...(e.headers || {})
      });
      res.end(JSON.stringify({ error: e.message, status: e.status || 500 }));
    });
}).listen(PORT, () => console.log(`LoadLab test server on http://localhost:${PORT}`));