import test from "node:test";
import assert from "node:assert/strict";
import { emptyHistory, judge, remember } from "../policy.mjs";

test("a second block at the same slot is refused", () => {
  const history = emptyHistory();
  const first = { kind: "proposal", slot: "12", signingRoot: "0x11" };
  assert.equal(judge(history, first).accept, true);
  remember(history, first, "0xsig");
  assert.equal(judge(history, { kind: "proposal", slot: "12", signingRoot: "0x22" }).accept, false);
  assert.equal(judge(history, first).replay, true);
});

test("a surrounding attestation is refused and a later target is allowed", () => {
  const history = emptyHistory();
  const wide = { kind: "attestation", sourceEpoch: "1", targetEpoch: "10", signingRoot: "0xaa" };
  remember(history, wide, "0xsig");
  const surrounded = judge(history, { kind: "attestation", sourceEpoch: "2", targetEpoch: "4", signingRoot: "0xbb" });
  assert.equal(surrounded.accept, false);
  const later = judge(history, { kind: "attestation", sourceEpoch: "10", targetEpoch: "11", signingRoot: "0xcc" });
  assert.equal(later.accept, true);
});

test("an exit is refused", () => {
  const decision = judge(emptyHistory(), { kind: "exit", slot: "1", signingRoot: "0x11" });
  assert.equal(decision.accept, false);
});

test("epoch order uses numbers, so 9 is earlier than 10", () => {
  const history = emptyHistory();
  remember(history, { kind: "attestation", sourceEpoch: "9", targetEpoch: "9", signingRoot: "0xaa" }, "0xsig");
  const decision = judge(history, { kind: "attestation", sourceEpoch: "10", targetEpoch: "10", signingRoot: "0xbb" });
  assert.equal(decision.accept, true);
});
