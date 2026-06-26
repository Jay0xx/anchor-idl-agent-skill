# Known Limitations & Trust Assumptions

This skill is **not a substitute for an audit**. Read this before using it
against real funds.

## 1. Data sources can lie or disappear
- On-chain IDLs are optional metadata and may be missing, stale, or set by
  an attacker after an upgrade.
- GitHub-hosted IDLs can be rewritten, force-pushed, or 404.
- Public RPC endpoints rate-limit, return stale data, and time out.
  `loadIdl` retries with backoff but **the caller should configure a paid
  RPC for anything beyond demos.**

## 2. Trust model
- IDL fetching is now hash-pinnable via `expectedSha256` and
  authority-pinnable via `expectedUpgradeAuthority`. **Use both** for any
  programId you treat as trusted. Without them, a silent program upgrade
  can change account ordering or seeds and the skill will not notice.
- The `ALLOWLIST` in `safety.ts` is manually curated. If your fork goes
  unmaintained, treat unverified programs as untrusted. The allowlist also
  supports IDL-hash pinning (`idlSha256` per entry) — prefer pinned entries
  over wildcard (`'*'`).
- The skill never holds keys. You must supply your own `AnchorProvider`
  with whatever signer / hardware-wallet / KMS adapter you trust.

## 3. Functional scope
- **Anchor-only.** Native programs, non-Anchor programs, sBPF binaries
  without IDLs are out of scope.
- Simulation ≠ landing on chain. `sendSimulated` refreshes the blockhash
  before submission but cannot eliminate races against on-chain state.
- The error decoder reads the **last** `AnchorError` line in the logs
  (innermost CPI) and looks the code up against both the framework table
  and the IDL's `errors`. Custom codes outside the IDL still surface as
  `UnknownError`.
- `simulate` accepts multi-instruction atomic flows and Address Lookup
  Tables for versioned transactions; ALTs must be passed explicitly.

## 4. What you still have to do yourself
- Audit each adapter before adding it to the allowlist.
- Keep `ALLOWLIST` entries' `idlSha256` in sync with reality. A bumped
  IDL hash without re-audit defeats the protection.
- Compose multi-program flows yourself; the skill will allowlist-check
  every `programId` in the bundle but doesn't reason about cross-program
  invariants.
- Confirm transaction landing using your own confirmation logic if
  `sendSimulated`'s defaults aren't enough.
