import { FORK_VERSION, STAKE_GWEI } from "./ssz.mjs";

export const FORK_HEX = "0x" + Buffer.from(FORK_VERSION).toString("hex");
export const PUB_BYTES = 2592;
export const SIG_BYTES = 4627;
export const ROOT_BYTES = 32;
export const DEPOSIT_SELECTOR = Buffer.from("22895118", "hex");
export const STAKE_GWEI_TEXT = STAKE_GWEI.toString();

function hexBytes(value, size) {
  if (typeof value !== "string") return null;
  let text = value.trim().toLowerCase();
  if (text.startsWith("0x")) text = text.slice(2);
  if (text.length !== size * 2 || !/^[0-9a-f]+$/.test(text)) return null;
  return Buffer.from(text, "hex");
}

function word(value) {
  const out = Buffer.alloc(32);
  out.writeBigUInt64BE(BigInt(value), 24);
  return out;
}

function abiBytes(data) {
  const pad = (32 - (data.length % 32)) % 32;
  return Buffer.concat([word(data.length), data, Buffer.alloc(pad)]);
}

export function encodeDeposit(pubkey, credentials, signature, root) {
  if (!Buffer.isBuffer(root) || root.length !== ROOT_BYTES) {
    throw new Error("The deposit root is 32 bytes.");
  }
  const parts = [abiBytes(pubkey), abiBytes(credentials), abiBytes(signature)];
  let cursor = 32 * 4;
  const offsets = parts.map((part) => {
    const at = cursor;
    cursor += part.length;
    return at;
  });
  const head = Buffer.concat(offsets.map(word));
  return "0x" + Buffer.concat([DEPOSIT_SELECTOR, head, root, ...parts]).toString("hex");
}

export function parseDeposit(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "The deposit file has to be the public JSON from the key tool.";
  }
  const fork = String(payload.forkVersion || "").trim().toLowerCase();
  if (fork !== FORK_HEX) return "The deposit file is not for fork version 0x10000038.";
  const pubkey = hexBytes(payload.pubkey, PUB_BYTES);
  const signature = hexBytes(payload.signature, SIG_BYTES);
  const credentials = hexBytes(payload.withdrawalCredentials, ROOT_BYTES);
  const root = hexBytes(payload.depositDataRoot, ROOT_BYTES);
  const amount = String(payload.amountGwei || "").trim();
  if (!pubkey) return "The public key in that file is not 2,592 bytes.";
  if (!signature) return "The deposit signature in that file is not 4,627 bytes.";
  if (!credentials) return "The withdrawal credentials in that file are not 32 bytes.";
  if (!root) return "The deposit root in that file is not 32 bytes.";
  if (amount !== STAKE_GWEI_TEXT) return "The deposit amount has to be 40,000 KALYX.";
  return {
    pubkey: pubkey.toString("hex"),
    signature: signature.toString("hex"),
    withdrawal: "0x" + credentials.toString("hex"),
    depositRoot: "0x" + root.toString("hex"),
    forkVersion: FORK_HEX,
    calldata: encodeDeposit(pubkey, credentials, signature, root),
  };
}
