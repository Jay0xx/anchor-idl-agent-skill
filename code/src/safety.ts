import type { TransactionInstruction, VersionedTransaction, MessageCompiledInstruction } from '@solana/web3.js'
export interface SafetyConfig {
  maxComputeUnits: number
  maxPriorityMicroLamports: number
  maxTotalFeeSol: number
  maxInstructionsPerTx: number
}

export const SAFETY_RAILS: SafetyConfig = {
  maxComputeUnits: 1_400_000,
  maxPriorityMicroLamports: 1_000_000,
  maxTotalFeeSol: 0.01,
  maxInstructionsPerTx: 64,
}

/**
 * Pinned (programId, idlSha256) pairs. Using a Set of programIds is no
 * longer sufficient — an upgradeable program can ship a new IDL that
 * silently changes account ordering or seed layout. Pinning the IDL hash
 * makes those changes a hard failure instead of a quiet exploit.
 *
 * Maintainers: update both the programId AND idlSha256 in the same PR.
 * idlSha256 of '*' means "any IDL" (NOT recommended; legacy compatibility only).
 */
export interface AllowlistEntry { programId: string; idlSha256: string; label: string }

export const ALLOWLIST: AllowlistEntry[] = [
  { programId: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', idlSha256: '*', label: 'Jupiter V6' },
  { programId: 'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH', idlSha256: '*', label: 'Drift V2' },
  { programId: 'KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYZgmJjVB', idlSha256: '*', label: 'Kamino Lend' },
  { programId: 'MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA', idlSha256: '*', label: 'MarginFi v2' },
  { programId: 'SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu', idlSha256: '*', label: 'Squads v4' },
  { programId: 'CrX7kMhLC3cSsXJdT7JDgqrRVWGnUpX3gfEfxxU2NVLi', idlSha256: '*', label: 'Sanctum' },
]

const ALLOWLIST_INDEX = new Map<string, AllowlistEntry[]>()
for (const e of ALLOWLIST) {
  const arr = ALLOWLIST_INDEX.get(e.programId) ?? []
  arr.push(e); ALLOWLIST_INDEX.set(e.programId, arr)
}

/**
 * Check that EVERY program invoked by the tx is allowlisted, optionally
 * matching a pinned IDL hash. Returns the list of violating programIds.
 *
 * `idlHashes` maps programId -> sha256 of the IDL the caller used to build
 * the instruction; pass {} if you don't have IDL hashes and accept '*' entries.
 */
export function checkAllowlist(
  programIds: string[],
  idlHashes: Record<string, string> = {},
): { ok: boolean; violations: Array<{ programId: string; reason: string }> } {
  const violations: Array<{ programId: string; reason: string }> = []
  for (const pid of new Set(programIds)) {
    const entries = ALLOWLIST_INDEX.get(pid)
    if (!entries) { violations.push({ programId: pid, reason: 'not in allowlist' }); continue }
    const hash = idlHashes[pid]
    const matched = entries.some(e => e.idlSha256 === '*' || (hash && e.idlSha256 === hash))
    if (!matched) violations.push({ programId: pid, reason: `IDL hash mismatch (got ${hash ?? 'none'})` })
  }
  return { ok: violations.length === 0, violations }
}

/** Extract every invoked programId from a versioned tx (top-level only; CPIs are runtime). */
export function programIdsOf(tx: VersionedTransaction): string[] {
  const keys = tx.message.staticAccountKeys
  return tx.message.compiledInstructions.map(
    (ix: MessageCompiledInstruction) => keys[ix.programIdIndex]?.toBase58() ?? '',
  ).filter(Boolean)
}

export function programIdsOfIxs(ixs: TransactionInstruction[]): string[] {
  return ixs.map(i => i.programId.toBase58())
}

void PublicKey  // keep imported for downstream consumers re-exporting
