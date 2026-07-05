# Docker Compose — This Project

## What problem compose solves here
5 services (postgres, redis, backend, worker, frontend) each need: the right image built, env vars set, ports published, a shared network, correct startup order, and a volume for postgres. Doing that with 5 separate `docker run` commands means retyping all of it every time and manually creating the network first. `docker-compose.yml` is that whole setup as one declarative file — `docker compose up --build` recreates the entire stack identically every time.

## Why `build.context` points to `../apps/backend` instead of `.`
```yaml
backend:
  build:
    context: ../apps/backend
    dockerfile: Dockerfile
```
`docker-compose.yml` lives in `docker/`, but each service's source code and Dockerfile live under `apps/<service>/`. `context` tells Docker "treat this folder as the root for `COPY` instructions in the Dockerfile" — so `COPY package*.json ./` inside `apps/backend/Dockerfile` copies from `apps/backend/`, not from `docker/`. Keeps compose config separate from app code, which is the folder-structure decision this whole project is built around.

## Why env vars are set in compose, not hardcoded in the Dockerfile
```yaml
backend:
  environment:
    PGHOST: postgres
    REDIS_URL: redis://redis:6379
```
The same backend image should work whether Postgres is named `postgres` (this compose file) or something else (a different environment, e.g. AWS RDS in production). Baking `PGHOST=postgres` into the Dockerfile would mean rebuilding the image every time the deployment target changes. Injecting it at `docker compose up` time means **one image, many environments** — the actual reason env vars exist as a Docker concept.

## Why `depends_on` has `condition: service_healthy`, not just a plain list
```yaml
backend:
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
```
A plain `depends_on: [postgres, redis]` only waits for those containers to **start** — Postgres's process can be running but not yet accepting connections for a few seconds. `condition: service_healthy` makes Compose wait for the `healthcheck` (`pg_isready`, `redis-cli ping`) to pass first. Without this, backend's first few connection attempts would fail before Postgres finished initializing — this is the actual bug this setting prevents, not a theoretical one.

## Why `worker` has no `ports:` entry
`postgres`, `redis`, `backend`, and `frontend` all get called *by something* (a client, the browser, each other) — that's what `ports:` (or the internal network) is for. `worker` is a pure consumer — it calls out to Redis, nothing ever calls into it. Publishing a port it doesn't listen on would be dead config. This maps directly to the architecture: worker isn't part of any request path.

## Why ports are written as `"3000:80"` for frontend but `"5000:5000"` for backend
`HOST:CONTAINER`. Nginx (serving the frontend) listens on port 80 inside its own container by default — I don't control that, it's nginx's convention — so I map my chosen host port (3000) to nginx's fixed port (80). Backend is my own Express app, so I made it listen on 5000 directly (`PORT=5000` env var) and mapped host 5000 to container 5000 for a 1:1 match — just a convention I chose, not a requirement.

## What `docker compose down -v` does that `docker compose down` doesn't
Plain `down` stops and removes containers + the network, but leaves the `pgdata` volume alone — todos survive. Adding `-v` also deletes named volumes, so the next `up` starts from a truly empty Postgres (which re-runs `init.sql`, since that only fires on an empty data directory). I use plain `down` day-to-day and `-v` specifically when I want to test the first-boot seeding behavior again.

## The one thing I'd highlight if asked "what would you change for production?"
Right now `frontend`'s React app calls `http://localhost:5000` directly from the browser (see `docker-networking.md`), and secrets like `PGPASSWORD` sit in plaintext in the compose file. For production I'd move those to a `.env` file (gitignored) referenced via `env_file:`, and put nginx in front of backend as a reverse proxy so the browser only ever talks to one origin.