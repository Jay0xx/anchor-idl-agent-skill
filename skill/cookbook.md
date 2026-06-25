# Cookbook

Common end-to-end recipes. Each shows the full flow: ingest → resolve → simulate → confirm → send.

## Swap USDC → SOL on Jupiter

```ts
const quote = await jupiter.quote({
  inputMint:  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  outputMint: 'So11111111111111111111111111111111111111112',  // SOL
  amount:     100_000_000,  // 100 USDC (6 decimals)
  slippageBps: 50,
})
const { tx } = await jupiter.swap({ quote, user: wallet.publicKey })
await simulateAndSend(connection, tx, wallet, { confirm: 'interactive' })
```

## Lend USDC into a Kamino reserve

```ts
const { tx } = await kamino.depositReserveLiquidity({
  market: 'MAIN_MARKET',
  reserve: 'USDC',
  amount: 1_000_000_000,  // 1000 USDC
  user: wallet.publicKey,
})
await simulateAndSend(connection, tx, wallet)
```

## Open a 5× long SOL-PERP on Drift

```ts
await drift.depositCollateral({ market: 'USDC', amount: 1_000_000_000 })
const { tx } = await drift.openPerpOrder({
  market: 'SOL-PERP',
  direction: 'long',
  baseSize: 5,              // 5× notional vs collateral
  orderType: 'limit',
  limitPrice: 142.30,
  reduceOnly: false,
})
await simulateAndSend(connection, tx, wallet)
```

## Propose a Drift trade via a Squads vault

```ts
const { tx } = await drift.openPerpOrder(
  { market: 'SOL-PERP', direction: 'long', baseSize: 5, orderType: 'market' },
  { proposeVia: 'squads', vault: vaultPda, proposer: wallet.publicKey },
)
// Produces: Squads vaultTransactionCreate + proposalCreate + proposalApprove
await simulateAndSend(connection, tx, wallet)
```

## Call an arbitrary unknown Anchor program

```ts
const idl = await loadIdl({ programId: new PublicKey('Az9P…uWqx') })
const tools = buildToolSchema(idl)

// Hand to your LLM (Anthropic/OpenAI tool-call API):
const response = await anthropic.messages.create({ model: 'claude-3-5-sonnet', tools, ... })

// When the model emits a tool_use, route through the toolkit:
const { tx } = await invokeTool(idl, response.tool_use, { user: wallet.publicKey })
await simulateAndSend(connection, tx, wallet)
```

## Decode a failed transaction

```ts
const decoded = await decodeFailedTx(connection, '4xK2…signature')
console.log(decoded.error.name)          // e.g. "InsufficientCollateral"
console.log(decoded.error.sourceLine)    // e.g. "deposit.rs:218"
console.log(decoded.error.likelyFix)     // heuristic suggestion
```
