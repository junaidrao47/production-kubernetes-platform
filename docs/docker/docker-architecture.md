# Docker Architecture — This Project

## What's containerized and why
5 services, each its own container, each with one job:

| Service  | Image base       | Job |
|----------|-------------------|-----|
| postgres | postgres:16-alpine | persistent data (todos table) |
| redis    | redis:7-alpine     | cache + event queue |
| backend  | node:20-alpine     | Express API, talks to postgres + redis |
| worker   | node:20-alpine     | consumes redis queue, no API/ports |
| frontend | node:20 → nginx:alpine (multi-stage) | React build served as static files |

**Why separate containers instead of one big container running everything?**
Each service scales, restarts, and fails independently. If `worker` crashes processing a bad event, `backend` keeps serving requests. If I need 3 backend replicas later, I don't touch postgres. This is the same reasoning behind microservices — isolate failure domains and let each piece scale on its own axis.

## Why backend and worker are separate services (not one process)
Both read from Redis, but they're different **workloads**:
- `backend` is request/response — a client is waiting for a reply.
- `worker` is background/async — it does `BRPOP` in an infinite loop, no one's waiting.

Mixing them in one process means a slow queue job could block an HTTP request (Node is single-threaded per process). Splitting them means I can scale workers independently if the queue backs up, without touching API capacity.

## Why frontend uses a multi-stage Dockerfile
```
FROM node:20-alpine AS build   # has npm, vite, react — ~200MB+
RUN npm run build              # outputs static dist/

FROM nginx:alpine              # final image, ~20MB
COPY --from=build /app/dist /usr/share/nginx/html
```
The final image only ships nginx + the compiled static files. None of `node_modules`, source code, or the Node runtime make it into the shipped container — smaller image, smaller attack surface, faster deploy. This is the standard pattern for any framework that "builds" into static output (React, Vue, Angular).

## Why backend/worker Dockerfiles are single-stage
They **run** Node in production (`node src/index.js`), they don't compile to something else. There's nothing to discard, so a build stage would add complexity for no benefit.

## depends_on + healthcheck — why both
```yaml
backend:
  depends_on:
    postgres:
      condition: service_healthy
```
`depends_on` alone only waits for the container to **start**, not for Postgres to actually accept connections (Postgres takes a few seconds to initialize even after the process starts). The `healthcheck` (`pg_isready`, `redis-cli ping`) tells Compose "actually ready," and `condition: service_healthy` makes backend/worker wait for that, not just for the container to exist. Without this, backend would crash-loop on startup trying to connect to a Postgres that isn't accepting connections yet.

## Volumes — why only postgres has one
```yaml
volumes:
  pgdata:/var/lib/postgresql/data
```
Postgres is the only service with data that must survive a restart. Redis here is used as a cache + transient queue — losing it on restart is acceptable (cache repopulates, queue was near-empty anyway). Backend/worker/frontend are stateless by design — no volume needed, that's the whole point of a stateless service.

## What I'd say in an interview if asked "why not just run this without Docker?"
Local dev requires Node, Postgres, and Redis installed at matching versions on every machine. Docker Compose pins exact versions (`postgres:16-alpine`, `redis:7-alpine`, `node:20-alpine`) and gets a new teammate to `docker compose up` instead of a page of setup instructions — and the same images are what actually ship to production.