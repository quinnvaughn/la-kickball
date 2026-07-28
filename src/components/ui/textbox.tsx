import {
	createContext,
	type ReactNode,
	type TextareaHTMLAttributes,
	useContext,
	useId,
} from "react"
import { css, cx } from "styled-system/css"

const fieldStyles = css({
	display: "flex",
	flexDirection: "column",
	gap: "1.5",
	width: "full",
})

const labelStyles = css({
	fontFamily: "label",
	fontSize: "xs",
	textTransform: "uppercase",
	letterSpacing: "wide",
	color: "purple.dark",
})

const requiredMarkStyles = css({
	color: "coral.dark",
})

const textareaStyles = css({
	width: "full",
	py: "2.5",
	px: "3",
	borderRadius: "lg",
	border: "1px solid rgba(27,42,74,0.2)",
	fontSize: "sm",
	fontFamily: "inherit",
	background: "white",
	color: "ink",
	resize: "vertical",
	_focus: {
		outline: "2px solid",
		outlineColor: "teal.dark",
		outlineOffset: "1px",
		borderColor: "transparent",
	},
})

const invalidTextareaStyles = css({
	borderColor: "coral.dark",
	_focus: { outlineColor: "coral.dark" },
})

const hintStyles = css({
	fontSize: "xs",
	color: "rgba(27,42,74,0.55)",
})

const errorStyles = css({
	fontSize: "xs",
	color: "coral.dark",
	fontWeight: "medium",
})

type TextboxContextValue = {
	id: string
	required?: boolean
	error?: string | null
	hintId: string
	errorId: string
	textareaProps: TextareaHTMLAttributes<HTMLTextAreaElement>
}

const TextboxContext = createContext<TextboxContextValue | null>(null)

function useTextboxContext() {
	const ctx = useContext(TextboxContext)
	if (!ctx) throw new Error("Textbox parts must be used inside Textbox.Root")
	return ctx
}

function Root({
	id,
	required,
	error,
	className,
	children,
	...textareaProps
}: {
	id?: string
	required?: boolean
	error?: string | null
	className?: string
	children: ReactNode
} & TextareaHTMLAttributes<HTMLTextAreaElement>) {
	const generatedId = useId()
	const fieldId = id ?? generatedId

	return (
		<TextboxContext.Provider
			value={{
				id: fieldId,
				required,
				error,
				hintId: `${fieldId}-hint`,
				errorId: `${fieldId}-error`,
				textareaProps,
			}}
		>
			<div className={cx(fieldStyles, className)}>{children}</div>
		</TextboxContext.Provider>
	)
}

function Label({ children }: { children: ReactNode }) {
	const { id, required } = useTextboxContext()
	return (
		<label className={labelStyles} htmlFor={id}>
			{children} {required && <span className={requiredMarkStyles}>*</span>}
		</label>
	)
}

function Textarea({
	className,
	rows,
}: {
	className?: string
	rows?: number
}) {
	const { id, required, error, hintId, errorId, textareaProps } =
		useTextboxContext()
	const describedBy =
		[error ? errorId : null, hintId].filter(Boolean).join(" ") || undefined

	return (
		<textarea
			id={id}
			required={required}
			rows={rows}
			aria-invalid={!!error}
			aria-describedby={describedBy}
			className={cx(textareaStyles, error && invalidTextareaStyles, className)}
			{...textareaProps}
		/>
	)
}

function Hint({ children }: { children: ReactNode }) {
	const { hintId } = useTextboxContext()
	return (
		<p id={hintId} className={hintStyles}>
			{children}
		</p>
	)
}

function ErrorComponent() {
	const { error, errorId } = useTextboxContext()
	if (!error) return null
	return (
		<p id={errorId} role="alert" className={errorStyles}>
			{error}
		</p>
	)
}

export const Textbox = Object.assign(Root, {
	Label,
	Textarea,
	Hint,
	Error: ErrorComponent,
})
