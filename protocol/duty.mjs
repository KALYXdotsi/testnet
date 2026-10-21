import { FORK_VERSION, SLOTS_PER_EPOCH, attestationSigning, proposalSigning, randaoSigning } from "./ssz.mjs";

const ALLOWED = new Set(["kind", "slot", "objectRoot", "attestation"]);

export function parseDuty(body, genesisValidatorsRoot) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new DutyError("The request has to be a JSON object.");
  }
  for (const key of Object.keys(body)) {
    if (!ALLOWED.has(key)) {
      throw new DutyError("This signer only accepts a proposal, an attestation, or a randao reveal.");
    }
  }
  const kind = body.kind;
  if (kind !== "proposal" && kind !== "attestation" && kind !== "randao") {
    throw new DutyError("This signer only signs a proposal, an attestation, or a randao reveal.");
  }
  const slot = parseUint(body.slot, "slot");
  const epoch = slot / SLOTS_PER_EPOCH;
  if (kind === "proposal") {
    const objectRoot = parseRoot(body.objectRoot, "objectRoot");
    const signed = proposalSigning(objectRoot, slot, genesisValidatorsRoot);
    return { kind, slot: decimal(slot), epoch: decimal(signed.epoch), signingRoot: hex(signed.signingRoot) };
  }
  if (kind === "randao") {
    const signed = randaoSigning(epoch, genesisValidatorsRoot);
    return { kind, slot: decimal(slot), epoch: decimal(epoch), signingRoot: hex(signed) };
  }
  const attestation = parseAttestation(body.attestation, slot);
  const signed = attestationSigning(attestation, genesisValidatorsRoot);
  return {
    kind,
    slot: decimal(slot),
    epoch: decimal(epoch),
    sourceEpoch: decimal(attestation.sourceEpoch),
    targetEpoch: decimal(attestation.targetEpoch),
    signingRoot: hex(signed.signingRoot),
  };
}

function parseAttestation(value, slot) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DutyError("An attestation needs its slot, index, block root, source, and target.");
  }
  const attestationSlot = parseUint(value.slot, "attestation slot");
  if (attestationSlot !== slot) throw new DutyError("The attestation slot does not match the request slot.");
  const source = parseCheckpoint(value.source, "source");
  const target = parseCheckpoint(value.target, "target");
  return {
    slot: attestationSlot,
    index: parseUint(value.index, "index"),
    beaconBlockRoot: parseRoot(value.beaconBlockRoot, "beaconBlockRoot"),
    sourceEpoch: source.epoch,
    sourceRoot: source.root,
    targetEpoch: target.epoch,
    targetRoot: target.root,
  };
}

function parseCheckpoint(value, name) {
  if (!value || typeof value !== "object") throw new DutyError(`The ${name} checkpoint is missing.`);
  return { epoch: parseUint(value.epoch, name), root: parseRoot(value.root, name) };
}

export function parseUint(value, name) {
  const text = typeof value === "number" && Number.isSafeInteger(value) ? String(value) : String(value ?? "");
  if (!/^(0|[1-9][0-9]{0,19})$/.test(text)) throw new DutyError(`The ${name} has to be a whole number.`);
  const parsed = BigInt(text);
  if (parsed > 0xffffffffffffffffn) throw new DutyError(`The ${name} is too large.`);
  return parsed;
}

export function parseRoot(value, name) {
  const text = String(value ?? "");
  if (!/^0x[0-9a-fA-F]{64}$/.test(text)) throw new DutyError(`The ${name} has to be 32 bytes, written as hex.`);
  const root = Buffer.from(text.slice(2), "hex");
  if (root.equals(Buffer.alloc(32))) throw new DutyError(`The ${name} is empty.`);
  return root;
}

export function parseAddress(value) {
  const text = String(value ?? "").trim();
  const match = /^KAL([0-9a-fA-F]{40})$/i.exec(text);
  if (!match) throw new DutyError("The withdrawal account is KAL followed by 40 hex characters.");
  return Buffer.from(match[1], "hex");
}

export function hex(buffer) {
  return `0x${buffer.toString("hex")}`;
}

export function forkHex() {
  return `0x${FORK_VERSION.toString("hex")}`;
}

function decimal(value) {
  return BigInt(value).toString(10);
}

export class DutyError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}
