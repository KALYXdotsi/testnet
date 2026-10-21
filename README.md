<p align="center">
  <img src="assets/kalyx-logo.png" alt="Kalyx" width="148">
</p>

<h1 align="center">Kalyx</h1>

<p align="center">
  A quantum-proof proof-of-stake testnet.<br>
  Chain <strong>21520</strong> is producing blocks.
</p>

<p align="center">
  <a href="https://kalyx.si">kalyx.si</a>
  ·
  <a href="https://testnet.kalyx.si">testnet.kalyx.si</a>
</p>

Kalyx is a proof-of-stake network. Validator duties are signed with **ML-DSA-87**, a lattice signature, because that lock is not the elliptic-curve problem a large quantum computer is expected to forge. Spending accounts can sign with **XMSS**, which is built from hashes. The public network is a testnet. The coins are there so people can learn the protocol. They are not a place to put value.

There is no miner. There is no race to hash a number. About every ten seconds the beacon assigns one slot to a validator, using the stake behind that key. The validator proposes a block. Other validators attest to what they saw. Eight slots make an epoch, about eighty seconds. A missed turn stays empty.

The clients have not finished an audit. A quantum-proof signature is a choice of math, not a warranty that no future method can ever touch it, and not a promise that every program in the stack has been reviewed. This page describes the chain that is running.

## Why the locks are these two

Shor’s algorithm is aimed at factoring and at the elliptic-curve discrete logarithm. That is the math behind the signatures most chains still use for accounts and for validators. A quantum computer that can run it does not guess harder. It solves that math.

Kalyx does not use that lock for either job.

| Job | Signature | Why it is here |
| --- | --- | --- |
| Validator duties | ML-DSA-87 | Lattice scheme. FIPS 204 parameter set. The problem is not the one Shor solves. |
| Spending accounts | XMSS | Built from hash functions. Stateful: each leaf may sign once. |

Neither scheme is a substitute for the other. A file that opens a spending account does not propose a block. A validator key does not belong in a browser wallet. There is no shorter classical key sitting beside the lattice key as a fallback. A short spare key would make the long one a costume.

The honest limit stays in the same sentence as the claim. Quantum-proof names the lock. Proof of stake names the weight. One phrase does not cover the other.

## ML-DSA-87

A validator key on this chain is ML-DSA-87.

| Piece | Size |
| --- | --- |
| Public key | 2,592 bytes |
| Signature | 4,627 bytes |
| Fork version the key must be signed for | `0x10000038` |

The beacon knows the public key. On that key’s turn, the block carries a 4,627-byte signature over the duty. A wrong signature is not a block. A key made for another fork version is a different key, and this beacon rejects it. Software that expects a 32-byte or 64-byte public key will fail to parse this one. The failure is the parameter set.

The secret half of the key stays with the operator, on a machine they run. It does not belong in a browser, a chat, a log, or a model’s context. A model may read the chain and draft a proposal. It may ask a signer that holds the key. The signer may sign, and the signer may refuse. A refusal is a normal result. The ask is not a command. No fleet of models is running. The two validators that started with the chain are ordinary stake.

## XMSS

An ordinary transfer can be signed with XMSS. The seed is 51 bytes, written as `0x` and 102 hex characters. There is no word list, and there is no desk that can rebuild a seed that was not saved.

XMSS is stateful. The seed grows a tree of leaves, and each leaf may sign once. Using the same leaf twice ends that account’s security. Two tabs, or a tab and a script, that both think they own the next leaf will do exactly that. One account, one next leaf, and the leaf moves forward after every successful signature.

The browser wallet on the explorer keeps the seed in the tab. It can write the seed into an encrypted file that stays on the reader’s machine. The seed is not uploaded. Closing the tab forgets it. The signing code in that page has not been audited. It is for this testnet.

## Proof of stake

A quantum-proof signature does not choose whose turn it is. Stake does.

The chain has two layers that have to agree. The execution layer holds accounts, balances, and transactions. The beacon holds the validator set and decides whose turn it is to propose. A block in the explorer is a turn that made it into the execution record.

On this testnet a slot is about ten seconds. The beacon gives that turn to one validator. The proposal is the beacon’s record of the turn plus the execution payload. If the proposer is absent, the slot is not filled in later to make a chart look smooth. An empty slot is a turn nobody took. The explorer can show the beacon ahead of the latest execution block when that happens.

Eight slots make an epoch, about eighty seconds. Rewards, penalties, and the activation queue are counted in epochs. Finality follows on a slower clock than the head. On a young network the head can sit ahead of the last finalized epoch. Anything that spends, credits a user, or treats a transfer as settled should wait for finality. Seeing a recent block is a reason to look, not a reason to call the transfer finished.

| Bound | Rule |
| --- | --- |
| Counted stake | One key counts at most **40,000 KALYX**. |
| Entry | A new key must deposit that full effective balance before it can enter the active set. A smaller payment does not take its place. |
| Ejection | If counted stake falls to **20,000 KALYX**, the chain can eject the key. |
| Activation | At most **8** new validators activate in one epoch. |

The beacon stores stake in gwei. One KALYX is 1,000,000,000 gwei. On the execution side the same coin has 18 decimals: the node stores an integer, and one KALYX is 10<sup>18</sup> of that integer. Those are two units for two layers, not two coins.

Signing two different things at the same height is how a key gets punished. This page does not invent a slash fraction the genesis does not publish.

## The chain, in one table

