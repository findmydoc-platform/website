# Domain docs

This repository has one domain context.

Before work in a domain, read the relevant existing ADRs in `docs/adrs/`. Read `CONTEXT.md` if it exists. If `CONTEXT.md` does not exist, continue without treating its absence as an error.

Use glossary terms consistently. Surface conflicts with existing ADRs instead of silently overriding them.

`CONTEXT.md` is created lazily by domain modeling when a durable domain term is resolved. ADRs remain in `docs/adrs/`.
