import { createCipheriv, createDecipheriv, generateKeyPairSync, randomBytes, scryptSync, sign, verify, createPrivateKey } from "node:crypto";

const PUB_BYTES = 2592;
const SIG_BYTES = 4627;

export function generateValidatorKey() {
  if (typeof generateKeyPairSync !== "function") {
    throw new Error("This Node build cannot create an ML-DSA-87 key.");
  }
  let pair;
  try {
    pair = generateKeyPairSync("ml-dsa-87");
  } catch {
    throw new Error("This Node build cannot create an ML-DSA-87 key. Node 24 or newer is required.");
  }
  const secret = pair.privateKey.export({ format: "jwk" });
  const rawPub = Buffer.from(secret.pub, "base64url");
  if (rawPub.length !== PUB_BYTES || !secret.priv) {
    throw new Error("The ML-DSA-87 key did not have the expected size.");
  }
  return { rawPub, jwk: { kty: secret.kty, alg: secret.alg, pub: secret.pub, priv: secret.priv } };
}

export function encryptKey(jwk, passphrase) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(passphrase, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(jwk), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    version: 1,
    kdf: "scrypt",
    n: 32768,
    r: 8,
    p: 1,
    salt: salt.toString("hex"),
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
    ciphertext: ciphertext.toString("hex"),
  };
}

export function decryptKey(bundle, passphrase) {
  const key = scryptSync(passphrase, Buffer.from(bundle.salt, "hex"), 32, {
    N: bundle.n,
    r: bundle.r,
    p: bundle.p,
    maxmem: 64 * 1024 * 1024,
  });
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(bundle.iv, "hex"));
  decipher.setAuthTag(Buffer.from(bundle.tag, "hex"));
  const json = Buffer.concat([
    decipher.update(Buffer.from(bundle.ciphertext, "hex")),
    decipher.final(),
  ]).toString("utf8");
  const jwk = JSON.parse(json);
  if (!jwk.priv || !jwk.pub) throw new Error("The keystore did not open.");
  return jwk;
}

export function signRoot(jwk, root) {
  if (root.length !== 32) throw new Error("A signing root is 32 bytes.");
  const signature = sign(null, root, createPrivateKey({ key: jwk, format: "jwk" }));
  if (signature.length !== SIG_BYTES) throw new Error("The signature was not 4,627 bytes.");
  return signature;
}

export function verifyRoot(jwk, root, signature) {
  const { priv: _priv, ...publicJwk } = jwk;
  return verify(null, root, { key: publicJwk, format: "jwk" }, signature);
}

export function checkPassphrase(passphrase) {
  const value = String(passphrase || "");
  if (value.length < 8 || !/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) {
    throw new Error("The passphrase needs 8 characters, with a letter and a number.");
  }
  return value;
}
