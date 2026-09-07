# Search removal rollout

## Application stage

The application does not register the Payload Search collection or its write hooks. Public articles use Posts directly. Search endpoints, admin actions, generated types, permissions and package dependencies are absent.

The compatibility migration records the target Payload schema without dropping physical storage. Both the preceding application and the plugin-free application can run against this database. Historical migrations remain replayable.

Cache classification is `public-cached`. Existing Post events invalidate entity, slug, collection, posts-list, home, partners-clinics and posts-sitemap tags, plus bounded `/posts` and post-detail paths. Draft and preview reads remain private-live. No invalidation semantics change.

Run the focused integration lifecycle, plugin access, cache policy and migration-detection tests, then `pnpm check`, `pnpm format` and `pnpm build`. The `admin.posts.publish-lifecycle` journey runs in the platform regression lane and requires the existing test admin credentials. It verifies persisted fields, published versions, anonymous detail/list/API delivery, actual hero loading, draft revisions, republishing and withdrawal. It creates scoped article/media/taxonomy fixtures and never creates authentication users.

## Contract stage

`20260907_092854_remove_search_contract` implements the destructive step. Its PostgreSQL integration tests cover each target's unexpected dependencies, retained source rows, shared locks, preference-key boundaries and fail-closed rollback.

Ship the destructive migration in a separate PR and platform release after the application stage has been verified. Do not deploy an older Search-enabled application after this migration.

Before approval:

1. Verify the running deployment commit is plugin-free and its publishing journey passes.
2. Confirm backup/PITR recovery and record row counts for `search`, `search_categories`, `search_rels`, Search document locks and Search preferences. Record source Post, Category and Media counts separately.
3. Rehearse the migration against a disposable restore. CI never queries production.

The contract removes the three Search tables, their owned indexes/sequences, the Search foreign key/index/column on `payload_locked_documents_rels`, and only Search-specific locks/preferences. Shared metadata and all source documents remain intact. Unexpected dependencies stop the migration; no `CASCADE` is used.

After migration, verify retired storage is absent, source counts are unchanged, and repeat the publishing journey. The destructive migration has no data-restoring rollback. Restore the pre-contract backup or roll forward. Production execution requires explicit approval independently of PR merge.
