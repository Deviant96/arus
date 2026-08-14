export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession()

  const isAuthRoute = to.path.startsWith('/auth')
  if (!loggedIn.value && !isAuthRoute) {
    return navigateTo(`/auth/login${to.fullPath !== '/' ? `?redirect=${encodeURIComponent(to.fullPath)}` : ''}`)
  }
  if (loggedIn.value && isAuthRoute) {
    return navigateTo('/')
  }
})
