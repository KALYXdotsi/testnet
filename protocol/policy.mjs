const KINDS = new Set(["proposal", "attestation", "randao"]);

export function emptyHistory() {
  return { version: 1, proposals: {}, attestations: [], randaos: {} };
}

export function judge(history, duty) {
  if (!KINDS.has(duty.kind)) {
    return { accept: false, reason: "This signer only signs a proposal, an attestation, or a randao reveal." };
  }
  if (duty.kind === "proposal") return judgeProposal(history, duty);
  if (duty.kind === "attestation") return judgeAttestation(history, duty);
  return judgeRandao(history, duty);
}

function judgeProposal(history, duty) {
  const previous = history.proposals[duty.slot];
  if (!previous) return { accept: true, replay: false };
  if (previous.signingRoot === duty.signingRoot) return replay(previous.signature);
  return { accept: false, reason: "This slot already has a different proposal. A second block at the same height is refused." };
}

function later(left, right) {
  return BigInt(left) > BigInt(right);
}

function judgeAttestation(history, duty) {
  if (later(duty.sourceEpoch, duty.targetEpoch)) {
    return { accept: false, reason: "The source checkpoint is later than the target." };
  }
  for (const previous of history.attestations) {
    if (previous.targetEpoch === duty.targetEpoch) {
      if (previous.signingRoot === duty.signingRoot) return replay(previous.signature);
      return { accept: false, reason: "This key already attested to a different vote for that target." };
    }
    const surrounds = later(duty.sourceEpoch, previous.sourceEpoch) && later(previous.targetEpoch, duty.targetEpoch);
    const surrounded = later(previous.sourceEpoch, duty.sourceEpoch) && later(duty.targetEpoch, previous.targetEpoch);
    if (surrounds || surrounded) {
      return { accept: false, reason: "This vote surrounds another vote from this key." };
    }
  }
  return { accept: true, replay: false };
}

function judgeRandao(history, duty) {
  const previous = history.randaos[duty.epoch];
  if (!previous) return { accept: true, replay: false };
  if (previous.signingRoot === duty.signingRoot) return replay(previous.signature);
  return { accept: false, reason: "This epoch already has a randao reveal." };
}

function replay(signature) {
  if (typeof signature === "string" && signature.startsWith("0x")) return { accept: true, replay: true, signature };
  return { accept: true, replay: false };
}

export function remember(history, duty, signature) {
  if (duty.kind === "proposal") {
    history.proposals[duty.slot] = { signingRoot: duty.signingRoot, signature };
    return;
  }
  if (duty.kind === "attestation") {
    const existing = history.attestations.find((item) => item.targetEpoch === duty.targetEpoch && item.signingRoot === duty.signingRoot);
    if (existing) {
      existing.signature = signature;
      return;
    }
    history.attestations.push({
      sourceEpoch: duty.sourceEpoch,
      targetEpoch: duty.targetEpoch,
      signingRoot: duty.signingRoot,
      signature,
    });
    return;
  }
  history.randaos[duty.epoch] = { signingRoot: duty.signingRoot, signature };
}
