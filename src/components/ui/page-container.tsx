import type React from "react"
import { css } from "styled-system/css"

type Props = {
	children: React.ReactNode | React.ReactNode[]
}

export function PageContainer({ children }: Props) {
	return (
		<div className={css({ maxW: "5xl", mx: "auto", px: "8" })}> {children}</div>
	)
}
