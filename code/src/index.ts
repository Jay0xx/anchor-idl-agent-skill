/**
 * @solanabr/anchor-agent-toolkit
 *
 * Public surface for the Anchor IDL Agent Skill. Every export is documented
 * in skill/ docs of the parent repo.
 */

export { loadIdl, verifyIdlAgainstChain } from './ingest.js'
export { buildToolSchema, type ToolCatalogue, type ToolSpec } from './schema.js'
export { resolveAccounts, type ResolvedAccounts } from './resolve.js'
export { simulateAndSend, type SendResult, type SimulationResult } from './simulate.js'
export { decodeAnchorError, decodeFailedTx, type DecodedAnchorError } from './decode.js'
export { ALLOWLIST, SAFETY_RAILS, type SafetyConfig } from './safety.js'
