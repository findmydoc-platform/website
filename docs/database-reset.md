# Database Reset Workflow

## Overview
This document describes how to reset the database schema and redeploy the entire schema from scratch. This process is destructive and should only be used when necessary, such as when the database schema needs to be completely rebuilt.

---

## Steps to Reset the Database

### 1. Run Locally
To reset the database locally, follow these steps:
1. Ensure your `DATABASE_URL` environment variable is set correctly.
2. Run the following command:
   ```bash
   pnpm reset:db
   ```
   This will drop all entities in the database and re-run all migrations from scratch.

---

### 2. Trigger via GitHub Actions
You can reset the database using GitHub Actions in two ways:

#### **Manual Trigger**
1. Navigate to **Actions > Reset Database > Run workflow**.
2. Start the workflow manually.

#### **CI/CD Workflow**
1. Trigger the deploy workflow with the `reset_database` input set to `true`:
   ```yaml
   workflow_dispatch:
     inputs:
       reset_database: true
   ```

---

## Best Practices
1. **Backup Before Reset**:
   - Always back up your database before running `migrate:fresh` in production.

2. **Test in Staging**:
   - Test the reset process in a staging environment before applying it to production.

3. **Avoid Frequent Resets**:
  - Database resets must be approved by Sebastian Schütze for both staging and production environments.
  - For production environments, additional justification is required before approval.
---

## Additional Notes
- The `migrate:fresh` command drops all entities and re-runs all migrations from scratch.
- This process is destructive and should only be used when absolutely necessary.
- For incremental updates, use the `migrate` command to apply pending migrations.