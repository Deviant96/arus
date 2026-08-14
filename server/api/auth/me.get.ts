import { toUserDto } from '../../services/mappers'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  return { user: toUserDto(user) }
})
