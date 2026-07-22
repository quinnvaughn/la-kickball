import { Link, type LinkComponentProps } from "@tanstack/react-router"
import { ChevronRight } from "lucide-react"
import type { ReactNode } from "react"
import { css, cx } from "styled-system/css"

const listStyles = css({
	display: "flex",
	alignItems: "center",
	gap: "1.5",
	listStyle: "none",
	fontSize: "sm",
})

const itemStyles = css({
	display: "flex",
	alignItems: "center",
	gap: "1.5",
})

const linkStyles = css({
	color: "teal.dark",
	textDecoration: { base: "none", _hover: "underline" },
	fontWeight: "medium",
})

const currentLinkStyles = css({
	fontFamily: "label",
	fontSize: "xs",
	color: "rgba(27,42,74,0.5)",
})

function Root({
	children,
	className,
}: {
	children: ReactNode
	className?: string
}) {
	return (
		<nav aria-label="breadcrumb" className={className}>
			<ol className={listStyles}>{children}</ol>
		</nav>
	)
}

function Item({ children }: { children: ReactNode }) {
	return <li className={itemStyles}>{children}</li>
}

function BreadcrumbLink({ className, ...props }: LinkComponentProps<"a">) {
	return <Link {...props} className={cx(linkStyles, className)} />
}

function CurrentLink({ children }: { children: ReactNode }) {
	return (
		<span aria-current="page" className={currentLinkStyles}>
			{children}
		</span>
	)
}

function Divider() {
	return (
		<ChevronRight
			size={14}
			aria-hidden
			className={css({ color: "rgba(27,42,74,0.35)" })}
		/>
	)
}

export const Breadcrumb = Object.assign(Root, {
	Item,
	Link: BreadcrumbLink,
	CurrentLink,
	Divider,
})
