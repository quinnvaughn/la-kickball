import { createFileRoute, Outlet } from "@tanstack/react-router"
import { css } from "styled-system/css"
import { Footer } from "#/components/nav/footer"
import { Topbar } from "#/components/nav/topbar"

export const Route = createFileRoute("/_layout")({
	component: Layout,
})

function Layout() {
	return (
		<div
			className={css({
				display: "flex",
				flexDirection: "column",
				minH: "100vh",
			})}
		>
			<Topbar />
			<div className={css({ flex: "1" })}>
				<Outlet />
			</div>
			<Footer />
		</div>
	)
}
