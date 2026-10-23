// Prints fresh secrets for .env: an encryption key for X tokens and a web-push VAPID key pair.
import { randomBytes } from 'node:crypto';
import webpush from 'web-push';

const vapid = webpush.generateVAPIDKeys();

console.log(`ENCRYPTION_KEY=${randomBytes(32).toString('base64url')}`);
console.log(`VAPID_PUBLIC_KEY=${vapid.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapid.privateKey}`);
