/**
 * Nitro can trace an incomplete unhead package into `.output/server/node_modules`
 * when Nuxt 4.5 and @nuxt/ui disagree on Unhead majors. Copy the real package
 * so `unhead/server` resolves at runtime in Docker (no parent node_modules).
 */
import { createRequire } from 'node:module'
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const src = dirname(require.resolve('unhead/package.json'))
const dest = join(process.cwd(), '.output/server/node_modules/unhead')

mkdirSync(dirname(dest), { recursive: true })
rmSync(dest, { recursive: true, force: true })
cpSync(src, dest, { recursive: true })
console.log(`[postbuild] copied unhead from ${src}`)
