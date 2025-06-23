# Development Setup

## Connect to Vercel

1. **Vercel CLI**: Install the Vercel CLI globally using `pnpm i -g vercel`.
2. **Login**: Run `vercel login` and follow the prompts to authenticate.
   a. login with GitHub
   b. use the centralized Vercel account for the project

3. **Link Project**: `vercel link --project findmydoc-portal --yes`
4. **Pull for Preview**: `vercel pull --environment preview --yes`

## Local Development

### Migrations

When running locally against Postgres, you can use either the automatic push adapter or explicit migrations:

- **Automatic push** (fast, non-production):

  The Postgres adapter default for development has `push: true`, so you can add or remove fields without generating migrations.

- **Explicit migrations** (recommended for CI/CD):

  1. Create a new migration: `pnpm payload migrate:create`
  2. Check status: `pnpm payload migrate:status`
  3. Apply pending migrations: `pnpm payload migrate`

### Seed

To populate your database with example content and a demo user, use the **Developer Dashboard** after logging in:

1. Start your website and log in at [http://localhost:3000/admin](http://localhost:3000/admin).
2. Navigate to the start page of the admin panel **Developer Dashboard**.
3. Click the **"Seed your database"** button to add example data.

> **Warning:** Seeding drops existing data and populates a fresh database. Only run on a new or disposable database.

### First Admin User

On first setup, create your initial admin user:

1. Visit [http://localhost:3000/admin/first-admin](http://localhost:3000/admin/first-admin)
2. Fill in your admin credentials
3. The page automatically redirects to login once an admin exists

> **Note:** This page is only accessible when no admin users exist in Supabase.

### Docker

Use Docker Compose to standardize your dev environment:

1. Copy environment variables: `cp .env.example .env`
2. Start services: `docker compose up`.

### Interactive Sessions

For interactive access (e.g., confirming schema changes):

- Payload shell:`docker compose run --rm --service-ports payload`
- Postgres shell:`docker compose run --rm postgres`

Alternativley use docker dektop or exec to access the containers and the shell inside the containers.
- **Postgres**: `docker exec -it <container_id> psql -U postgres`
- **Payload**: `docker exec -it <container_id> sh`

![Docker Dektop execexample](images/docker-desktop-exec-example.png)