import { css } from "styled-system/css"
import type { SeasonMvp } from "#/server/domain/schedule"
import { MVPCard } from "../mvp/mvp-card"
import { SectionBlock } from "../ui/section-block"

type Props = {
	mvp: SeasonMvp | null
}

export function RegularSeasonMVP({ mvp }: Props) {
	return (
		mvp && (
			<SectionBlock heading="Regular season MVP">
				<div className={css({ maxWidth: "sm" })}>
					<MVPCard category="season" mvp={mvp} />
				</div>
			</SectionBlock>
		)
	)
}
