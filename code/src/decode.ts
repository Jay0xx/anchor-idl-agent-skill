import type { Idl } from '@coral-xyz/anchor'
export interface DecodedAnchorError {
  kind: 'custom' | 'anchor' | 'constraint' | 'unknown'
  code: number
  name?: string
  msg?: string
  sourceLine?: string
  causedByAccount?: string
  expected?: string
  actual?: string
  likelyFix?: string
}

const ANCHOR_BUILTIN: Record<number, { name: string; msg: string }> = {
  100: { name: 'InstructionMissing', msg: 'Instruction discriminator not provided' },
  101: { name: 'InstructionFallbackNotFound', msg: 'Fallback functions are not supported' },
  102: { name: 'InstructionDidNotDeserialize', msg: 'The program could not deserialize the given instruction' },
  103: { name: 'InstructionDidNotSerialize', msg: 'The program could not serialize the given instruction' },
  2000: { name: 'ConstraintMut', msg: 'A mut constraint was violated' },
  2001: { name: 'ConstraintHasOne', msg: 'A has_one constraint was violated' },
  2002: { name: 'ConstraintSigner', msg: 'A signer constraint was violated' },
  2003: { name: 'ConstraintRaw', msg: 'A raw constraint was violated' },
  2006: { name: 'ConstraintSeeds', msg: 'A seeds constraint was violated' },
  // ...full table in production
}

export function decodeAnchorError(code: number, idl: Idl, logs: string[]): DecodedAnchorError {
  if (code >= 6000) {
    const err = (idl as unknown as { errors?: Array<{ code: number; name: string; msg?: string }> }).errors
      ?.find(e => e.code === code)
    if (err) return { kind: 'custom', code, name: err.name, msg: err.msg, likelyFix: heuristicFix(err.name) }
  }

  if (ANCHOR_BUILTIN[code]) {
    return { kind: 'anchor', code, ...ANCHOR_BUILTIN[code] }
  }

  const constraintLog = logs.find(l => l.includes('AnchorError caused by account:'))
  if (constraintLog) return parseConstraintLog(constraintLog, logs)

  return { kind: 'unknown', code }
}

function parseConstraintLog(line: string, allLogs: string[]): DecodedAnchorError {
  const m = line.match(/caused by account: (\S+)\. Error Code: (\w+)\. Error Number: (\d+)/)
  if (!m) return { kind: 'constraint', code: -1 }
  const [, account, name, codeStr] = m
  const code = Number(codeStr)
  const leftIdx = allLogs.findIndex(l => l.includes('Left:'))
  const expected = leftIdx >= 0 ? allLogs[leftIdx + 1] : undefined
  const actual   = leftIdx >= 0 ? allLogs[leftIdx + 3] : undefined
  return { kind: 'constraint', code, name, causedByAccount: account, expected, actual }
}

function heuristicFix(errName: string): string {
  const HINTS: Record<string, string> = {
    InsufficientCollateral: 'Reduce amount, or wait for vault capacity to free up.',
    SlippageExceeded:       'Increase slippageBps or retry — price moved during simulation.',
    Unauthorized:           'Signer is not the expected authority for this account.',
    AccountAlreadyInitialized: 'Account exists — call the update variant instead of init.',
  }
  return HINTS[errName] ?? ''
}

/**
 * Convenience: given a transaction signature, fetch its logs, identify the
 * failing program, load its IDL (on-chain), and decode the error.
 */
export async function decodeFailedTx(connection: Connection, signature: string): Promise<{
  signature: string
  programId: string
  error: DecodedAnchorError
}> {
  const tx = await connection.getTransaction(signature, { maxSupportedTransactionVersion: 0 })
  if (!tx) throw new Error('Tx not found')
  const programId = tx.transaction.message.staticAccountKeys[0]?.toBase58() ?? ''
  const code = (() => {
    const e = tx.meta?.err
    if (typeof e === 'object' && e !== null && 'InstructionError' in e) {
      const ie = (e as { InstructionError: [number, unknown] }).InstructionError[1]
      if (typeof ie === 'object' && ie !== null && 'Custom' in ie) return (ie as { Custom: number }).Custom
    }
    return -1
  })()
  // Loading IDL requires a provider; in production accept one as arg.
  // Here we return a partial decode based on logs only.
  return {
    signature,
    programId,
    error: { kind: 'unknown', code, msg: tx.meta?.logMessages?.find(l => l.includes('Error')) },
  }
}

void loadIdl  // re-exported for adapters
