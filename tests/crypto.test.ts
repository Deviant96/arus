import { describe, expect, it } from 'vitest'
import { encryptSecret, decryptSecret, sha256Hex } from '../server/utils/crypto'

describe('AES-256-GCM secret encryption', () => {
  const secret = 'test-encryption-key-please-change'

  it('round-trips a user API key', () => {
    const cipher = encryptSecret('sk-test-secret-key', secret)
    expect(cipher.startsWith('v1:')).toBe(true)
    expect(cipher).not.toContain('sk-test')
    expect(decryptSecret(cipher, secret)).toBe('sk-test-secret-key')
  })

  it('fails to decrypt with the wrong key', () => {
    const cipher = encryptSecret('sk-test', secret)
    expect(() => decryptSecret(cipher, 'wrong-key')).toThrow()
  })

  it('rejects malformed ciphertext', () => {
    expect(() => decryptSecret('not-valid', secret)).toThrow()
  })
})

describe('sha256Hex', () => {
  it('is deterministic', () => {
    expect(sha256Hex('hello')).toBe(sha256Hex('hello'))
    expect(sha256Hex('hello')).not.toBe(sha256Hex('world'))
    expect(sha256Hex('hello')).toHaveLength(64)
  })
})
