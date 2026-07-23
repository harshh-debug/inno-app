# Innogeeks backend

Express, Prisma, and PostgreSQL foundation for the Innogeeks platform. Product
models are deliberately deferred until the PRD schema decisions are made.

## Local setup

1. Review the generated local `.env` and change its development password if desired.
2. Install dependencies with `pnpm install`.
3. Start PostgreSQL with `pnpm db:up`.
4. Generate Prisma Client with `pnpm db:generate`.
5. Run the API with `pnpm dev`.

`GET /health` is a liveness check. `GET /ready` verifies PostgreSQL through
Prisma and returns `503` until the database is reachable.

PostgreSQL is published only on `127.0.0.1:5433` by default, keeping it separate
from the existing local service that uses port `5432`.

Useful commands:

- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm db:validate`
- `pnpm db:logs`
- `pnpm db:down`

`pnpm db:down` preserves the local PostgreSQL volume. Do not add a migration
until the product schema has been agreed.
