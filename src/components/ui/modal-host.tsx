import { useStore } from "@tanstack/react-store"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { modalStore } from "#/lib/modal"

export function ModalHost() {
	const [mounted, setMounted] = useState(false)
	const content = useStore(modalStore, (s) => s.content)

	useEffect(() => {
		setMounted(true)
	}, [])

	if (!mounted || !content) return null

	return createPortal(content, document.body)
}
