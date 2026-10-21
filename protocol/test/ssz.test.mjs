import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { FORK_VERSION, STAKE_GWEI, computeDomain, depositSigning, merkleize, withdrawalCredentials } from "../ssz.mjs";
import { generateValidatorKey, signRoot, verifyRoot, encryptKey, decryptKey } from "../keys.mjs";

test("two chunks hash the way a signing container does", () => {
  const left = Buffer.alloc(32, 1);
  const right = Buffer.alloc(32, 2);
  const expected = createHash("sha256").update(Buffer.concat([left, right])).digest();
  assert.deepEqual(merkleize([left, right]), expected);
});

test("the deposit domain starts with the deposit type and the stake is 40,000 KALYX", () => {
  const domain = computeDomain(Buffer.from([0x03, 0x00, 0x00, 0x00]), FORK_VERSION, Buffer.alloc(32));
  assert.equal(domain.subarray(0, 4).toString("hex"), "03000000");
  assert.equal(domain.length, 32);
  assert.equal(STAKE_GWEI, 40000n * 1000000000n);
  const credentials = withdrawalCredentials(Buffer.alloc(20, 7));
  assert.equal(credentials[0], 0);
  assert.equal(credentials[12], 7);
});

test("a deposit signature verifies and a wrong passphrase does not open the key", () => {
  const key = generateValidatorKey();
  const credentials = withdrawalCredentials(Buffer.from("11".repeat(20), "hex"));
  const root = depositSigning(key.rawPub, credentials);
  const signature = signRoot(key.jwk, root);
  assert.equal(signature.length, 4627);
  assert.equal(verifyRoot(key.jwk, root, signature), true);
  const bundle = encryptKey(key.jwk, "correct1");
  assert.equal(decryptKey(bundle, "correct1").priv, key.jwk.priv);
  assert.throws(() => decryptKey(bundle, "wrongpass1"));
});
