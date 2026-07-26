import {
	createContext,
	type InputHTMLAttributes,
	type ReactNode,
	useContext,
	useId,
} from "react"
import { css, cx } from "styled-system/css"

const fieldStyles = css({
	display: "flex",
	flexDirection: "column",
	gap: "1.5",
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

const inputStyles = css({
	width: "full",
	py: "2.5",
	px: "3",
	borderRadius: "lg",
	border: "1px solid rgba(27,42,74,0.2)",
	fontSize: "sm",
	background: "white",
	color: "ink",
	_focus: {
		outline: "2px solid",
		outlineColor: "teal.dark",
		outlineOffset: "1px",
		borderColor: "transparent",
	},
})

const invalidInputStyles = css({
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

type TextFieldContextValue = {
	id: string
	required?: boolean
	error?: string | null
	hintId: string
	errorId: string
	inputProps: InputHTMLAttributes<HTMLInputElement>
}

const TextFieldContext = createContext<TextFieldContextValue | null>(null)

function useTextFieldContext() {
	const ctx = useContext(TextFieldContext)
	if (!ctx)
		throw new Error("TextField parts must be used inside TextField.Root")
	return ctx
}

function Root({
	id,
	required,
	error,
	className,
	children,
	...inputProps
}: {
	id?: string
	required?: boolean
	error?: string | null
	className?: string
	children: ReactNode
} & InputHTMLAttributes<HTMLInputElement>) {
	const generatedId = useId()
	const fieldId = id ?? generatedId

	return (
		<TextFieldContext.Provider
			value={{
				id: fieldId,
				required,
				error,
				hintId: `${fieldId}-hint`,
				errorId: `${fieldId}-error`,
				inputProps,
			}}
		>
			<div className={cx(fieldStyles, className)}>{children}</div>
		</TextFieldContext.Provider>
	)
}

function Label({ children }: { children: ReactNode }) {
	const { id, required } = useTextFieldContext()
	return (
		<label className={labelStyles} htmlFor={id}>
			{children} {required && <span className={requiredMarkStyles}>*</span>}
		</label>
	)
}

function Input({ className }: { className?: string }) {
	const { id, required, error, hintId, errorId, inputProps } =
		useTextFieldContext()
	const describedBy =
		[error ? errorId : null, hintId].filter(Boolean).join(" ") || undefined

	return (
		<input
			id={id}
			required={required}
			aria-invalid={!!error}
			aria-describedby={describedBy}
			className={cx(inputStyles, error && invalidInputStyles, className)}
			{...inputProps}
		/>
	)
}

function Hint({ children }: { children: ReactNode }) {
	const { hintId } = useTextFieldContext()
	return (
		<p id={hintId} className={hintStyles}>
			{children}
		</p>
	)
}

function ErrorComponent() {
	const { error, errorId } = useTextFieldContext()
	if (!error) return null
	return (
		<p id={errorId} role="alert" className={errorStyles}>
			{error}
		</p>
	)
}

export const TextField = Object.assign(Root, {
	Label,
	Input,
	Hint,
	Error: ErrorComponent,
})
