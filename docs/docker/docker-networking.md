# Docker Networking — This Project

## Why I created `todo_net`
```yaml
networks:
  todo_net:
    driver: bridge
```
By default, Compose already puts all services in one project network — so technically I didn't *have* to declare this. I made it explicit for two reasons I'd say in an interview:
1. **Isolation** — only containers on `todo_net` can reach each other. If another project's containers are running on the same Docker host, they can't accidentally reach my postgres/redis.
2. **Clarity** — it's documented in the compose file what network everything sits on, instead of relying on Compose's implicit default.

## How `backend` finds `postgres` without an IP address
```js
// db.js
host: process.env.PGHOST || 'localhost',   // set to "postgres" in compose
```
Docker's bridge network runs an embedded DNS server. Every service name in `docker-compose.yml` becomes a resolvable hostname **on that network only**. So `postgres` isn't a placeholder — it's literally the DNS name that resolves to that container's internal IP (something like `172.20.0.2`, which I never have to know or hardcode). Same for `redis://redis:6379` in `REDIS_URL`.

If I moved backend to a different network without postgres on it, `postgres` would fail to resolve — the name only works because Compose put both containers on `todo_net`.

## Why `frontend` can talk to `backend` — but actually, it can't (on purpose)
This is the trick question. Looking at `app.js`/`api.js`:
```js
const API_BASE = 'http://localhost:5000';
```
The React app doesn't call `http://backend:5000` — it calls `localhost:5000`. That's because **the fetch() runs in the user's browser, not inside the frontend container.** The browser has no idea Docker or `todo_net` exists; it only knows `localhost` and whatever ports are published on the host machine.

So the actual flow is:
```
Browser (host machine) → localhost:5000 → published port → backend container
```
This works because docker-compose.yml publishes the port:
```yaml
backend:
  ports:
    - "5000:5000"
```

## Why the browser *can't* use `http://backend:5000` directly
`backend` is a Docker-internal DNS name — it only resolves **inside `todo_net`**, i.e., inside other containers. The browser is a process running on my host OS (or the user's laptop), completely outside Docker's network namespace. It has no route to resolve `backend` to anything. Trying it gives `DNS_PROBE_FINISHED_NXDOMAIN`, not a connection error — the name doesn't exist from that vantage point at all.

**Rule of thumb I use:** container-to-container calls use service names (`postgres`, `redis`) because both sides are inside `todo_net`. Browser-to-container calls must use `localhost` + published port, because the browser is outside Docker entirely.

## Why nginx (frontend) doesn't need to know about `backend`'s name either
`frontend`'s nginx container only serves static files (JS/CSS/HTML) — it never makes a network call to `backend` itself. The actual API calls happen later, from the browser, after the JS has downloaded. So frontend and backend don't need to be on the same network at all for this to work (though they are, since Compose puts everything on `todo_net` by default) — nginx's only job is handing files to the browser.

## What would change this answer
If I put nginx in front of backend as a **reverse proxy** (`location /api { proxy_pass http://backend:5000; }`), then nginx itself — running inside Docker — could use the service name `backend`, because that proxy_pass call happens container-to-container. The browser would then only ever talk to `localhost:3000/api/...` and never need to know backend's address at all. That's the standard production fix for CORS + hardcoded `localhost:5000` URLs, and a natural "what would you improve" answer in an interview.