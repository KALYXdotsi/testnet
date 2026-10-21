/**
 * kalyx-client.mjs
 *
 * Reference client and utility module for the Kalyx network.
 * https://kalyx.si/
 *
 * Kalyx is a proof-of-stake chain designed so that:
 *   - Stake decides who may propose (the weight).
 *   - The signature on that duty is quantum-proof (ML-DSA-87) — the lock.
 *   - A superintelligence may draft a proposal; it does not receive the key.
 *
 * Spec highlights (from the public site):
 *   - Chain ID: 21520
 *   - Fork version: 0x10000038
 *   - Slot ≈ 10 s / Epoch = 8 slots
 *   - Validator entry: 40_000 KALYX effective balance
 *   - Ejection threshold: 20_000 KALYX
 *   - At most 8 new validators per epoch
 *   - Validator key: ML-DSA-87 (pub ~2 592 B, sig ~4 627 B)
 *   - Account: XMSS (51-byte seed, one leaf / one signature)
 *   - Address format: "KAL" + 40 hex characters (20 bytes)
 *   - Transactions: type 0x2
 *   - Base fee burns; tip goes to proposer
 *   - Genesis: 500_000_000 KALYX (18 decimals)
 *
 * This module is intentionally self-contained and uses only pure JavaScript.
 * Real cryptographic operations (ML-DSA-87, XMSS) require a proper library
 * (e.g. a Node.js binding to liboqs, noble-post-quantum, or the official
 * reference implementations). Placeholders are clearly marked.
 *
 * Testnet explorer / faucet / wallet: https://testnet.kalyx.si/
 */

// =============================================================================
// Constants — published numbers from https://kalyx.si/
// =============================================================================

export const KALYX = Object.freeze({
  CHAIN_ID: 21520,
  FORK_VERSION: "0x10000038",
  SLOT_SECONDS: 10,
  SLOTS_PER_EPOCH: 8,
  EPOCH_SECONDS: 80,

  ENTRY_STAKE_KALYX: 40_000,
  EJECTION_STAKE_KALYX: 20_000,
  MAX_NEW_VALIDATORS_PER_EPOCH: 8,

  VALIDATOR_PUBKEY_BYTES: 2592,
  VALIDATOR_SIGNATURE_BYTES: 4627,
  ACCOUNT_SEED_BYTES: 51,
  ADDRESS_HEX_LENGTH: 40, // after "KAL"

  DECIMALS: 18,
  GWEI_PER_KALYX: 1_000_000_000n, // beacon stores stake in gwei

  GENESIS_SUPPLY_KALYX: 500_000_000,
  FAUCET_DAILY_PER_ADDRESS: 2_500_000,
  VALIDATOR_CLAIM_ONCE: 40_010,

  TX_TYPE: 0x02,
  BLOCK_GAS_LIMIT: 30_000_000,

  TESTNET_RPC: "https://testnet.kalyx.si", // placeholder — actual RPC is local to the node
  EXPLORER: "https://testnet.kalyx.si",
  FAUCET: "https://testnet.kalyx.si/faucet",
  WALLET: "https://testnet.kalyx.si/dashboard",
});

/** One KALYX expressed in the smallest unit (10^18). */
export const ONE_KALYX = 10n ** 18n;

// =============================================================================
// Address helpers (KAL + 40 hex = 20-byte account)
// =============================================================================

/**
 * Validate a Kalyx account address.
 * Format: "KAL" followed by exactly 40 hexadecimal characters (case-insensitive).
 */
export function isValidKalAddress(address) {
  if (typeof address !== "string") return false;
  const match = address.match(/^KAL([0-9a-fA-F]{40})$/);
  return !!match;
}

/**
 * Normalize an address to the canonical form: "KAL" + lowercase hex.
 */
export function normalizeKalAddress(address) {
  if (!isValidKalAddress(address)) {
    throw new Error(`Invalid KAL address: ${address}`);
  }
  return "KAL" + address.slice(3).toLowerCase();
}

/**
 * Generate a mock KAL address from a seed (for testing only).
 * Real addresses come from XMSS public keys / leaf derivation.
 */
export function mockKalAddressFromSeed(seed) {
  const encoder = new TextEncoder();
  const data = encoder.encode(String(seed));
  let hash = 0n;
  for (const b of data) {
    hash = (hash * 31n + BigInt(b)) & ((1n << 160n) - 1n);
  }
  const hex = hash.toString(16).padStart(40, "0").slice(0, 40);
  return "KAL" + hex;
}

// =============================================================================
// Amount / balance helpers
// =============================================================================

/**
 * Convert a human-readable KALYX amount (number or string) to the smallest unit (bigint).
 */
