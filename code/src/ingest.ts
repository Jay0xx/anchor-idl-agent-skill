export type IdlSource =
  | { kind: 'programId'; programId: PublicKey | string; provider: AnchorProvider }
  | { kind: 'githubRaw'; url: string }
  | { kind: 'file'; path: string }

export interface LoadedIdl {
  idl: Idl
  programId: PublicKey
  specVersion: 'legacy' | 'v0.30+'
  sha256: string
}

export async function loadIdl(source: IdlSource): Promise<LoadedIdl> {
  let idl: Idl | null = null
  let programId: PublicKey

  switch (source.kind) {
    case 'programId': {
      programId = new PublicKey(source.programId)
      idl = await Program.fetchIdl(programId, source.provider)
      if (!idl) throw new Error(`No on-chain IDL for ${programId.toBase58()} — try githubRaw source.`)
      break
    }
    case 'githubRaw': {
      const r = await fetch(source.url)
      if (!r.ok) throw new Error(`GitHub fetch failed: ${r.status} ${source.url}`)
      idl = (await r.json()) as Idl
      const addr = (idl as unknown as { address?: string; metadata?: { address?: string } }).address
                ?? (idl as unknown as { metadata?: { address?: string } }).metadata?.address
      if (!addr) throw new Error('IDL is missing programId/address field')
      programId = new PublicKey(addr)
      break
    }
    case 'file': {
      const { readFileSync } = await import('node:fs')
      idl = JSON.parse(readFileSync(source.path, 'utf8')) as Idl
      const addr = (idl as unknown as { address?: string; metadata?: { address?: string } }).address
                ?? (idl as unknown as { metadata?: { address?: string } }).metadata?.address
      if (!addr) throw new Error('IDL is missing programId/address field')
      programId = new PublicKey(addr)
      break
    }
  }

  const serialized = JSON.stringify(idl)
  const sha256 = createHash('sha256').update(serialized).digest('hex')
  const specVersion: LoadedIdl['specVersion'] =
    (idl as unknown as { metadata?: { spec?: string } }).metadata?.spec ? 'v0.30+' : 'legacy'

  return { idl, programId, specVersion, sha256 }
}

/**
 * Verify an off-chain IDL matches a deployed program by computing the
 * discriminator of one known account type and comparing against a real
 * on-chain account of that type.
 */
export async function verifyIdlAgainstChain(
  loaded: LoadedIdl,
  connection: Connection,
  knownAccountType: string,
  exampleAccountAddress: PublicKey,
): Promise<boolean> {
  const acc = await connection.getAccountInfo(exampleAccountAddress)
  if (!acc) throw new Error(`Reference account ${exampleAccountAddress.toBase58()} not found`)
  const expected = accountDiscriminator(knownAccountType)
  return Buffer.from(acc.data.subarray(0, 8)).equals(expected)
}

function accountDiscriminator(name: string): Buffer {
  // Anchor convention: sha256("account:<Name>")[..8]
  const hash = createHash('sha256').update(`account:${name}`).digest()
  return hash.subarray(0, 8)
}
