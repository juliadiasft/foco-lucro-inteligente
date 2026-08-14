import {
  createCipheriv,
  createECDH,
  createHmac,
  createPrivateKey,
  randomBytes,
  sign,
} from "node:crypto";

import { query } from "./db.server";

type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

const encodeBase64Url = (value: Buffer | string) => Buffer.from(value).toString("base64url");

const decodeBase64Url = (value: string) => Buffer.from(value, "base64url");

function expandHkdf(key: Buffer, info: Buffer, length: number) {
  let output = Buffer.alloc(0);
  let previous = Buffer.alloc(0);
  let counter = 1;
  while (output.length < length) {
    previous = createHmac("sha256", key)
      .update(Buffer.concat([previous, info, Buffer.from([counter])]))
      .digest();
    output = Buffer.concat([output, previous]);
    counter += 1;
  }
  return output.subarray(0, length);
}

function hkdfExtract(salt: Buffer, inputKeyMaterial: Buffer) {
  return createHmac("sha256", salt).update(inputKeyMaterial).digest();
}

function createVapidAuthorization(endpoint: string) {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;

  const publicBytes = decodeBase64Url(publicKey);
  if (publicBytes.length !== 65 || publicBytes[0] !== 4)
    throw new Error("VAPID_PUBLIC_KEY inválida");

  const x = publicBytes.subarray(1, 33);
  const y = publicBytes.subarray(33, 65);
  const key = createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      x: encodeBase64Url(x),
      y: encodeBase64Url(y),
      d: privateKey,
    },
    format: "jwk",
  });
  const header = encodeBase64Url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const payload = encodeBase64Url(
    JSON.stringify({
      aud: new URL(endpoint).origin,
      exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
      sub: process.env.VAPID_SUBJECT || "mailto:contato@centraldocomerciante.com.br",
    }),
  );
  const unsigned = `${header}.${payload}`;
  const signature = sign("sha256", Buffer.from(unsigned), {
    key,
    dsaEncoding: "ieee-p1363",
  });
  return `vapid t=${unsigned}.${encodeBase64Url(signature)}, k=${publicKey}`;
}

function encryptPayload(subscription: PushSubscriptionRow, payload: PushPayload) {
  const userPublicKey = decodeBase64Url(subscription.p256dh);
  const authSecret = decodeBase64Url(subscription.auth);
  const serverKeys = createECDH("prime256v1");
  serverKeys.generateKeys();
  const serverPublicKey = serverKeys.getPublicKey();
  const sharedSecret = serverKeys.computeSecret(userPublicKey);

  const authenticationPrk = hkdfExtract(authSecret, sharedSecret);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), userPublicKey, serverPublicKey]);
  const inputKeyMaterial = expandHkdf(authenticationPrk, keyInfo, 32);
  const salt = randomBytes(16);
  const contentPrk = hkdfExtract(salt, inputKeyMaterial);
  const contentEncryptionKey = expandHkdf(
    contentPrk,
    Buffer.from("Content-Encoding: aes128gcm\0"),
    16,
  );
  const nonce = expandHkdf(contentPrk, Buffer.from("Content-Encoding: nonce\0"), 12);
  const plaintext = Buffer.concat([Buffer.from(JSON.stringify(payload)), Buffer.from([2])]);
  const cipher = createCipheriv("aes-128-gcm", contentEncryptionKey, nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096);
  return Buffer.concat([
    salt,
    recordSize,
    Buffer.from([serverPublicKey.length]),
    serverPublicKey,
    encrypted,
  ]);
}

async function sendOne(subscription: PushSubscriptionRow, payload: PushPayload) {
  const authorization = createVapidAuthorization(subscription.endpoint);
  if (!authorization) return;
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "normal",
    },
    body: encryptPayload(subscription, payload),
  });

  if (response.ok) {
    await query(
      "UPDATE push_subscriptions SET last_success_at=now(),last_error=null,updated_at=now() WHERE id=$1",
      [subscription.id],
    );
    return;
  }
  if (response.status === 404 || response.status === 410) {
    await query("UPDATE push_subscriptions SET active=false,updated_at=now() WHERE id=$1", [
      subscription.id,
    ]);
    return;
  }
  await query("UPDATE push_subscriptions SET last_error=$2,updated_at=now() WHERE id=$1", [
    subscription.id,
    `HTTP ${response.status}`,
  ]);
}

export function pushIsConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export async function sendCompanyPush(companyId: string, payload: PushPayload) {
  if (!pushIsConfigured()) return;
  const subscriptions = await query<PushSubscriptionRow>(
    "SELECT id,endpoint,p256dh,auth FROM push_subscriptions WHERE company_id=$1 AND active=true",
    [companyId],
  );
  await Promise.allSettled(
    subscriptions.rows.map((subscription) => sendOne(subscription, payload)),
  );
}
