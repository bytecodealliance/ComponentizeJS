import { strictEqual } from 'node:assert';

// Expected values computed with Node's crypto.pbkdf2Sync / createCipheriv.
const PBKDF2_SHA256_PASSWORD_SALT_1000_256 =
  '632c2812e46d4604102ba7618e9d6d7d2f8128f6266b4a03264d2a0460b7dcb3';

const AES_KEY = Uint8Array.from({ length: 32 }, (_, i) => i);
const AES_IV = Uint8Array.from({ length: 16 }, (_, i) => 0xf0 + i);
const PLAINTEXT = 'ComponentizeJS on StarlingMonkey v0.5.0';
const AES_256_CBC_CIPHERTEXT =
  'd6bf9b3184d17b8c5c442baea2bedf72562f2f644911d6f30ff228bbec182b1d' +
  'feca06a5be162d2a41ea85e29b152867';

export function test(instance) {
  const { exports } = instance;

  strictEqual(
    exports.pbkdf2Sha256('password', 'salt', 1000, 256),
    PBKDF2_SHA256_PASSWORD_SALT_1000_256,
  );

  const ciphertext = exports.aesCbcEncrypt(AES_KEY, AES_IV, PLAINTEXT);
  strictEqual(ciphertext, AES_256_CBC_CIPHERTEXT);
  strictEqual(exports.aesCbcDecrypt(AES_KEY, AES_IV, ciphertext), PLAINTEXT);
}
