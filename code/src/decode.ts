import { AnchorProvider, Idl } from '@coral-xyz/anchor'
import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js'
import { loadIdl, LoadedIdl, SourceLocation } from './ingest.js'

/** Anchor's full framework error table (0x1770 .. 0x17ff range etc).
 *  Source: https://github.com/coral-xyz/anchor/blob/master/lang/src/error.rs */
export const ANCHOR_FRAMEWORK_ERRORS: Record<number, { name: string; msg: string }> = {
  0x64: { name: 'InstructionMissing',            msg: 'Instruction discriminator not provided' },
  0x65: { name: 'InstructionFallbackNotFound',   msg: 'Fallback functions are not supported' },
  0x66: { name: 'InstructionDidNotDeserialize',  msg: 'The program could not deserialize the given instruction' },
  0x67: { name: 'InstructionDidNotSerialize',    msg: 'The program could not serialize the given instruction' },
  0xc8: { name: 'IdlInstructionStub',            msg: 'The program was compiled without idl instructions' },
  0xc9: { name: 'IdlInstructionInvalidProgram',  msg: 'Invalid program given to the IDL instruction' },
  0xca: { name: 'IdlAccountNotEmpty',            msg: 'IDL account must be empty in order to resize' },
  0x12c: { name: 'EventInstructionStub',         msg: 'Program was compiled without event-cpi feature' },
  0x1770: { name: 'ConstraintMut',               msg: 'A mut constraint was violated' },
  0x1771: { name: 'ConstraintHasOne',            msg: 'A has_one constraint was violated' },
  0x1772: { name: 'ConstraintSigner',            msg: 'A signer constraint was violated' },
  0x1773: { name: 'ConstraintRaw',               msg: 'A raw constraint was violated' },
  0x1774: { name: 'ConstraintOwner',             msg: 'An owner constraint was violated' },
  0x1775: { name: 'ConstraintRentExempt',        msg: 'A rent exempt constraint was violated' },
  0x1776: { name: 'ConstraintSeeds',             msg: 'A seeds constraint was violated' },
  0x1777: { name: 'ConstraintExecutable',        msg: 'An executable constraint was violated' },
  0x1778: { name: 'ConstraintState',             msg: 'A state constraint was violated' },
  0x1779: { name: 'ConstraintAssociated',        msg: 'An associated constraint was violated' },
  0x177a: { name: 'ConstraintAssociatedInit',    msg: 'An associated init constraint was violated' },
  0x177b: { name: 'ConstraintClose',             msg: 'A close constraint was violated' },
  0x177c: { name: 'ConstraintAddress',           msg: 'An address constraint was violated' },
  0x177d: { name: 'ConstraintZero',              msg: 'Expected zero account discriminant' },
  0x177e: { name: 'ConstraintTokenMint',         msg: 'A token mint constraint was violated' },
  0x177f: { name: 'ConstraintTokenOwner',        msg: 'A token owner constraint was violated' },
  0x1780: { name: 'ConstraintMintMintAuthority', msg: 'A mint mint authority constraint was violated' },
  0x1781: { name: 'ConstraintMintFreezeAuthority', msg: 'A mint freeze authority constraint was violated' },
  0x1782: { name: 'ConstraintMintDecimals',      msg: 'A mint decimals constraint was violated' },
  0x1783: { name: 'ConstraintSpace',             msg: 'A space constraint was violated' },
  0x1bbc: { name: 'AccountDiscriminatorAlreadySet',  msg: 'The account discriminator was already set' },
  0x1bbd: { name: 'AccountDiscriminatorNotFound',    msg: 'No 8 byte discriminator was found on the account' },
  0x1bbe: { name: 'AccountDiscriminatorMismatch',    msg: '8 byte discriminator did not match what was expected' },
  0x1bbf: { name: 'AccountDidNotDeserialize',    msg: 'Failed to deserialize the account' },
  0x1bc0: { name: 'AccountDidNotSerialize',      msg: 'Failed to serialize the account' },
  0x1bc1: { name: 'AccountNotEnoughKeys',        msg: 'Not enough account keys given to the instruction' },
  0x1bc2: { name: 'AccountNotMutable',           msg: 'The given account is not mutable' },
  0x1bc3: { name: 'AccountOwnedByWrongProgram',  msg: 'The given account is owned by a different program than expected' },
  0x1bc4: { name: 'InvalidProgramId',            msg: 'Program ID was not as expected' },
  0x1bc5: { name: 'InvalidProgramExecutable',    msg: 'Program account is not executable' },
  0x1bc6: { name: 'AccountNotSigner',            msg: 'The given account did not sign' },
  0x1bc7: { name: 'AccountNotSystemOwned',       msg: 'The given account is not owned by the system program' },
  0x1bc8: { name: 'AccountNotInitialized',       msg: 'The program expected this account to be already initialized' },
  0x1bc9: { name: 'AccountNotProgramData',       msg: 'The given account is not a program data account' },
  0x1bca: { name: 'AccountNotAssociatedTokenAccount', msg: 'The given account is not the associated token account' },
  0x1f40: { name: 'StateInvalidAddress',         msg: 'The given state account does not have the correct address' },
  0x2328: { name: 'Deprecated',                  msg: 'The API being used is deprecated' },
}

