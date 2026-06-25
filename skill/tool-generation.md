# Tool Schema Generation

Each Anchor instruction becomes one JSON-schema tool the LLM can call. Done right, this means an agent can call any program without any per-program TypeScript glue.

## Mapping rules

| IDL element | JSON-schema output |
|---|---|
| `instructions[i].name` | tool name: `<program_name>__<snake_case>` |
| `instructions[i].docs` | tool description |
| `instructions[i].args[]` | `properties` (one per arg) |
| Anchor primitive types (`u64`, `bool`, `publicKey`, …) | mapped per table below |
| `instructions[i].accounts[]` | grouped under `accounts` object; each typed by IDL signer / writable / pda flags |

## Type mapping

| Anchor type | JSON-schema |
|---|---|
| `u8` / `u16` / `u32` | `integer` (minimum 0, max per width) |
| `u64` / `u128` | `string` with `pattern: "^[0-9]+$"` (BigInts must be strings in JSON) |
| `i8`…`i64` | `integer` / `string` (i64 as string) |
| `bool` | `boolean` |
| `publicKey` | `string` with `pattern: "^[1-9A-HJ-NP-Za-km-z]{32,44}$"` |
| `string` | `string` |
| `bytes` | `string` with `contentEncoding: "base64"` |
| `vec<T>` | `array` of mapped `T` |
| `option<T>` | mapped `T` with `"nullable": true` (or `oneOf [null, T]`) |
| `array<T, N>` | `array` with `minItems: N, maxItems: N` |
| User-defined struct | `$ref` to a `#/$defs/<TypeName>` block emitted once at root |
| Enum (Anchor "kind") | `oneOf` of variant objects |

## Account grouping

Don't expose accounts as raw `PublicKey` strings. Group them by **who supplies the value**:

```json
{
  "accounts": {
    "auto":     ["systemProgram", "tokenProgram", "rent"],
    "resolved": ["vaultAuthority (PDA: seeds=['vault', user])"],
    "user":     ["user (signer)", "destinationAta"]
  }
}
```

The agent only ever needs to fill in `accounts.user.*`. Everything else is derived in [`account-resolution.md`](account-resolution.md).

## Why this works

LLM tool-calling has a known failure mode: the model invents PDAs or copies sysvar IDs from training data and gets them subtly wrong (`SysvarRent111…` typos are real). By **never exposing `auto` and `resolved` accounts to the model at all**, you remove the failure surface.

## Output format

The toolkit emits one **per-program tool catalogue** as a single JSON file:

```json
{
  "programId": "JUP6Lkb…",
  "programName": "jupiter",
  "idlSha256": "…",
  "tools": [
    { "name": "jupiter__route", "description": "…", "inputSchema": { … }, "accountResolutionPlan": { … } }
  ]
}
```

This catalogue is what gets passed to `tools:` in the Anthropic / OpenAI tool-calling APIs. See [`code/src/schema.ts`](../code/src/schema.ts).
