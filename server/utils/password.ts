import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

/**
 * Standalone scrypt password hashing (no framework dependency, so the seed
 * script and tests can use it too).
 * Format: scrypt$N$r$p$salt(base64)$hash(base64)
 */
const N = 16384
const R = 8
const P = 1
const KEYLEN = 64

function scryptAsync(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEYLEN, { N: n, r, p, maxmem: 128 * 1024 * 1024 }, (err, key) => {
      if (err) reject(err)
      else resolve(key)
    })
  })
}

export async function hashUserPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await scryptAsync(password, salt, N, R, P)
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`
}

export async function verifyUserPassword(hash: string, password: string): Promise<boolean> {
  try {
    const [algo, nStr, rStr, pStr, saltB64, keyB64] = hash.split('$')
    if (algo !== 'scrypt' || !nStr || !rStr || !pStr || !saltB64 || !keyB64) return false
    const expected = Buffer.from(keyB64, 'base64')
    const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64'), Number(nStr), Number(rStr), Number(pStr))
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  }
  catch {
    return false
  }
}