| | |
| --- | --- |
| Chain id | **21520**. A running chain cannot change it. A transaction built for another id is a different object. |
| Fork version | `0x10000038`. Chosen before a validator key exists. |
| Genesis supply | 500,000,000 KALYX, 18 decimals, minted to one account so the chain would have a supply that can move. |
| Genesis validators | 2. Ordinary stake. |
| Slot | about 10 seconds. |
| Epoch | 8 slots, about 80 seconds. |
| Block gas limit | 30,000,000. |
| Transaction type | `0x2` only. The chain id sits inside the signature. |
| Unit | KALYX. The name is a display choice. The node stores an integer. |

## Fees

Each block has a base fee, and that base fee is **burned**. It is not paid to a treasury or a miner. A sender may add a priority fee, and that tip goes to the proposer of the block. This genesis starts at 1 gwei. The burned amount on a block is the gas used times the base fee. A huge gas limit with tiny usage does not burn the huge number. The tip is separate, and it can be zero.

Three ideas are written about elsewhere and are **not** live on this genesis:

- A hard cap on supply.
- An inflation schedule that starts near 8 percent and steps down.
- A rule that burns half the fee and pays the proposer the other half.

Issuance after genesis follows the beacon’s own reward rule. Editing a sentence on a website does not change that.

## Accounts and transactions

An account id is 20 bytes. The chain shows it as **KAL** and 40 hex characters. The checksum starts after those three letters. A 64-byte address from somewhere else is not an account here.

A transfer has one shape. The type is `0x2`. The nonce is the next unused number for that account. The gas limit is the work the transfer is allowed to do. The value is an integer of 18-decimal KALYX. The node checks the signature, the chain id, the nonce, and the fee. If any of those fail, the transfer does not enter a block.

When the account signs with XMSS, that signature consumes one leaf whether or not a later replacement lands. Waiting for the receipt is the calmer path.

## Contracts

The wallet on the explorer can publish contract bytecode from a spending account. The transaction has no recipient. The data is the bytecode, as hex that starts with `0x`. A person check runs first. The seed stays in the tab. After the node accepts it, the transaction page shows the new address once a receipt exists.

Reading a contract does not spend a leaf. Sending call data does. The page does not include a compiler, a verifier, or a catalog of projects. Compile elsewhere and bring the bytecode. An address that holds code is reported by the explorer as a byte count. That record is the code itself.

Publishing a contract does not make the author a validator. A contract is not the 40,000 KALYX deposit, and it is not an ML-DSA-87 key.

## Where a reader can look

Two public doors, and they are not the same computer.

| Door | What it is |
| --- | --- |
| [kalyx.si](https://kalyx.si) | The public site. The rules, in short pages. |
| [testnet.kalyx.si](https://testnet.kalyx.si) | The explorer, the wallet, and the faucet. Blocks, accounts, and the validator set. |

The explorer reads the node. It does not hold keys. The node’s own interface stays on the machine that runs the node. Looking is public. Driving that machine from the internet is not a feature of this testnet.

The faucet pays test KALYX to a KAL address so a reader can try a transfer. Ten KALYX can go to an address once a day. A claim of that size does not create a validator. The account that pays from the public button is `KAL8A67356081269d6969558DdDd454EBC8b4395c0B`.

A person who wants the larger stake amount applies on the explorer and waits. Approval can pay coins into a spending account. It does not put a key in the active set. Becoming a validator is still a node of one’s own, an ML-DSA-87 key for fork version `0x10000038`, and 40,000 KALYX of effective stake on that key.

## What a validator is

A validator is a public key with 40,000 KALYX behind it, plus a duty to speak when the beacon says it is that key’s turn. Miss the turn and the slot stays empty.

The key is created on a machine the operator runs, signed for fork version `0x10000038`. Rewards above the counted stake, and the remaining stake after an exit, are paid to an ordinary KAL account the operator chooses. That withdrawal account is not the key that signs blocks. Losing one and losing the other are different losses.

The deposit data for a key is the public half. The seed, the keystore, and the password are the other half. Anyone who asks for the other half is not helping a validator join. This repository does not contain a key, a seed, or a deposit file.

At most eight new keys activate in one epoch. One deposit is not instant. A crowd is slower, because the set is meant to stay legible.

## The code in this repository

`protocol/` is the public slice of the chain rules. It is enough to see the locks work. It is not a node, and it will not start a second network.

| File | What it shows |
| --- | --- |
| `protocol/keys.mjs` | Creates an ML-DSA-87 key, signs a 32-byte root, and checks the signature. The public key is 2,592 bytes. The signature is 4,627 bytes. |
| `protocol/ssz.mjs` | Binds a duty to fork version `0x10000038` and to a stake of 40,000 KALYX. A signature for another fork is a signature over different bytes. |
| `protocol/duty.mjs` | Turns a proposal, an attestation, or a randao reveal into the root those bytes must cover. |
| `protocol/policy.mjs` | Refuses a second block at the same height, and refuses a vote that surrounds another vote from the same key. |

On Node 24 or newer:

```bash
cd protocol
npm test
```

The test creates a key in memory, signs the deposit root for this fork, checks that the signature verifies, and checks that the wrong passphrase does not open the key file. It then refuses a second proposal for a slot that already has one. Nothing is written to disk. Nothing in that test is a key from the running chain.

## What this repository is

This repository is the public account of the testnet: the mark, the locks, the weight, and the checks a reader can run.

It does not contain a node, a genesis, a validator key from the running chain, or a way to start a second copy. Cloning it will not produce blocks. The chain that is producing blocks is the one the explorer is reading, chain id 21520.

The longer pages live at [kalyx.si/docs](https://kalyx.si/docs). Where a page on the site and a block in the explorer disagree, believe the block.
