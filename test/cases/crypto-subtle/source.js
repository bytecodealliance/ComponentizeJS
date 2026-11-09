const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}

function fromHex(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function importAesKey(key, usage) {
  return crypto.subtle.importKey('raw', key, { name: 'AES-CBC' }, false, [
    usage,
  ]);
}

export const exports = {
  async pbkdf2Sha256(password, salt, iterations, length) {
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits'],
    );
    const bits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt: encoder.encode(salt),
        iterations,
      },
      key,
      length,
    );
    return toHex(bits);
  },

  async aesCbcEncrypt(key, iv, plaintext) {
    const cryptoKey = await importAesKey(key, 'encrypt');
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-CBC', iv },
      cryptoKey,
      encoder.encode(plaintext),
    );
    return toHex(ciphertext);
  },

  async aesCbcDecrypt(key, iv, ciphertext) {
    const cryptoKey = await importAesKey(key, 'decrypt');
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-CBC', iv },
      cryptoKey,
      fromHex(ciphertext),
    );
    return decoder.decode(plaintext);
  },
};
