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

export const ALLOWLIST = new Set<string>([
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',  // Jupiter V6
  'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH',   // Drift V2
  'KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYZgmJjVB',  // Kamino Lend
  'MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA',   // MarginFi v2
  'SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu',   // Squads v4
  'CrX7kMhLC3cSsXJdT7JDgqrRVWGnUpX3gfEfxxU2NVLi',  // Sanctum
])
