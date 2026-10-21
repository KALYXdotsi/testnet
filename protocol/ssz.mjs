import { createHash } from "node:crypto";

export const FORK_VERSION = Buffer.from([0x10, 0x00, 0x00, 0x38]);
export const STAKE_GWEI = 40000n * 1000000000n;
export const SLOTS_PER_EPOCH = 8n;

const DOMAIN_PROPOSER = Buffer.from([0x00, 0x00, 0x00, 0x00]);
const DOMAIN_ATTESTER = Buffer.from([0x01, 0x00, 0x00, 0x00]);
const DOMAIN_RANDAO = Buffer.from([0x02, 0x00, 0x00, 0x00]);
const DOMAIN_DEPOSIT = Buffer.from([0x03, 0x00, 0x00, 0x00]);

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest();
}

function nextPow2(n) {
  let width = 1;
  while (width < n) width *= 2;
  return width;
}

export function merkleize(chunks) {
  if (chunks.length === 0) return Buffer.alloc(32);
  const width = nextPow2(chunks.length);
  let level = chunks.map((chunk) => {
    if (chunk.length !== 32) throw new Error("A hash chunk must be 32 bytes.");
    return chunk;
  });
  while (level.length < width) level.push(Buffer.alloc(32));
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(sha256(Buffer.concat([level[i], level[i + 1]])));
    }
    level = next;
  }
  return level[0];
}

export function chunkUint(value) {
  const chunk = Buffer.alloc(32);
  chunk.writeBigUInt64LE(BigInt(value));
  return chunk;
}

export function packBytes(bytes) {
  const chunks = [];
  for (let offset = 0; offset < bytes.length; offset += 32) {
    const chunk = Buffer.alloc(32);
    bytes.copy(chunk, 0, offset, Math.min(offset + 32, bytes.length));
    chunks.push(chunk);
  }
  return merkleize(chunks);
}

export function computeDomain(domainType, forkVersion, genesisValidatorsRoot) {
  const versionChunk = Buffer.alloc(32);
  forkVersion.copy(versionChunk, 0, 0, 4);
  const forkDataRoot = merkleize([versionChunk, genesisValidatorsRoot]);
  const domain = Buffer.alloc(32);
  domainType.copy(domain, 0, 0, 4);
  forkDataRoot.copy(domain, 4, 0, 28);
  return domain;
}

export function signingRoot(objectRoot, domain) {
  return merkleize([objectRoot, domain]);
}

export function withdrawalCredentials(address) {
  if (address.length !== 20) throw new Error("A withdrawal account is 20 bytes.");
  const credentials = Buffer.alloc(32);
  address.copy(credentials, 12);
  return credentials;
}

export function depositSigning(publicKey, credentials) {
  const messageRoot = merkleize([
    packBytes(publicKey),
    credentials,
    chunkUint(STAKE_GWEI),
  ]);
  const domain = computeDomain(DOMAIN_DEPOSIT, FORK_VERSION, Buffer.alloc(32));
  return signingRoot(messageRoot, domain);
}

export function depositDataRoot(publicKey, credentials, signature) {
  return merkleize([
    packBytes(publicKey),
    credentials,
    chunkUint(STAKE_GWEI),
    packBytes(signature),
  ]);
}

export function proposalSigning(objectRoot, slot, genesisValidatorsRoot) {
  const epoch = BigInt(slot) / SLOTS_PER_EPOCH;
  const domain = computeDomain(DOMAIN_PROPOSER, FORK_VERSION, genesisValidatorsRoot);
  return { epoch, signingRoot: signingRoot(objectRoot, domain) };
}

export function attestationObjectRoot(attestation) {
  const source = merkleize([chunkUint(attestation.sourceEpoch), attestation.sourceRoot]);
  const target = merkleize([chunkUint(attestation.targetEpoch), attestation.targetRoot]);
  return merkleize([
    chunkUint(attestation.slot),
    chunkUint(attestation.index),
    attestation.beaconBlockRoot,
    source,
    target,
  ]);
}

export function attestationSigning(attestation, genesisValidatorsRoot) {
  const objectRoot = attestationObjectRoot(attestation);
  const domain = computeDomain(DOMAIN_ATTESTER, FORK_VERSION, genesisValidatorsRoot);
  return { objectRoot, signingRoot: signingRoot(objectRoot, domain) };
}

export function randaoSigning(epoch, genesisValidatorsRoot) {
  const domain = computeDomain(DOMAIN_RANDAO, FORK_VERSION, genesisValidatorsRoot);
  return signingRoot(chunkUint(epoch), domain);
}
