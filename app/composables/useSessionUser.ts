import type { UserDto } from '#shared/types/api'
import { cacheGet, cacheSet, cacheClear } from '../utils/idb'

/** The full user profile (preferences, currency, timezone). */
export function useSessionUser() {
  const user = useState<UserDto | null>('session-user', () => null)

  async function load(force = false) {
    if (user.value && !force) return user.value
    try {
      const res = await $fetch<{ user: UserDto }>('/api/auth/me')
      user.value = res.user
      if (import.meta.client) cacheSet('me', res.user)
    }
    catch (err: any) {
      const status = err?.statusCode ?? err?.status
      if (import.meta.client && (!status || status >= 500)) {
        const hit = await cacheGet<UserDto>('me')
        if (hit) user.value = hit.data
      }
      else if (status === 401) {
        user.value = null
      }
    }
    return user.value
  }

  async function logout() {
    const { clear } = useUserSession()
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    }
    catch { /* clearing locally regardless */ }
    await clear()
    user.value = null
    await cacheClear()
    await navigateTo('/auth/login')
  }

  return { user, load, logout }
}
