import { createContext, type ReactNode, useContext } from "react"
import { TiArrowSortedDown, TiArrowSortedUp } from "react-icons/ti"
import { css, cx } from "styled-system/css"

type SortDir = "asc" | "desc"

// Untyped at the context boundary (Key erased to string) so one context
// can back a `Table.Root<Key>` for any column key union - each call site
// gets its own typed `sortBy`/`onSort` back through the generic props.
type TableContextValue = {
	sortBy: string
	sortDir: SortDir
	onSort?: (key: string) => void
}

const TableContext = createContext<TableContextValue | null>(null)

function useTableContext() {
	const ctx = useContext(TableContext)
	if (!ctx) {
		throw new Error("Table subcomponents must be rendered within Table.Root")
	}
	return ctx
}

const tableStyle = css({
	width: "100%",
	minWidth: "900px",
	borderCollapse: "collapse",
	fontFamily: "body",
	background: "#fff",
	borderRadius: "2xl",
	overflow: "hidden",
	borderColor: "border",
	borderWidth: "1px",
	borderStyle: "solid",
})

function thStyle(isActive: boolean, sortable: boolean) {
	return css({
		color: isActive ? "purple.dark" : "subtitle",
		fontSize: "sm",
		fontFamily: "heading",
		textTransform: "uppercase",
		opacity: isActive ? "1" : "0.8",
		cursor: sortable ? "pointer" : "default",
		borderBottomColor: "ink",
		borderBottomWidth: "1px",
		borderBottomStyle: "solid",
		userSelect: "none",
		whiteSpace: "nowrap",
		textAlign: "left",
		padding: "4",
	})
}

const headerLabelStyle = css({
	display: "inline-flex",
	alignItems: "center",
	gap: "1",
	whiteSpace: "nowrap",
})

const tdStyle = css({
	fontSize: "sm",
	borderBottomColor: "border",
	borderBottomWidth: "1px",
	borderBottomStyle: "solid",
	whiteSpace: "nowrap",
	padding: "4",
})

const numStyle = css({
	textAlign: "right",
})

function Root<Key extends string>({
	sortBy,
	sortDir,
	onSort,
	children,
}: {
	sortBy: Key
	sortDir: SortDir
	onSort?: (key: Key) => void
	children: ReactNode
}) {
	return (
		<TableContext.Provider
			value={{ sortBy, sortDir, onSort: onSort as TableContextValue["onSort"] }}
		>
			<div className={css({ overflowX: "auto" })}>
				<table className={tableStyle}>{children}</table>
			</div>
		</TableContext.Provider>
	)
}

function Head<Key extends string>({
	columns,
}: {
	columns: { key: Key; label: string; sortable?: boolean }[]
}) {
	const { sortBy, sortDir, onSort } = useTableContext()

	return (
		<thead>
			<tr>
				{columns.map(({ key, label, sortable = true }) => {
					const isActive = sortable && sortBy === key
					const canSort = sortable && !!onSort
					const Icon =
						isActive && sortDir === "asc" ? TiArrowSortedUp : TiArrowSortedDown

					return (
						<th
							key={key}
							onClick={canSort ? () => onSort?.(key) : undefined}
							className={thStyle(isActive, canSort)}
						>
							<span className={headerLabelStyle}>
								{label}
								{sortable && <Icon />}
							</span>
						</th>
					)
				})}
			</tr>
		</thead>
	)
}

function Body({ children }: { children: ReactNode }) {
	return <tbody>{children}</tbody>
}

function Row({ children }: { children: ReactNode }) {
	return <tr>{children}</tr>
}

function Cell({
	children,
	numeric,
}: {
	children: ReactNode
	numeric?: boolean
}) {
	return <td className={numeric ? cx(tdStyle, numStyle) : tdStyle}>{children}</td>
}

const pageButtonStyle = css({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	minWidth: "9",
	height: "9",
	px: "3",
	borderRadius: "lg",
	borderWidth: "1px",
	borderStyle: "solid",
	borderColor: "border",
	fontFamily: "label",
	fontSize: "sm",
	background: "#fff",
})

const pageActiveStyle = css({
	background: "purple.dark",
	color: "#fff6ed",
	borderColor: "purple.dark",
})

const pageDisabledStyle = css({
	opacity: "0.4",
	cursor: "not-allowed",
})

const pageLinkStyle = css({
	cursor: "pointer",
	_hover: { borderColor: "purple.dark" },
})

const paginationRowStyle = css({
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	gap: "3",
	pt: "6",
})

// Always shows first/last page plus a window around the current page,
// collapsing the rest into an ellipsis - avoids a wall of page numbers
// once there are more than a handful of pages.
type PageItem = number | "ellipsis"

function buildPageItems(current: number, total: number): PageItem[] {
	if (total <= 7) {
		return Array.from({ length: total }, (_, i) => i + 1)
	}

	const items: PageItem[] = [1]
	const start = Math.max(2, current - 1)
	const end = Math.min(total - 1, current + 1)

	if (start > 2) items.push("ellipsis")
	for (let page = start; page <= end; page++) items.push(page)
	if (end < total - 1) items.push("ellipsis")

	items.push(total)

	return items
}

function PageButton({
	page,
	active,
	disabled,
	renderLink,
	children,
}: {
	page: number
	active?: boolean
	disabled?: boolean
	renderLink: (page: number, children: ReactNode, className: string) => ReactNode
	children: ReactNode
}) {
	if (active) {
		return <span className={cx(pageButtonStyle, pageActiveStyle)}>{children}</span>
	}

	if (disabled) {
		return (
			<span className={cx(pageButtonStyle, pageDisabledStyle)}>{children}</span>
		)
	}

	return <>{renderLink(page, children, cx(pageButtonStyle, pageLinkStyle))}</>
}

function Pagination({
	page,
	totalPages,
	renderLink,
}: {
	page: number
	totalPages: number
	// The Table has no knowledge of routing, so the caller is responsible
	// for rendering the actual <Link> (with its route-specific `to`/params)
	// around the given children, using the given className for button styling.
	renderLink: (page: number, children: ReactNode, className: string) => ReactNode
}) {
	return (
		<div className={paginationRowStyle}>
			<PageButton page={page - 1} disabled={page <= 1} renderLink={renderLink}>
				← Prev
			</PageButton>
			{buildPageItems(page, totalPages).map((item, i) =>
				item === "ellipsis" ? (
					// biome-ignore lint/suspicious/noArrayIndexKey: ellipsis positions are stable per render
					<span key={`ellipsis-${i}`}>...</span>
				) : (
					<PageButton
						key={item}
						page={item}
						active={item === page}
						renderLink={renderLink}
					>
						{item}
					</PageButton>
				),
			)}
			<PageButton
				page={page + 1}
				disabled={page >= totalPages}
				renderLink={renderLink}
			>
				Next →
			</PageButton>
		</div>
	)
}

export const Table = Object.assign(Root, {
	Head,
	Body,
	Row,
	Cell,
	Pagination,
})
