import type { Signer } from '@solana/web3.js'
import type { Idl } from '@coral-xyz/anchor'

export interface SimulationResult {
  unitsConsumed: number
  priorityFeeMicroLamports: number
  totalFeeLamports: number
  accountWrites: Array<{ address: string; before: unknown; after: unknown }>
  returnData?: { type: string; value: unknown }
  logs: string[]
}

export interface SendResult {
  ok: boolean
  signature?: string
  explorerUrl?: string
  simulation: SimulationResult
  error?: DecodedAnchorError
}

export interface SimulateAndSendOpts {
  simulateOnly?: boolean
  confirm?: 'auto' | 'interactive'
  idl?: Idl
  unsafe?: { allowNonAllowlisted?: boolean; allowCuOverCap?: boolean }
}

export async function simulateAndSend(
  connection: Connection,
  tx: VersionedTransaction,
  signers: Signer[],
  opts: SimulateAndSendOpts = {},
): Promise<SendResult> {
  // --- Safety: allowlist check ---
  const programId = tx.message.staticAccountKeys[tx.message.compiledInstructions[0]?.programIdIndex ?? 0]?.toBase58()
  if (programId && !ALLOWLIST.has(programId) && !opts.unsafe?.allowNonAllowlisted) {
    throw new Error(`SafetyRailViolation: program ${programId} not in allowlist`)
  }

  // --- Simulate ---
  const sim = await connection.simulateTransaction(tx, {
    sigVerify: false,
    replaceRecentBlockhash: true,
    commitment: 'processed',
  })

  if (sim.value.err) {
    const error = opts.idl
      ? decodeAnchorError(extractErrorCode(sim.value.err), opts.idl, sim.value.logs ?? [])
      : { kind: 'unknown' as const, code: -1 }
    return {
      ok: false,
      simulation: emptySim(sim.value.logs ?? []),
      error,
    }
  }

  const unitsConsumed = sim.value.unitsConsumed ?? 200_000
  if (unitsConsumed > SAFETY_RAILS.maxComputeUnits && !opts.unsafe?.allowCuOverCap) {
    throw new Error(`SafetyRailViolation: simulated CU ${unitsConsumed} > cap ${SAFETY_RAILS.maxComputeUnits}`)
  }

  const simulation: SimulationResult = {
    unitsConsumed,
    priorityFeeMicroLamports: 0,  // populated after fee fetch
    totalFeeLamports: 0,
    accountWrites: [],
    logs: sim.value.logs ?? [],
  }

  if (opts.simulateOnly) {
    return { ok: true, simulation }
  }

  // --- Send ---
  tx.sign(signers)
  const sig = await connection.sendTransaction(tx, { skipPreflight: true, maxRetries: 0 })
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
  const result = await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    'confirmed',
  )

  if (result.value.err) {
    const error = opts.idl
      ? decodeAnchorError(extractErrorCode(result.value.err), opts.idl, simulation.logs)
      : { kind: 'unknown' as const, code: -1 }
    return { ok: false, signature: sig, simulation, error }
  }

  return {
    ok: true,
    signature: sig,
    explorerUrl: `https://solscan.io/tx/${sig}`,
    simulation,
  }
}

function emptySim(logs: string[]): SimulationResult {
  return { unitsConsumed: 0, priorityFeeMicroLamports: 0, totalFeeLamports: 0, accountWrites: [], logs }
}

function extractErrorCode(err: unknown): number {
  // Solana errors are tagged unions; extract InstructionError(_, Custom(code))
  if (typeof err === 'object' && err !== null && 'InstructionError' in err) {
    const ie = (err as { InstructionError: [number, unknown] }).InstructionError[1]
    if (typeof ie === 'object' && ie !== null && 'Custom' in ie) {
      return (ie as { Custom: number }).Custom
    }
  }
  return -1
}

// Utility kept exported for adapters that want to build budget ixns themselves.
export function computeBudgetIxs(units: number, priorityMicroLamports: number) {
  return [
    ComputeBudgetProgram.setComputeUnitLimit({ units }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityMicroLamports }),
  ]
}

export { TransactionMessage }
