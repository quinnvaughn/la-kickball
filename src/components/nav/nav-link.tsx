import { Link, type LinkComponentProps } from "@tanstack/react-router"
import { css, cx } from "styled-system/css"

const linkStyles = css({
	color: {
		base: "rgba(255, 246, 237, 0.8)",
		_hover: "rgba(255, 246, 237, 1)",
	},
	textDecoration: "none",
	fontWeight: "semibold",
	fontSize: "sm",
})

type Props =
	| ({ external?: false } & LinkComponentProps<"a">)
	| ({ external: true } & React.ComponentProps<"a">)

export function NavLink({ external, className, ...props }: Props) {
	if (external) {
		return (
			<a
				{...(props as React.ComponentProps<"a">)}
				target="_blank"
				rel="noopener noreferrer"
				className={cx(linkStyles, className)}
			/>
		)
	}

	return (
		<Link
			{...(props as LinkComponentProps<"a">)}
			className={cx(linkStyles, className)}
		/>
	)
}
