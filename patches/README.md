# Dependency override

## postcss-selector-parser

Tailwind Typography 0.5.20 pins postcss-selector-parser to vulnerable version
6.0.10. A parent-scoped override in `package.json` resolves that dependency to
7.1.6, the patched release for
[GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf).
Remove the override when Typography itself declares a patched parser version.

## Native Gallery upload provenance

`payload@3.90.2` and `@payloadcms/drizzle@3.90.2` carry the narrowly approved
[ADR 036](../docs/adrs/036-adr-clinic-authorization-mutation-ordering.md#bounded-native-media-initialization-retry)
Gallery exception. Keep both patch files and their lockfile hashes together.

Drizzle preserves the existing public `ValidationError` while recording the exact mapped PostgreSQL unique failure
in a private WeakMap. Its existing native rollback returns an opaque receipt only after the original session's rollback
completes. A frozen, non-writable, non-configurable `galleryUploadProvenance` metadata reader on the actual adapter
exposes only `readUniqueFailure(error)` and `readRollback(receipt)`. Each reader rejects foreign-adapter evidence.
This avoids relying on a second Drizzle peer-context module instance. There is no public attestation setter.

Payload records the exact native create invocation, original owner and effect phase. Existing cleanup preserves the
first positive nested receipt on the same failure. Owned `clinicMedia` creates check their original session identity
before upload, insert and commit; cleanup cannot adopt a foreign replacement owner. The readonly
`payload/gallery-upload-provenance` export supplies this bounded failure evidence to Website. The Website initializer
binds it to the exact authorization-control key before any attempt can repeat. Missing metadata fails closed.

These patches add no SQL, adapter data or transaction operation, isolation setting, independently committed initializer,
collection or public content field. Other operations retain their existing retry owners. A version upgrade must recheck
native phase dispatch, mapped error identity, positive rollback propagation, actual adapter peer resolution, the unchanged
three-upload storage regression, cold direct and multipart concurrency, and the refusal/access-order cases before
changing or removing these patches.
