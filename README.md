# Innogeeks backend

Express, Prisma, PostgreSQL, and Redis foundation for the Innogeeks Phase 1
recruitment platform. Product behavior is defined in `.codex/PRD.md`; the
module-by-module delivery order is in `.codex/IMPLEMENTATION_PLAN.md`.

The implemented Android app integration contract, including request/response
payloads, authentication flow, and error codes, is documented in
[`docs/APP_API_CONTRACT.md`](./docs/APP_API_CONTRACT.md).

## Local setup

1. Review the generated local `.env` and change its development password if desired.
2. Install dependencies with `pnpm install`.
3. Start PostgreSQL with `pnpm db:up`.
4. Apply the development migration with `pnpm prisma migrate dev`.
5. Generate Prisma Client with `pnpm db:generate`.
6. Run the API with `pnpm dev`.
7. In a second terminal, run the email worker with `pnpm worker:email`.

`GET /health` is a liveness check. `GET /ready` verifies PostgreSQL through
Prisma and returns `503` until the database is reachable. Product routes will
be added below `/api/v1/public`, `/api/v1/admin`, and `/api/v1/app`.

PostgreSQL is published only on `127.0.0.1:5433` by default, keeping it separate
from the existing local service that uses port `5432`.

Docker Compose also starts Mailpit for local email delivery. It listens for SMTP
on `127.0.0.1:1025` and exposes its local inbox/API on `127.0.0.1:8025`; it
never delivers messages to real recipients.

Authentication requires distinct `JWT_SECRET` and `VERIFICATION_HASH_SECRET`
values of at least 32 characters. To create the initial admin, set
`ADMIN_SEED_EMAIL` and `ADMIN_SEED_PASSWORD` locally, then run `pnpm admin:seed`.

Useful commands:

- `pnpm typecheck`
- `pnpm build`
- `pnpm db:validate`
- `pnpm db:logs`
- `pnpm db:down`

`pnpm db:down` preserves the local PostgreSQL and Redis volumes.
