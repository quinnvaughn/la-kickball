import { css } from "styled-system/css"

type Props = {
	url: string
	name: string
}

export function LeagueLocationLink({ url, name }: Props) {
	return (
		<a
			href={url}
			target="_blank"
			rel="noreferrer nofollow"
			className={css({ color: "teal.dark", textDecoration: "underline" })}
		>
			{name}
		</a>
	)
}
