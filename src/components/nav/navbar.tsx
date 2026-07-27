import { Link, useLoaderData, useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { TiArrowSortedDown, TiArrowSortedUp } from "react-icons/ti"
import { css, cx } from "styled-system/css"
import { openModal } from "#/lib/modal"
import { trpc } from "#/server/client"
import { formatUserAvatar, formatUsersName } from "../user/utils"
import { AuthModal } from "./auth-modal"
import { Logo } from "./logo"
import { container } from "./nav-styling"

const authButtonStyles = css({
	background: { base: "coral", _hover: "coral.dark" },
	color: "sand",
	fontWeight: "bold",
	py: "2",
	px: "5",
	borderRadius: "full",
	fontSize: "sm",
	textDecoration: "none",
	cursor: "pointer",
	whiteSpace: "nowrap",
	border: "none",
})

const menuLinkStyles = css({
	display: "block",
	width: "100%",
	textAlign: "left",
	py: "2",
	px: "3",
	borderRadius: "lg",
	fontWeight: "600",
	fontSize: "sm",
	cursor: "pointer",
	_hover: { background: "rgba(27,42,74,0.06)" },
})

export function Navbar() {
	const user = useLoaderData({ from: "/_layout" })
	const router = useRouter()
	const [isOpen, setIsOpen] = useState(false)

	const handleLogout = async () => {
		setIsOpen(false)
		await trpc.auth.logout.mutate()
		await router.invalidate()
	}

	return (
		<nav className={container}>
			<Logo />
			{user ? (
				<div className={css({ position: "relative" })}>
					<button
						type="button"
						className={css({
							display: "flex",
							alignItems: "center",
							gap: "2",
							fontWeight: "700",
							fontSize: "sm",
							color: "#fff",
							cursor: "pointer",
						})}
						onClick={() => setIsOpen((prev) => !prev)}
					>
						<span
							className={css({
								width: "8",
								height: "8",
								borderRadius: "50%",
								background: "gold",
								color: "ink",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								flexShrink: 0,
								fontFamily: "heading",
								fontWeight: "extrabold",
								fontSize: "xs",
							})}
						>
							{formatUserAvatar(user)}
						</span>
						{formatUsersName(user)}
						<span
							className={css({
								color: "rgba(255,246,237,0.6)",
								fontSize: "xs",
							})}
						>
							{isOpen ? <TiArrowSortedUp /> : <TiArrowSortedDown />}
						</span>
					</button>
					<div
						className={css({
							position: "absolute",
							top: "calc(100% + 0.6rem)",
							right: 0,
							minWidth: "11rem",
							background: "sand",
							borderRadius: "xl",
							padding: "2",
							boxShadow: "0 12px 30px rgba(27,42,74,0.3)",
							display: isOpen ? "flex" : "none",
							zIndex: 90,
							flexDirection: "column",
						})}
					>
						<Link
							to={"/user/$userId"}
							params={{ userId: user.id }}
							className={menuLinkStyles}
							onClick={() => setIsOpen(false)}
						>
							My account
						</Link>
						<button
							type="button"
							onClick={handleLogout}
							className={cx(menuLinkStyles, css({ color: "coral.dark" }))}
						>
							Sign out
						</button>
					</div>
				</div>
			) : (
				<button
					type="button"
					className={authButtonStyles}
					onClick={() => openModal(<AuthModal />)}
				>
					Sign up
				</button>
			)}
		</nav>
	)
}
