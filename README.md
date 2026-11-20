# Dockerized Microservices — Todo App

A full-stack todo application deliberately split into independent, containerized
services to practice real container-orchestration patterns: service isolation,
an event-driven background worker, graceful shutdown, and hardened images.

Runs on a single machine with Docker Compose. It is **not** a Kubernetes
deployment (yet) — see [What's next](#whats-next).

## Architecture

```
 ┌───────────┐     HTTP      ┌───────────┐     SQL      ┌────────────┐
 │  frontend │ ────────────▶ │  backend  │ ───────────▶ │  Postgres  │
 │ React+Vite│               │  Express  │              └────────────┘
 └───────────┘               └─────┬─────┘
                                   │ publishes events
                                   ▼
                             ┌───────────┐   brPop    ┌───────────┐
                             │   Redis   │ ◀───────── │  worker   │
                             │  (queue)  │            │ (consumer)│
                             └───────────┘            └───────────┘
```

Five services on an isolated Docker network: a React/Vite frontend, an Express
REST API, a background worker, Postgres, and Redis.

## What it demonstrates

- **Event-driven worker** — the backend pushes `TODO_CREATED/UPDATED/DELETED`
  events onto a Redis list; the worker consumes them with a blocking pop
  (`brPop`), the same decoupling pattern used for notifications, analytics, or
  syncing to other systems.
- **Graceful shutdown** — backend and worker both trap `SIGTERM`/`SIGINT`,
  finish in-flight work, and close Redis/DB connections before exiting (so a
  container restart never drops a connection mid-request).
- **Hardened containers** — images run as a non-root `node` user, install
  production-only dependencies (`npm ci --omit=dev`), and set
  `NODE_ENV=production`.
- **Service isolation** — services talk over a dedicated Docker network; only
  the frontend and API are exposed.
- **Persistent state** — Postgres with an init SQL script and a named volume.

## Tech stack

Node.js · Express · React (Vite) · Postgres 16 · Redis 7 · Docker Compose

## Run it locally

```bash
cd docker
docker compose up --build
```

Then open the frontend (port shown in compose output). Create a todo and watch
the worker log the event it picked up off the Redis queue.

## Repository layout

```
apps/
  backend/    Express REST API (Postgres + Redis, graceful shutdown)
  worker/     Redis queue consumer
  frontend/   React + Vite UI
docker/       docker-compose.yml + Postgres init
docs/         notes on Docker, networking, image optimization, Kubernetes
```

## What's next

This is the single-host, Docker-Compose stage. The planned next step is a real
Kubernetes layer: Deployment/Service/ConfigMap/Secret per service, an HPA on the
backend, and a readiness/liveness probe wired to the graceful-shutdown handlers
already in place.
