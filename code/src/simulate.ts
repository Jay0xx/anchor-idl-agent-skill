import type { LoadedIdl } from './ingest.js'

export interface SimulateOptions {
  provider: AnchorProvider
  /** One or more instructions executed atomically. */
  instructions: TransactionInstruction[]
  payer: PublicKey
  /** Address lookup tables, for versioned tx that wouldn't otherwise fit. */
  addressLookupTableAccounts?: AddressLookupTableAccount[]
  /** Loaded IDLs keyed by programId, used for decoding + allowlist hash check. */
  loadedIdls?: Record<string, LoadedIdl>
  signers?: Signer[]
  /** Override compute unit limit (default: estimated by simulation). */
  computeUnitLimit?: number
  priorityFeeMicroLamports?: number
  /** If true, skip allowlist (dangerous — caller must justify). */
  unsafe?: { allowNonAllowlisted?: boolean; reason?: string }
}

export interface SimulationResult {
  ok: boolean
  computeUnitsConsumed?: number
  totalFeeLamports?: number
  logs: string[]
  error?: DecodedAnchorError | { raw: unknown }
  tx: VersionedTransaction
  blockhash: string
  lastValidBlockHeight: number
}

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  let last: unknown
  for (let i = 0; i <= retries; i++) {
    try { return await fn() } catch (e) { last = e; await new Promise(r => setTimeout(r, 300 * (i + 1))) }
  }
  throw last instanceof Error ? last : new Error(String(last))
}

function buildTx(
  payer: PublicKey, ixs: TransactionInstruction[], blockhash: string,
  alts: AddressLookupTableAccount[],
): VersionedTransaction {
  const msg = new TransactionMessage({ payerKey: payer, recentBlockhash: blockhash, instructions: ixs })
    .compileToV0Message(alts)
  return new VersionedTransaction(msg)
}

export async function simulate(opts: SimulateOptions): Promise<SimulationResult> {
  if (opts.instructions.length > SAFETY_RAILS.maxInstructionsPerTx) {
    throw new Error(`Too many instructions: ${opts.instructions.length} > ${SAFETY_RAILS.maxInstructionsPerTx}`)
  }

  const programIds = programIdsOfIxs(opts.instructions)
  const hashes: Record<string, string> = {}
  for (const [pid, l] of Object.entries(opts.loadedIdls ?? {})) hashes[pid] = l.sha256
  const allow = checkAllowlist(programIds, hashes)
  if (!allow.ok) {
    if (!opts.unsafe?.allowNonAllowlisted) {
      throw new Error('Allowlist violations: ' + JSON.stringify(allow.violations))
    }
    console.warn('[anchor-skill] ALLOWLIST BYPASSED:', JSON.stringify(allow.violations),
                 'reason:', opts.unsafe.reason ?? '(none provided)')
  }

  const conn: Connection = opts.provider.connection
  const alts = opts.addressLookupTableAccounts ?? []

  // Wrap with compute-budget instructions if requested.
  const ixs = [...opts.instructions]
  if (opts.computeUnitLimit) {
    if (opts.computeUnitLimit > SAFETY_RAILS.maxComputeUnits)
      throw new Error('computeUnitLimit exceeds maxComputeUnits')
    ixs.unshift(ComputeBudgetProgram.setComputeUnitLimit({ units: opts.computeUnitLimit }))
  }
  if (opts.priorityFeeMicroLamports) {
    if (opts.priorityFeeMicroLamports > SAFETY_RAILS.maxPriorityMicroLamports)
      throw new Error('priorityFee exceeds maxPriorityMicroLamports')
    ixs.unshift(ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: opts.priorityFeeMicroLamports,
    }))
  }

  const latest = await withRetry(() => conn.getLatestBlockhash('confirmed'))
  const tx = buildTx(opts.payer, ixs, latest.blockhash, alts)
  if (opts.signers?.length) tx.sign(opts.signers)

  const sim = await withRetry(() => conn.simulateTransaction(tx, {
    sigVerify: false, replaceRecentBlockhash: true, commitment: 'confirmed',
  }))
  const logs = sim.value.logs ?? []
  const cu = sim.value.unitsConsumed

  let fee: number | undefined
  try {
    const f = await conn.getFeeForMessage(tx.message, 'confirmed')
    fee = f.value ?? undefined
    if (fee !== undefined && fee / 1e9 > SAFETY_RAILS.maxTotalFeeSol)
      throw new Error(`Estimated fee ${fee} lamports exceeds maxTotalFeeSol`)
  } catch { /* fee estimation is best-effort */ }

  if (sim.value.err) {
    const decoded = decodeAnchorError(logs, { idls: Object.fromEntries(
      Object.entries(opts.loadedIdls ?? {}).map(([k, v]) => [k, v.idl])
    ) })
    return {
      ok: false, computeUnitsConsumed: cu ?? undefined, totalFeeLamports: fee,
      logs, error: decoded ?? { raw: sim.value.err }, tx,
      blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight,
    }
  }
  return {
    ok: true, computeUnitsConsumed: cu ?? undefined, totalFeeLamports: fee,
    logs, tx, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight,
  }
}

/**
 * Send a previously-simulated tx, refreshing the blockhash first so it
 * doesn't expire between simulation and submission.
 */
export async function sendSimulated(
  conn: Connection, tx: VersionedTransaction, signers: Signer[],
): Promise<string> {
  const latest = await withRetry(() => conn.getLatestBlockhash('confirmed'))
  tx.message.recentBlockhash = latest.blockhash
  tx.sign(signers)
  const sig = await conn.sendTransaction(tx, { skipPreflight: false, maxRetries: 3 })
  await conn.confirmTransaction({
    signature: sig, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight,
  }, 'confirmed')
  return sig
}
