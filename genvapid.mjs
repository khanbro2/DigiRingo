import crypto from "node:crypto";
const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const spki = publicKey.export({ type: "spki", format: "der" });
const point = spki.subarray(spki.length - 65); // 0x04||X||Y (uncompressed, 65 bytes)
const vapidPublic = point.toString("base64url");
const privPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString().trim();
console.log("VAPID_PUBLIC=" + vapidPublic);
console.log("VAPID_PRIVATE_B64=" + Buffer.from(privPem).toString("base64"));
// sanity: reconstruct + sign test
const key = crypto.createPrivateKey(privPem);
const sig = crypto.sign("SHA256", Buffer.from("test"), { key, dsaEncoding: "ieee-p1363" });
console.log("sign OK len=" + sig.length + " (want 64)");
