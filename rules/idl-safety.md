# IDL Safety Rules (must be followed by the agent)

1. **Never use an IDL without one of:**
   - `expectedSha256` pinned in the `loadIdl` call, OR
   - explicit user confirmation that this is an exploratory / read-only use.

2. **For any tx that moves value, also pin `expectedUpgradeAuthority`.**
   A silent upgrade with a changed authority MUST fail loudly.

3. **Allowlist is mandatory by default.** Bypass requires
   `unsafe.allowNonAllowlisted = true` with a human-readable `reason`.
   The bypass is logged.

4. **Allowlist hash pinning:** when adding a program, prefer setting
   `idlSha256` to the audited hash rather than `'*'`. Wildcard entries
   are legacy and should be migrated.

5. **Multi-instruction transactions:** every programId in the bundle is
   checked. Do not split a logically-atomic flow across separate
   transactions to dodge an allowlist failure.

6. **Decoder output is advisory.** The decoder reports the innermost
   `AnchorError`. Treat the framework code table as a starting point, not
   ground truth — always consult the program's IDL `errors` array when
   available.

7. **Simulation does not guarantee success.** Always refresh blockhash and
   re-simulate if the user delays signing.
