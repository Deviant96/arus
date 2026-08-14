import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

/**
 * AES-256-GCM encryption for user AI API keys.
 * The encryption key is derived from NUXT_AI_ENCRYPTION_KEY (environment).
 * Ciphertext format: v1:<iv b64>:<auth tag b64>:<data b64>
 */
function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest()
}

export function encryptSecret(plaintext: string, secret: string): string {
  if (!secret) throw new Error('Encryption key is not configured (NUXT_AI_ENCRYPTION_KEY)')
  const key = deriveKey(secret)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`
}

export function decryptSecret(ciphertext: string, secret: string): string {
  if (!secret) throw new Error('Encryption key is not configured (NUXT_AI_ENCRYPTION_KEY)')
  const [version, ivB64, tagB64, dataB64] = ciphertext.split(':')
  if (version !== 'v1' || !ivB64 || !tagB64 || !dataB64) throw new Error('Invalid ciphertext format')
  const key = deriveKey(secret)
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8')
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex')
}
