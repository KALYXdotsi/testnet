import test from "node:test";
import assert from "node:assert/strict";
import { FORK_VERSION, STAKE_GWEI } from "../ssz.mjs";
import {
  BLOCK_GAS_LIMIT,
  CHAIN_ID,
  EJECTION_KALYX,
  FORK_VERSION as CHAIN_FORK,
  GWEI_PER_KALYX,
  MAX_ACTIVATIONS_PER_EPOCH,
  MAX_EFFECTIVE_KALYX,
  SLOT_SECONDS,
  SLOTS_PER_EPOCH,
  TRANSACTION_TYPE,
} from "../chain.mjs";
import { encodeDeposit, parseDeposit, STAKE_GWEI_TEXT } from "../deposit.mjs";

function sample() {
  return {
    forkVersion: "0x10000038",
    pubkey: "ab".repeat(2592),
    withdrawalCredentials: "11".repeat(32),
    amountGwei: "40000000000000",
    signature: "cd".repeat(4627),
    depositDataRoot: "22".repeat(32),
  };
}

test("the published chain numbers match the signing code", () => {
  assert.equal(CHAIN_ID, 21520);
  assert.equal(SLOT_SECONDS, 10);
  assert.equal(SLOTS_PER_EPOCH, 8);
  assert.equal(BLOCK_GAS_LIMIT, 30_000_000);
  assert.equal(CHAIN_FORK, "0x" + Buffer.from(FORK_VERSION).toString("hex"));
  assert.equal(MAX_EFFECTIVE_KALYX * GWEI_PER_KALYX, STAKE_GWEI);
  assert.equal(EJECTION_KALYX, 20_000n);
  assert.equal(MAX_ACTIVATIONS_PER_EPOCH, 8);
  assert.equal(TRANSACTION_TYPE, "0x2");
  assert.equal(STAKE_GWEI_TEXT, "40000000000000");
});

test("a deposit file for this fork encodes calldata and a wrong file is refused", () => {
  const file = sample();
  const parsed = parseDeposit(file);
  assert.equal(typeof parsed, "object");
  assert.match(parsed.calldata, /^0x22895118[0-9a-f]+$/);
  assert.equal(parsed.calldata, encodeDeposit(
    Buffer.from(file.pubkey, "hex"),
    Buffer.from(file.withdrawalCredentials, "hex"),
    Buffer.from(file.signature, "hex"),
    Buffer.from(file.depositDataRoot, "hex"),
  ));
  assert.equal(parseDeposit({ ...file, forkVersion: "0x00000000" }), "The deposit file is not for fork version 0x10000038.");
  assert.equal(parseDeposit({ ...file, amountGwei: "1" }), "The deposit amount has to be 40,000 KALYX.");
  assert.equal(parseDeposit({ ...file, pubkey: "ab" }), "The public key in that file is not 2,592 bytes.");
  assert.equal(parseDeposit({ ...file, signature: "cd" }), "The deposit signature in that file is not 4,627 bytes.");
});
