import { createHash } from 'node:crypto'
import { AnchorProvider, Idl, Program } from '@coral-xyz/anchor'
import { Connection, PublicKey } from '@solana/web3.js'

const BPF_UPGRADEABLE_LOADER = new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111')

export interface SourceLocation { file: string; line: number; column?: number }

export interface LoadIdlOptions {
  programId: string
  source: 'onchain' | 'url' | 'inline'
  url?: string
  inline?: Idl
  provider?: AnchorProvider
  /** SHA-256 hex of the canonical JSON of the IDL. If provided, hash MUST match. */
  expectedSha256?: string
  /** Pinned upgrade authority (base58). If provided, on-chain authority MUST match. */
  expectedUpgradeAuthority?: string | null
  /** Network retries (default 3) and per-attempt timeout in ms (default 8000). */
  retries?: number
  timeoutMs?: number
}

export interface LoadedIdl {
  /** Map of Anchor error code -> first source location declared via `x-source`. */
  errorSourceMap?: Record<number, SourceLocation>
  idl: Idl
  sha256: string
  source: LoadIdlOptions['source']
  programId: string
  /** Present when fetched on-chain via an upgradeable loader. */
  upgradeAuthority?: string | null
  /** Slot the program was last upgraded (best-effort). */
  lastUpgradeSlot?: number | null
}

function canonicalize(idl: Idl): string {
  // Stable stringify — sort keys recursively so the hash is canonical.
  const stable = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(stable)
    if (v && typeof v === 'object') {
      return Object.keys(v as object).sort().reduce((o, k) => {
        ;(o as Record<string, unknown>)[k] = stable((v as Record<string, unknown>)[k]); return o
      }, {} as Record<string, unknown>)
    }
    return v
  }
  return JSON.stringify(stable(idl))
}

function sha256Hex(s: string): string { return createHash('sha256').update(s).digest('hex') }

async function withRetry<T>(fn: () => Promise<T>, retries: number, timeoutMs: number): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i <= retries; i++) {
    try {
      return await Promise.race([
        fn(),
        new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs)),
      ])
    } catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 250 * (i + 1))) }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

async function fetchUpgradeAuthority(
  conn: Connection, programId: PublicKey,
): Promise<{ authority: string | null; slot: number | null }> {
  const acct = await conn.getAccountInfo(programId, 'confirmed')
  if (!acct || !acct.owner.equals(BPF_UPGRADEABLE_LOADER)) return { authority: null, slot: null }
  // ProgramData address is bytes [4..36] of the program account data.
  if (acct.data.length < 36) return { authority: null, slot: null }
  const programDataAddr = new PublicKey(acct.data.slice(4, 36))
  const pd = await conn.getAccountInfo(programDataAddr, 'confirmed')
  if (!pd || pd.data.length < 45) return { authority: null, slot: null }
  // ProgramData layout: 4 (variant) + 8 (slot LE) + 1 (option) + 32 (pubkey)
  const slot = Number(pd.data.readBigUInt64LE(4))
  const hasAuthority = pd.data.readUInt8(12) === 1
  const authority = hasAuthority ? new PublicKey(pd.data.slice(13, 45)).toBase58() : null
  return { authority, slot }
}

export async function loadIdl(opts: LoadIdlOptions): Promise<LoadedIdl> {
  const retries = opts.retries ?? 3
  const timeoutMs = opts.timeoutMs ?? 8000
  let idl: Idl
  let upgradeAuthority: string | null | undefined
  let lastUpgradeSlot: number | null | undefined

  if (opts.source === 'inline') {
    if (!opts.inline) throw new Error('inline source requires opts.inline')
    idl = opts.inline
  } else if (opts.source === 'url') {
    if (!opts.url) throw new Error('url source requires opts.url')
    idl = await withRetry(async () => {
      const res = await fetch(opts.url!)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as Idl
    }, retries, timeoutMs)
  } else {
    if (!opts.provider) throw new Error('onchain source requires opts.provider')
    const programId = new PublicKey(opts.programId)
    const fetched = await withRetry(
      () => Program.fetchIdl(programId, opts.provider!),
      retries, timeoutMs,
    )
    if (!fetched) throw new Error(`No on-chain IDL for ${opts.programId}`)
    idl = fetched
    const meta = await fetchUpgradeAuthority(opts.provider.connection, programId)
    upgradeAuthority = meta.authority
    lastUpgradeSlot = meta.slot
  }

  const sha256 = sha256Hex(canonicalize(idl))

  if (opts.expectedSha256 && opts.expectedSha256.toLowerCase() !== sha256) {
    throw new Error(
      `IDL hash mismatch for ${opts.programId}: expected ${opts.expectedSha256}, got ${sha256}. ` +
      'Refusing to use — pin a new hash only after manual review.',
    )
  }
  if (opts.expectedUpgradeAuthority !== undefined &&
      upgradeAuthority !== undefined &&
      opts.expectedUpgradeAuthority !== upgradeAuthority) {
    throw new Error(
      `Upgrade authority changed for ${opts.programId}: pinned ${opts.expectedUpgradeAuthority}, ` +
      `on-chain ${upgradeAuthority}. Cached IDL is no longer trusted.`,
    )
  }

  const errorSourceMap: Record<number, SourceLocation> = {}
  const errs = (idl as Idl & { errors?: Array<{ code: number; sources?: SourceLocation[] }> }).errors
  if (errs) for (const e of errs) if (e.sources && e.sources[0]) errorSourceMap[e.code] = e.sources[0]

  return { idl, sha256, source: opts.source, programId: opts.programId, upgradeAuthority, lastUpgradeSlot, errorSourceMap }
}
