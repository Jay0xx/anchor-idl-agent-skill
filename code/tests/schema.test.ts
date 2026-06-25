// Smoke: a minimal hand-rolled IDL exercises the type mapping and account classification.
const TINY_IDL = {
  address: 'TestProgram11111111111111111111111111111111',
  metadata: { name: 'tiny', spec: '0.1.0' },
  instructions: [{
    name: 'deposit',
    docs: ['Deposit liquidity into the vault.'],
    accounts: [
      { name: 'user', isSigner: true, isMut: true },
      { name: 'vault', pda: { seeds: [{ kind: 'const', value: [118, 97, 117, 108, 116] }, { kind: 'account', path: 'user' }] } },
      { name: 'userAta' },
      { name: 'systemProgram' },
      { name: 'tokenProgram' },
    ],
    args: [
      { name: 'amount', type: 'u64' },
      { name: 'memo', type: 'string' },
    ],
  }],
} as const

describe('buildToolSchema', () => {
  it('produces one tool per instruction', () => {
    const cat = buildToolSchema(TINY_IDL as never, { idlSha256: 'abc', programName: 'tiny' })
    expect(cat.tools).toHaveLength(1)
    expect(cat.tools[0]?.name).toBe('tiny__deposit')
  })

  it('maps u64 to string-with-pattern', () => {
    const cat = buildToolSchema(TINY_IDL as never, { idlSha256: 'abc' })
    const schema = cat.tools[0]?.inputSchema as { properties: { amount: { type: string; pattern: string } } }
    expect(schema.properties.amount.type).toBe('string')
    expect(schema.properties.amount.pattern).toBe('^-?[0-9]+$')
  })

  it('classifies accounts into auto/resolved/user buckets', () => {
    const cat = buildToolSchema(TINY_IDL as never, { idlSha256: 'abc' })
    const plan = cat.tools[0]?.accountResolutionPlan
    expect(plan?.auto).toContain('systemProgram')
    expect(plan?.auto).toContain('tokenProgram')
    expect(plan?.resolved).toContain('vault')
    expect(plan?.resolved).toContain('userAta')
    expect(plan?.user).toContain('user')
  })
})