export function parseKalyx(amount) {
  const str = String(amount).trim();
  if (!/^\d+(\.\d+)?$/.test(str)) {
    throw new Error(`Invalid KALYX amount: ${amount}`);
  }
  const [whole, frac = ""] = str.split(".");
  const paddedFrac = (frac + "0".repeat(KALYX.DECIMALS)).slice(0, KALYX.DECIMALS);
  return BigInt(whole) * ONE_KALYX + BigInt(paddedFrac);
}

/**
 * Format a smallest-unit amount back to a human-readable string.
 */
export function formatKalyx(amountWei, maxDecimals = 6) {
  const value = BigInt(amountWei);
  const whole = value / ONE_KALYX;
  const frac = value % ONE_KALYX;
  const fracStr = frac.toString().padStart(KALYX.DECIMALS, "0").slice(0, maxDecimals).replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}

/**
 * Convert KALYX (bigint smallest unit or number) to gwei for beacon stake accounting.
 * Spec: one KALYX = 1_000_000_000 gwei.
 */
export function kalyxToGwei(amount) {
  const wei = typeof amount === "bigint" ? amount : parseKalyx(amount);
  return wei / (ONE_KALYX / KALYX.GWEI_PER_KALYX);
}

// =============================================================================
// Stake & eligibility logic
// =============================================================================

/**
 * Check whether a validator with the given effective balance may enter or remain active.
 * @param {bigint|number|string} effectiveBalanceKalyx
 * @returns {{ eligible: boolean, reason: string, canEnter: boolean, atRiskOfEjection: boolean }}
 */
export function checkValidatorEligibility(effectiveBalanceKalyx) {
  const bal = typeof effectiveBalanceKalyx === "bigint"
    ? effectiveBalanceKalyx
    : parseKalyx(effectiveBalanceKalyx);

  const entry = parseKalyx(KALYX.ENTRY_STAKE_KALYX);
  const eject = parseKalyx(KALYX.EJECTION_STAKE_KALYX);

  const canEnter = bal >= entry;
  const atRiskOfEjection = bal < eject;
  const eligible = bal >= eject; // simplified; real rules also include activation queue, etc.

  let reason = "Active";
  if (!canEnter) reason = `Below entry threshold (${KALYX.ENTRY_STAKE_KALYX} KALYX)`;
  else if (atRiskOfEjection) reason = `At risk of ejection (below ${KALYX.EJECTION_STAKE_KALYX} KALYX)`;

  return { eligible, reason, canEnter, atRiskOfEjection, balanceKalyx: formatKalyx(bal) };
}

/**
 * Estimate how many epochs a new deposit must wait given current queue length.
 * Spec: at most 8 new validators activate per epoch.
 */
export function estimateActivationEpochs(queuePosition) {
  if (queuePosition < 0) return 0;
  return Math.ceil((queuePosition + 1) / KALYX.MAX_NEW_VALIDATORS_PER_EPOCH);
}

// =============================================================================
// Slot / Epoch / Time helpers
// =============================================================================

export function slotToEpoch(slot) {
  return Math.floor(Number(slot) / KALYX.SLOTS_PER_EPOCH);
}

export function epochToFirstSlot(epoch) {
  return Number(epoch) * KALYX.SLOTS_PER_EPOCH;
}

export function estimateSlotFromTimestamp(timestampMs, genesisTimestampMs = 0) {
  const elapsedSec = Math.max(0, (timestampMs - genesisTimestampMs) / 1000);
  return Math.floor(elapsedSec / KALYX.SLOT_SECONDS);
}

// =============================================================================
// Fee model (base fee burns, tip to proposer)
// =============================================================================

/**
 * Simple illustration of the fee model.
 * Real base fee dynamics follow the chain's EIP-1559-like rules (not fully specified here).
 */
export function illustrateFees({ gasUsed, baseFeePerGas, maxPriorityFeePerGas = 0n }) {
  const gas = BigInt(gasUsed);
  const base = BigInt(baseFeePerGas);
  const tip = BigInt(maxPriorityFeePerGas);

  const burned = gas * base;
  const tipPaid = gas * tip;
  const totalPaid = burned + tipPaid;

  return {
    burned: formatKalyx(burned),
    tipToProposer: formatKalyx(tipPaid),
    totalFromSender: formatKalyx(totalPaid),
    note: "Base fee is burned. Tip goes to the proposer. There is no miner.",
  };
}

// =============================================================================
// Mock client (RPC placeholders)
// =============================================================================

export class KalyxClient {
  constructor(options = {}) {
    this.chainId = options.chainId ?? KALYX.CHAIN_ID;
    this.rpcUrl = options.rpcUrl ?? KALYX.TESTNET_RPC;
    this.genesisTimestamp = options.genesisTimestamp ?? Date.now() - 86400_000;
  }

  async getChainId() {
    return this.chainId;
  }