export interface DecodedAnchorError {
  programId: string
  code: number
  name: string
  msg: string
  origin: 'idl' | 'framework' | 'unknown'
  instructionIndex?: number
  failedAccount?: string
  raw: string
  /** Source location of the error declaration in the program crate, if available. */
  source?: SourceLocation
}

export interface DecodeContext {
  /** programId -> idl. Used to enrich errors with custom error names. */
  idls?: Record<string, Idl>
  /** programId -> error code -> source location. */
  sourceMaps?: Record<string, Record<number, SourceLocation>>
  /** Last failing instruction index from `InstructionError`, if you parsed it. */
  instructionIndex?: number
  /** Resolved programId for that instruction. */
  programId?: string
}

const ANCHOR_LOG_RE = /AnchorError(?: caused by account: (\S+))?(?: occurred in file [^.]+\. Error Code: (\w+)\. Error Number: (\d+)\. Error Message: ([^.]+))?/

/** Decode raw program logs. Picks the LAST AnchorError line (innermost CPI). */
export function decodeAnchorError(logs: string[], ctx: DecodeContext = {}): DecodedAnchorError | null {
  let match: RegExpMatchArray | null = null
  let raw = ''
  for (let i = logs.length - 1; i >= 0; i--) {
    const m = logs[i].match(ANCHOR_LOG_RE)
    if (m) { match = m; raw = logs[i]; break }
  }
  // Also handle hex custom errors: "Program X failed: custom program error: 0x1770"
  const hexLine = [...logs].reverse().find(l => /custom program error: 0x[0-9a-f]+/i.test(l))
  let code: number | undefined
  let name = 'UnknownError'
  let msg = ''
  let failedAccount: string | undefined
  let source: SourceLocation | undefined
  if (match) {
    failedAccount = match[1]
    name = match[2] ?? name
    code = match[3] ? parseInt(match[3], 10) : undefined
    msg = match[4] ?? ''
  } else if (hexLine) {
    const m = hexLine.match(/custom program error: (0x[0-9a-f]+)/i)
    if (m) code = parseInt(m[1], 16)
    raw = hexLine
  } else {
    return null
  }

  let origin: DecodedAnchorError['origin'] = 'unknown'
  if (code !== undefined) {
    const fw = ANCHOR_FRAMEWORK_ERRORS[code]
    if (fw) { name = name === 'UnknownError' ? fw.name : name; msg = msg || fw.msg; origin = 'framework' }
    // IDL custom errors
    const idl = ctx.programId && ctx.idls?.[ctx.programId]
    if (idl) {
      const errs = (idl as Idl & { errors?: Array<{ code: number; name: string; msg?: string }> }).errors
      const hit = errs?.find(e => e.code === code)
      if (hit) { name = hit.name; msg = hit.msg ?? msg; origin = 'idl' }
    const srcMap = ctx.programId && ctx.sourceMaps?.[ctx.programId]
    if (srcMap && code !== undefined && srcMap[code]) source = srcMap[code]
    }
  }

  return {
    programId: ctx.programId ?? 'unknown',
    code: code ?? -1,
    name, msg, origin,
    instructionIndex: ctx.instructionIndex,
    failedAccount, raw, source,
  }
}

/**
 * Decode a failed transaction by simulating it and pulling logs + the
 * `InstructionError` index, then looking up that instruction's programId
 * in the supplied IDL map (or fetching on-chain).
 */
export async function decodeFailedTx(
  conn: Connection,
  tx: VersionedTransaction,
  opts: { provider?: AnchorProvider; idls?: Record<string, LoadedIdl> } = {},
): Promise<DecodedAnchorError | null> {
  const sim = await conn.simulateTransaction(tx, { sigVerify: false, replaceRecentBlockhash: true })
  const logs = sim.value.logs ?? []
  let ixIndex: number | undefined
  const err = sim.value.err as unknown
  if (err && typeof err === 'object' && 'InstructionError' in (err as object)) {
    ixIndex = (err as { InstructionError: [number, unknown] }).InstructionError[0]
  }
  let programId: string | undefined
  if (ixIndex !== undefined) {
    const ix = tx.message.compiledInstructions[ixIndex]
    const pk = tx.message.staticAccountKeys[ix.programIdIndex]
    programId = pk?.toBase58()
  }
  const idls: Record<string, Idl> = {}
  const sourceMaps: Record<string, Record<number, SourceLocation>> = {}
  for (const [pid, l] of Object.entries(opts.idls ?? {})) { idls[pid] = l.idl; if (l.errorSourceMap) sourceMaps[pid] = l.errorSourceMap }
  if (programId && !idls[programId] && opts.provider) {
    try {
      const loaded = await loadIdl({ programId, source: 'onchain', provider: opts.provider })
      idls[programId] = loaded.idl
    } catch { /* best-effort */ }
  }
  return decodeAnchorError(logs, { idls, sourceMaps, instructionIndex: ixIndex, programId })
}

void PublicKey
