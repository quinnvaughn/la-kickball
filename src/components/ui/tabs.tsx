import { Link, type LinkComponentProps } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { css, cva, cx } from "styled-system/css"

const barStyles = css({
	display: "flex",
	gap: "1",
	overflowX: "auto",
})

const tab = cva({
	base: {
		fontFamily: "heading",
		fontWeight: "bold",
		py: "4",
		px: "5",
		border: "none",
		background: "none",
		color: "subtitle",
		cursor: "pointer",
		borderBottom: "3px solid transparent",
		whiteSpace: "nowrap",
		_hover: { color: "purple.dark" },
	},
	variants: {
		active: {
			true: {
				color: "gold.dark",
				borderBottomColor: "gold",
				_hover: {
					color: "gold.dark",
				},
			},
		},
	},
})

function Root({
	children,
	className,
}: {
	children: ReactNode
	className?: string
}) {
	return (
		<div role="tablist" aria-label="tabs" className={cx(barStyles, className)}>
			{children}
		</div>
	)
}

function RouteTab({ className, ...props }: LinkComponentProps<"a">) {
	return (
		<Link
			role="tab"
			className={cx(tab(), className)}
			activeProps={{ className: tab({ active: true }), "aria-selected": true }}
			{...props}
		/>
	)
}

function StateTab({
	active,
	onClick,
	children,
	className,
}: {
	active: boolean
	onClick: () => void
	children: ReactNode
	className?: string
}) {
	return (
		<button
			type="button"
			role="tab"
			aria-selected={active}
			onClick={onClick}
			className={cx(tab({ active }), className)}
		>
			{children}
		</button>
	)
}

export const Tabs = Object.assign(Root, {
	RouteTab,
	StateTab,
})
