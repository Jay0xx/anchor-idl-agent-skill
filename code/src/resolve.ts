import type { Idl } from '@coral-xyz/anchor'

export interface ResolvedAccounts {
  byName: Record<string, PublicKey>
  unresolved: string[]
}

const SYSVAR_MAP: Record<string, PublicKey> = {
  rent: SYSVAR_RENT_PUBKEY,
  clock: SYSVAR_CLOCK_PUBKEY,
}
const PROGRAM_MAP: Record<string, PublicKey> = {
  systemProgram: SystemProgram.programId,
  tokenProgram: TOKEN_PROGRAM_ID,
  tokenProgram2022: TOKEN_2022_PROGRAM_ID,
  associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
}

export function resolveAccounts(
  idl: Idl,
  ixName: string,
  args: Record<string, unknown>,
  userSupplied: Record<string, PublicKey>,
  programId: PublicKey,
): ResolvedAccounts {
  const ix = idl.instructions?.find(i => i.name === ixName)
  if (!ix) throw new Error(`Instruction ${ixName} not in IDL`)

  const byName: Record<string, PublicKey> = {}
  const unresolved: string[] = []

  for (const acc of ix.accounts ?? []) {
    const name = acc.name

    if (SYSVAR_MAP[name]) { byName[name] = SYSVAR_MAP[name]; continue }
    if (PROGRAM_MAP[name]) { byName[name] = PROGRAM_MAP[name]; continue }

    const pda = (acc as { pda?: { seeds?: Seed[] } }).pda
    if (pda?.seeds) {
      byName[name] = deriveFromSeeds(pda.seeds, ix, args, byName, programId)
      continue
    }

    if (/Ata$|TokenAccount$/.test(name)) {
      const ata = deriveAta(name, ix, byName, userSupplied)
      if (ata) { byName[name] = ata; continue }
    }

    if (userSupplied[name]) { byName[name] = userSupplied[name]; continue }

    unresolved.push(name)
  }

  return { byName, unresolved }
}

type Seed =
  | { kind: 'const'; value: number[] }
  | { kind: 'arg'; path: string }
  | { kind: 'account'; path: string }

function deriveFromSeeds(
  seeds: Seed[],
  ix: Idl['instructions'][number],
  args: Record<string, unknown>,
  accounts: Record<string, PublicKey>,
  programId: PublicKey,
): PublicKey {
  const buffers = seeds.map((s): Buffer => {
    if (s.kind === 'const')   return Buffer.from(s.value)
    if (s.kind === 'arg')     return serializeArg(args[s.path], findArgType(ix, s.path))
    if (s.kind === 'account') {
      const pk = accounts[s.path.split('.')[0] ?? '']
      if (!pk) throw new Error(`Cannot resolve seed account: ${s.path}`)
      return pk.toBuffer()
    }
    throw new Error('Unknown seed kind')
  })
  return PublicKey.findProgramAddressSync(buffers, programId)[0]
}

function findArgType(ix: Idl['instructions'][number], name: string): string {
  const arg = ix.args?.find(a => a.name === name)
  return typeof arg?.type === 'string' ? arg.type : 'unknown'
}

function serializeArg(value: unknown, type: string): Buffer {
  if (type === 'u64') { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(String(value))); return b }
  if (type === 'u32') { const b = Buffer.alloc(4); b.writeUInt32LE(Number(value)); return b }
  if (type === 'u16') { const b = Buffer.alloc(2); b.writeUInt16LE(Number(value)); return b }
  if (type === 'u8')  { return Buffer.from([Number(value)]) }
  if (type === 'string' || type === 'publicKey' || type === 'pubkey')
    return Buffer.from(String(value))
  throw new Error(`Cannot serialize seed arg of type ${type}`)
}

function deriveAta(
  name: string,
  ix: Idl['instructions'][number],
  accounts: Record<string, PublicKey>,
  userSupplied: Record<string, PublicKey>,
): PublicKey | null {
  // Heuristic: <thing>Ata pairs with <thing>Mint + an owner field (user, authority, owner)
  const base = name.replace(/Ata$|TokenAccount$/, '')
  const mintCandidates = [`${base}Mint`, 'mint']
  const ownerCandidates = ['user', 'owner', 'authority']
  const mint = mintCandidates.map(c => accounts[c] ?? userSupplied[c]).find(Boolean)
  const owner = ownerCandidates.map(c => accounts[c] ?? userSupplied[c]).find(Boolean)
  if (!mint || !owner) return null
  return getAssociatedTokenAddressSync(mint, owner, false)
}
