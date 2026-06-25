---
name: ingest-idl
description: Fetch an Anchor IDL from a program ID, GitHub URL, or local path; parse it; emit a JSON tool catalogue.
---

# /ingest-idl

`/ingest-idl <source>`

Where `<source>` is one of:

- Program ID (base58, 32–44 chars) → on-chain `AnchorProvider.fetchIdl`
- GitHub raw URL → `https://raw.githubusercontent.com/...`
- Local file path → `./path/to/idl.json`
- Anchor.toml-relative program name → resolves via the workspace

Procedure (from `skill/idl-ingestion.md`):

1. Detect source type and fetch.
2. Detect spec version (`metadata.spec` present → new, else legacy).
3. Verify by computing the discriminator of one well-known account type and matching against a mainnet account.
4. Cache by `(programId, sha256(idl))`.
5. Pass to `buildToolSchema(idl)` per `skill/tool-generation.md`.
6. Print a summary: program name, version, # instructions exposed, # accounts/types, sha.
7. Save the catalogue to `./.anchor-idl-cache/<programId>.tools.json`.
