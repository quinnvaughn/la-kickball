import { defineConfig } from "@pandacss/dev"

export default defineConfig({
	preflight: true,
	jsxFramework: "react",
	include: ["./src/**/*.{ts,tsx}"],
	exclude: [],
	outdir: "styled-system",
	globalCss: {
		body: {
			fontFamily: "body",
			backgroundColor: 'sand',
			color: 'ink',
		},
	},
	theme: {
		extend: {
			tokens: {
				fonts: {
					body: { value: '"Nunito Sans", sans-serif' },
					heading: { value: '"Baloo 2", sans-serif' },
					label: {value: '"Space Mono", monospace'},
				},
				colors: {
					coral: {
						DEFAULT: { value: "#FF6B4A" },
						dark: { value: "#C2401F" },
					},
					gold: {
						DEFAULT: { value: "#FFB627" },
						dark: { value: "#8A5C00" },
					},
					purple: {
						DEFAULT: { value: "#6B4984" },
						dark: { value: "#3F2A4E" },
					},
					teal: {
						DEFAULT: { value: "#00A99D" },
						dark: { value: "#00625A" },
					},
					sand: {
						DEFAULT: { value: "#FFF6ED" },
					},
					ink: {
						DEFAULT: { value: "#1B2A4A" },
					},
				},
			},
		},
	},
})
