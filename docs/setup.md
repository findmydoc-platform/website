<!-- filepath: docs/setup.md -->
# Setup & Workflows

## Local Development

### Migrations

When running locally against Postgres, you can use either the automatic push adapter or explicit migrations:

- **Automatic push** (fast, non-production):

  The Postgres adapter default for development has `push: true`, so you can add or remove fields without generating migrations.

- **Explicit migrations** (recommended for CI/CD):

  1. Create a new migration:
     ```bash
     pnpm payload migrate:create
     ```
  2. Check status:
     ```bash
     pnpm payload migrate:status
     ```
  2. Apply pending migrations:
     ```bash
     pnpm payload migrate
     ```

### Seed

To populate your database with example content and a demo user, use the **Developer Dashboard** after logging in:

1. Start your website and log in at [http://localhost:3000/admin](http://localhost:3000/admin).
2. Navigate to the start page of the admin panel **Developer Dashboard**.
3. Click the **"Seed your database"** button to add example data.

> **Warning:** Seeding drops existing data and populates a fresh database. Only run on a new or disposable database.


## Docker

Use Docker Compose to standardize your dev environment:

1. Copy environment variables:
   ```bash
   cp .env.example .env
   ```
2. Start services:
   ```bash
   docker compose up
   ```
3. In a separate terminal, login and create your first admin user at [http://localhost:3000/admin](http://localhost:3000/admin).


### Interactive Sessions

For interactive access (e.g., confirming schema changes):

- Payload shell:
  ```bash
  docker compose run --rm --service-ports payload
  ```

- Postgres shell:
  ```bash
  docker compose run --rm postgres
  ```