  /**
   * Placeholder for eth_getBalance-style call.
   * Real implementation would hit the node's JSON-RPC.
   */
  async getBalance(address) {
    if (!isValidKalAddress(address)) throw new Error("Invalid address");
    // Mock: deterministic balance for demo
    const seed = parseInt(address.slice(3, 11), 16);
    const mockWei = BigInt(seed % 100_000) * ONE_KALYX;
    return mockWei;
  }

  /**
   * Placeholder for current slot / head.
   */
  async getCurrentSlot() {
    return estimateSlotFromTimestamp(Date.now(), this.genesisTimestamp);
  }

  /**
   * Placeholder for beacon eligibility of a validator pubkey.
   */
  async getValidatorStatus(pubkeyHex) {
    // In reality this would query the beacon.
    return {
      pubkeyBytes: pubkeyHex.length / 2,
      expectedBytes: KALYX.VALIDATOR_PUBKEY_BYTES,
      forkVersion: KALYX.FORK_VERSION,
      note: "Real status comes from the beacon on a synced node.",
    };
  }
}

// =============================================================================
// Agent / proposal boundary (the design principle)
// =============================================================================

/**
 * A ProposalDrafter may read the chain and draft a block proposal.
 * It must never receive a signing key or seed.
 * The actual signature is performed by a local signer that holds the ML-DSA-87 key.
 */
export class ProposalDrafter {
  constructor(client) {
    this.client = client;
  }

  /**
   * Draft a type-0x2 block proposal (unsigned).
   * The model/agent may call this; the signer decides whether to sign.
   */
  async draftProposal({ slot, feeRecipient, transactions = [] }) {
    const currentSlot = await this.client.getCurrentSlot();
    if (slot < currentSlot) {
      throw new Error("Cannot draft for a past slot");
    }

    return {
      chainId: this.client.chainId,
      forkVersion: KALYX.FORK_VERSION,
      slot: Number(slot),
      type: KALYX.TX_TYPE,
      feeRecipient: normalizeKalAddress(feeRecipient),
      transactions: transactions.map((tx) => ({
        ...tx,
        type: KALYX.TX_TYPE,
      })),
      gasLimit: KALYX.BLOCK_GAS_LIMIT,
      note: "Draft only. Signature (ML-DSA-87, ~4627 bytes) must be produced by the key holder.",
      boundary: "The mind proposes. The signer decides. The key stays put.",
    };
  }

  /**
   * Placeholder verification of a duty signature.
   * Real code would use an ML-DSA-87 verifier.
   */
  async verifyDutySignature({ proposal, signatureHex, pubkeyHex }) {
    const sigBytes = signatureHex.length / 2;
    const pubBytes = pubkeyHex.length / 2;

    return {
      valid: false, // placeholder — always false until real crypto is wired
      signatureBytes: sigBytes,
      expectedSignatureBytes: KALYX.VALIDATOR_SIGNATURE_BYTES,
      pubkeyBytes: pubBytes,
      expectedPubkeyBytes: KALYX.VALIDATOR_PUBKEY_BYTES,
      forkVersionMatches: true,
      message: "Placeholder. Integrate a real ML-DSA-87 verifier (FIPS 204).",
    };
  }
}

// =============================================================================
// XMSS account note (stateful)
// =============================================================================

export const XMSS_NOTES = Object.freeze({
  seedBytes: KALYX.ACCOUNT_SEED_BYTES,
  property: "One leaf, one signature. Reuse a leaf and the account is burned.",
  addressFormat: "KAL + 40 hex characters (20 bytes)",
  warning: "Never expose the 51-byte seed or the current leaf index to an agent.",
});

// =============================================================================
// Convenience demo / self-test
// =============================================================================

export async function runSelfTest() {
  const client = new KalyxClient();
  const drafter = new ProposalDrafter(client);

  const addr = mockKalAddressFromSeed("kalyx-demo");
  console.log("Mock address:", addr, isValidKalAddress(addr));

  const eligibility = checkValidatorEligibility(45_000);
  console.log("Eligibility:", eligibility);

  const fees = illustrateFees({
    gasUsed: 21000,
    baseFeePerGas: parseKalyx("0.000000001"),
    maxPriorityFeePerGas: parseKalyx("0.000000002"),
  });
  console.log("Fees:", fees);

  const proposal = await drafter.draftProposal({
    slot: await client.getCurrentSlot() + 1,
    feeRecipient: addr,
    transactions: [],
  });
  console.log("Draft proposal boundary note:", proposal.boundary);

  return { addr, eligibility, fees, proposal };
}

// Uncomment to run when the file is executed directly:
// if (import.meta.url === `file://${process.argv[1]}`) {
//   runSelfTest().then(console.log).catch(console.error);
// }

export default {
  KALYX,
  ONE_KALYX,
  isValidKalAddress,
  normalizeKalAddress,
  parseKalyx,
  formatKalyx,
  checkValidatorEligibility,
  KalyxClient,
  ProposalDrafter,
  runSelfTest,
};
