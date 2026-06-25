# Simulation and Sending

Every transaction this skill produces goes through simulate → confirm → send. No exceptions.

## Simulation parameters

```ts
const sim = await connection.simulateTransaction(tx, {
  sigVerify: false,              // signers may not be present yet
  replaceRecentBlockhash: true,  // avoid blockhash drift between sim and send
  commitment: 'processed',
  accounts: { encoding: 'base64', addresses: [...writableAccounts] },
})
```

### What to extract from the sim result

| Field | Used for |
|---|---|
| `err` | If non-null → decode via [`error-decoding.md`](error-decoding.md) and STOP |
| `unitsConsumed` | Set `ComputeBudgetProgram.setComputeUnitLimit` to `unitsConsumed × 1.1` |
| `returnData` | Decode using the IDL's return type for the instruction (Anchor 0.30+) |
| `accounts` | Diff vs. pre-state → show user what each writable account will look like after |
| `logs` | Search for `Program log:` lines to surface deliberate program output |

## Compute-unit budgeting

Always include both compute-budget instructions, sized from the simulation:

```ts
ComputeBudgetProgram.setComputeUnitLimit({ units: Math.ceil(sim.unitsConsumed * 1.1) })
ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFee })
```

Where `priorityFee` comes from:
```ts
const fees = await connection.getRecentPrioritizationFees({ lockedWritableAccounts: [...writableAccounts] })
const p75 = percentile(fees.map(f => f.prioritizationFee), 0.75)
const priorityFee = Math.min(Math.ceil(p75 * 1.5), SAFETY_RAILS.maxPriorityMicroLamports)
```

Cap per [`safety-rails.md`](safety-rails.md).

## Versioned transactions and ALTs

Default to v0 transactions. If the program is known to publish address lookup tables (Jupiter, Drift), fetch them:

```ts
const lookupTableAccount = (await connection.getAddressLookupTable(altAddress)).value
const message = new TransactionMessage({ payerKey, recentBlockhash, instructions }).compileToV0Message([lookupTableAccount])
const tx = new VersionedTransaction(message)
```

## Sending with safe retry

Solana's mainnet drops transactions. The retry pattern:

```ts
async function safeSend(tx, signer, connection) {
  const sig = await connection.sendTransaction(tx, { skipPreflight: true, maxRetries: 0 })
  // Skip preflight — we already simulated. maxRetries:0 — we control retry.
  const blockhash = tx.message.recentBlockhash
  const lastValidBlockHeight = (await connection.getLatestBlockhash()).lastValidBlockHeight

  const result = await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    'confirmed',
  )
  if (result.value.err) throw new TxFailed(sig, result.value.err)
  return sig
}
```

If `confirmTransaction` times out: re-simulate with the new blockhash, surface to user with the **old signature** (it may have landed late), do NOT auto-resend.

## Output shape

Every `simulateAndSend` returns this canonical object:

```ts
{
  ok: boolean,
  signature?: string,
  explorerUrl?: string,
  simulation: {
    unitsConsumed: number,
    priorityFeeMicroLamports: number,
    totalFeeLamports: number,
    accountWrites: Array<{ address: string, before: object, after: object }>,
    returnData?: { type: string, value: unknown },
    logs: string[],
  },
  error?: DecodedAnchorError,
}
```

This is what the agent surfaces to the user before asking for send confirmation.
