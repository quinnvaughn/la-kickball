import type { ReactNode } from "react"
import { css, cx } from "styled-system/css"

const overlayStyles = css({
	position: "fixed",
	inset: "0",
	background: "rgba(27,42,74,0.55)",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	padding: "4",
	zIndex: "modal",
})

const panelStyles = css({
	background: "sand",
	borderRadius: "xl",
	padding: "9",
	width: "full",
	maxWidth: "26rem",
	position: "relative",
	boxShadow: "0 20px 50px rgba(27,42,74,0.35)",
})

const closeButtonStyles = css({
	position: "absolute",
	top: "4",
	right: "4.5",
	background: "none",
	border: "none",
	fontSize: "xl",
	lineHeight: "1",
	color: "rgba(27,42,74,0.4)",
	cursor: "pointer",
	_hover: { color: "ink" },
})

const headerStyles = css({
	marginBottom: "5",
})

const titleStyles = css({
	fontFamily: "heading",
	fontWeight: "extrabold",
	fontSize: "2xl",
	color: "purple.dark",
})

const subtitleStyles = css({
	margin: "1.5 0 0",
	fontSize: "sm",
	color: "rgba(27,42,74,0.6)",
})

const bodyStyles = css({
	marginBottom: "5",
})

const footerStyles = css({
	display: "flex",
	flexDirection: "column",
	gap: "3",
})

const actionButtonStyles = css({
	width: "full",
	fontFamily: "heading",
	fontWeight: "bold",
	fontSize: "md",
	padding: "3.5",
	borderRadius: "full",
	cursor: "pointer",
	_disabled: {
		cursor: "not-allowed",
		opacity: "0.5",
	},
})

const submitStyles = css({
	background: "coral",
	color: "white",
	border: "none",
	_hover: { background: "coral.dark" },
	_disabled: { _hover: { background: "coral" } },
})

const cancelStyles = css({
	background: "none",
	color: "purple.dark",
	border: "2px solid",
	borderColor: "purple",
})

const switchRowStyles = css({
	textAlign: "center",
	margin: "5 0 0",
	fontSize: "sm",
	color: "rgba(27,42,74,0.6)",
})

const switchLinkStyles = css({
	color: "teal.dark",
	fontWeight: "bold",
	background: "none",
	border: "none",
	cursor: "pointer",
	textDecoration: "none",
	_hover: { textDecoration: "underline" },
})

function Root({
	open,
	onClose,
	children,
	className,
}: {
	open: boolean
	onClose: () => void
	children: ReactNode
	className?: string
}) {
	if (!open) return null
	return (
		// biome-ignore lint: overlay click-to-close is intentional, panel stops propagation
		<div className={overlayStyles} onClick={onClose}>
			<div
				role="dialog"
				aria-modal="true"
				className={cx(panelStyles, className)}
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
			>
				<button
					type="button"
					aria-label="Close"
					onClick={onClose}
					className={closeButtonStyles}
				>
					&times;
				</button>
				{children}
			</div>
		</div>
	)
}

function Header({ children }: { children: ReactNode }) {
	return <div className={headerStyles}>{children}</div>
}

function Title({ children }: { children: ReactNode }) {
	return <h2 className={titleStyles}>{children}</h2>
}

function Subtitle({ children }: { children: ReactNode }) {
	return <p className={subtitleStyles}>{children}</p>
}

function Body({
	children,
	className,
}: {
	children: ReactNode
	className?: string
}) {
	return <div className={cx(bodyStyles, className)}>{children}</div>
}

function Footer({ children }: { children: ReactNode }) {
	return <div className={footerStyles}>{children}</div>
}

function SubmitButton({
	children,
	disabled,
}: {
	children: ReactNode
	disabled?: boolean
}) {
	return (
		<button
			type="submit"
			className={cx(actionButtonStyles, submitStyles)}
			disabled={disabled}
		>
			{children}
		</button>
	)
}

function CancelButton({
	children,
	disabled,
	onClick,
}: {
	children: ReactNode
	disabled?: boolean
	onClick?: () => void
}) {
	return (
		<button
			type="button"
			className={cx(actionButtonStyles, cancelStyles)}
			disabled={disabled}
			onClick={onClick}
		>
			{children}
		</button>
	)
}

function SwitchPrompt({ children }: { children: ReactNode }) {
	return <p className={switchRowStyles}>{children}</p>
}

export const Modal = Object.assign(Root, {
	Header,
	Title,
	Subtitle,
	Body,
	Footer,
	SwitchPrompt,
	SubmitButton,
	CancelButton,
	SwitchLink: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
		<button type="button" className={switchLinkStyles} {...props} />
	),
})
