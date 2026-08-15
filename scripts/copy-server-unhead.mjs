/**
 * Nitro can trace an incomplete unhead package into `.output/server/node_modules`
 * when two Unhead majors are present. Copy the real package so `unhead/server`
 * resolves at runtime in Docker (no parent node_modules).
 */
import { existsSync, cpSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const entry = fileURLToPath(import.meta.resolve('unhead/server'))
let src = dirname(entry)
while (src !== dirname(src) && !existsSync(join(src, 'package.json'))) {
  src = dirname(src)
}
if (!existsSync(join(src, 'package.json'))) {
  throw new Error(`Could not locate unhead package from ${entry}`)
}

const dest = join(process.cwd(), '.output/server/node_modules/unhead')
mkdirSync(dirname(dest), { recursive: true })
rmSync(dest, { recursive: true, force: true })
cpSync(src, dest, { recursive: true })
console.log(`[postbuild] copied unhead from ${src}`)
