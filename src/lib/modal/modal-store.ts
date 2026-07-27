import { Store } from "@tanstack/store"
import type { ReactNode } from "react"

type ModalState = {
	content: ReactNode | null
}

export const modalStore = new Store<ModalState>({ content: null })

export function openModal(content: ReactNode) {
	modalStore.setState(() => ({ content }))
}

export function closeModal() {
	modalStore.setState(() => ({ content: null }))
}
