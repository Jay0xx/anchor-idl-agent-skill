import type { Idl } from '@coral-xyz/anchor'

export interface ToolSpec {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  accountResolutionPlan: {
    auto: string[]      // sysvars + programs
    resolved: string[]  // PDAs / ATAs derived by toolkit
    user: string[]      // user must supply
  }
}

export interface ToolCatalogue {
  programId: string
  programName: string
  idlSha256: string
  tools: ToolSpec[]
}

/**
 * Generate a JSON-schema tool catalogue from an Anchor IDL. The output is
 * directly consumable by Anthropic / OpenAI tool-calling APIs.
 *
 * Per skill/tool-generation.md: accounts are grouped by who supplies them;
 * 'auto' and 'resolved' are never exposed to the LLM as inputs.
 */
export function buildToolSchema(idl: Idl, opts: { idlSha256: string; programName?: string }): ToolCatalogue {
  const programId =
    (idl as unknown as { address?: string }).address
    ?? (idl as unknown as { metadata?: { address?: string } }).metadata?.address
    ?? ''

  const name = opts.programName ?? (idl as unknown as { name?: string; metadata?: { name?: string } }).metadata?.name
    ?? (idl as unknown as { name?: string }).name
    ?? 'unknown'

  const tools: ToolSpec[] = (idl.instructions ?? []).map(ix => ({
    name: `${name}__${ix.name}`,
    description: Array.isArray((ix as { docs?: string[] }).docs)
      ? ((ix as { docs?: string[] }).docs ?? []).join(' ')
      : `Calls ${ix.name} on ${name}`,
    inputSchema: mapArgsToJsonSchema(ix, idl),
    accountResolutionPlan: classifyAccounts(ix),
  }))

  return { programId, programName: name, idlSha256: opts.idlSha256, tools }
}

function mapArgsToJsonSchema(ix: Idl['instructions'][number], idl: Idl): Record<string, unknown> {
  const properties: Record<string, unknown> = {}
  const required: string[] = []
  for (const arg of ix.args ?? []) {
    properties[arg.name] = mapAnchorType(arg.type, idl)
    required.push(arg.name)
  }
  return { type: 'object', properties, required, additionalProperties: false }
}

function mapAnchorType(type: unknown, _idl: Idl): Record<string, unknown> {
  if (typeof type === 'string') {
    switch (type) {
      case 'bool':      return { type: 'boolean' }
      case 'u8': case 'u16': case 'u32': case 'i8': case 'i16': case 'i32':
        return { type: 'integer' }
      case 'u64': case 'u128': case 'i64': case 'i128':
        return { type: 'string', pattern: '^-?[0-9]+$' }
      case 'publicKey': case 'pubkey':
        return { type: 'string', pattern: '^[1-9A-HJ-NP-Za-km-z]{32,44}$' }
      case 'string':    return { type: 'string' }
      case 'bytes':     return { type: 'string', contentEncoding: 'base64' }
    }
  }
  if (typeof type === 'object' && type !== null) {
    const t = type as Record<string, unknown>
    if ('vec' in t)    return { type: 'array', items: mapAnchorType(t['vec'], _idl) }
    if ('option' in t) return { ...mapAnchorType(t['option'], _idl), nullable: true }
    if ('array' in t && Array.isArray(t['array'])) {
      const [inner, n] = t['array'] as [unknown, number]
      return { type: 'array', items: mapAnchorType(inner, _idl), minItems: n, maxItems: n }
    }
    if ('defined' in t) return { $ref: `#/$defs/${String(t['defined'])}` }
  }
  return { description: 'unknown type — supply raw' }
}

function classifyAccounts(ix: Idl['instructions'][number]): ToolSpec['accountResolutionPlan'] {
  const plan: ToolSpec['accountResolutionPlan'] = { auto: [], resolved: [], user: [] }
  const SYSVARS = new Set(['rent','clock','recentBlockhashes','slotHashes','stakeHistory','instructions'])
  const PROGRAMS = new Set(['systemProgram','tokenProgram','tokenProgram2022','associatedTokenProgram'])

  for (const acc of ix.accounts ?? []) {
    const n = acc.name
    if (SYSVARS.has(n) || PROGRAMS.has(n)) plan.auto.push(n)
    else if ((acc as { pda?: unknown }).pda) plan.resolved.push(n)
    else if (/Ata$|TokenAccount$/.test(n))  plan.resolved.push(n)
    else plan.user.push(n)
  }
  return plan
}
