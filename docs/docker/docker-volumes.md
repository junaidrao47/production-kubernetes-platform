# Docker Volumes — This Project

## Where volumes appear in this project
```yaml
postgres:
  volumes:
    - pgdata:/var/lib/postgresql/data
    - ./postgres/init.sql:/docker-entrypoint-initdb.d/init.sql

volumes:
  pgdata:
```
Two different *kinds* of mount, doing two different jobs.

## `pgdata` — a named volume (persistent data)
Without this line, Postgres writes its data files to the container's writable layer. `docker compose down` (or any container removal) deletes that layer — **all todos would vanish** every time the container is recreated.

`pgdata` is a named volume — Docker manages its storage on the host, outside any container's lifecycle. The container gets removed and rebuilt constantly (new image, restart, `up --build`), but `pgdata` persists across all of that until I explicitly run `docker compose down -v` (the `-v` deletes volumes too — I use this when I want a clean-slate DB for testing).

**Interview framing:** "state lives in the volume, not the container." Containers are meant to be disposable; volumes are where the disposable/durable line gets drawn.

## `./postgres/init.sql:...` — a bind mount (one-way seed script)
This maps a file from my host filesystem (`docker/postgres/init.sql`) into the container at the exact path Postgres's official image scans on **first boot only**: `/docker-entrypoint-initdb.d/`. Any `.sql` file there gets executed once, when the data directory is empty.

That's why `init.sql` in this project both creates the `todos` table and seeds two sample rows — it's not run on every restart, only the very first time (when `pgdata` has no data yet). If I already have data in `pgdata` and change `init.sql`, nothing happens until I wipe the volume — a common gotcha I'd mention if asked "why isn't my schema change showing up?"

## Why redis has no volume in this project
Redis here is a cache (`todos:all`, 30s TTL) and a transient event queue (`todo_events`) for the worker. Neither needs to survive a restart:
- Cache: repopulates from Postgres on the next `GET /api/todos` — that's the whole point of a cache.
- Queue: if a create/update/delete event is lost on restart, the source of truth (Postgres) already has the write; only the worker's *notification* of it is lost, which is acceptable for this demo (logging, not billing).

If this were a payments queue instead of a demo notification queue, I'd add Redis persistence (AOF/RDB) or move to a durable broker — worth saying out loud in an interview to show I know the tradeoff, not just the current config.

## Why backend/worker/frontend have zero volumes
They're stateless by design — no data they generate needs to outlive the container. Backend holds no state between requests (state lives in Postgres/Redis). This is deliberate: stateless services can be killed, restarted, or scaled to N replicas with zero data-loss risk, which is exactly why only the *data* services (postgres) need a volume.

## The one-sentence answer if asked "what's the difference between your two volume types?"
Named volume (`pgdata`) = Docker-managed, durable, survives container recreation, used for real state. Bind mount (`init.sql`) = a host file made visible inside the container, used here for one-time initialization, not ongoing state.