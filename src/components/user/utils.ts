import type { User } from "#/server"

type UserWithName = Pick<User, "lastName" | "firstName">

export function formatUsersName(user: UserWithName) {
	return `${user.firstName} ${user.lastName[0]}.`
}

export function formatUserAvatar(user: UserWithName) {
	return `${user.firstName[0]}${user.lastName[0]}`
}
