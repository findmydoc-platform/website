# Category title localization

[Website #2415](https://github.com/findmydoc-platform/website/issues/2415) tracks this cutover. Verification has run on disposable local databases. Production verification is pending.

## Switch and verification

Website release owners verify the switch.

1. Pause category editing, then apply the category title migration before switching the app. The old app can read the shared title during the switch. Category inserts and updates require the new app after migration.
2. Verify category counts, IDs, post assignments, and shared slugs. Check that verified English titles populate the English locale and that titles of unknown language remain visible until editors supply a localized title.
3. Check title and language on German and English posts, plus category search in the CMS, before resuming editing. The localized title rows become the source of truth. The shared column mirrors English when available and German otherwise.

The local rehearsal preserved two legacy categories and their post assignments. It verified the old reader, rejection of old title writes, and protection of a saved German title during rollback.

## Rollback

An app-only rollback restores old read behavior. To resume editing with the old app, revert the schema before a non-English title has been saved. After saving a non-English title, roll forward or recover from a compatible backup. The schema rollback locks both category tables before checking for translations.

## Open cleanup

- [ ] Website release owners remove `categories.title` and the code that mirrors titles into it in a later release. Proceed after the old app is retired, no active app reads the column, and backup and rollback checks have passed. Retain the category search projection and revision guard while they are in use. Record the cleanup migration and its verification here.
- [ ] Use this case to evaluate an AI-assisted reminder for open cutover cleanup.
