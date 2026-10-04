import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import type { MessagingPlatformInfo } from '@/types/work4you'

import { channelCardDescription } from './channel-kinds'
import { PlatformAvatar } from './platform-icon'

/** Discover card: the channel's logo on a white tile, its name, a line on what
 *  it is for, and Connect at the top right. The card body and Connect both
 *  open the channel's setup. */
export function ChannelCard({ onConnect, platform }: { onConnect: () => void; platform: MessagingPlatformInfo }) {
  const { t } = useI18n()
  const description = channelCardDescription(platform, t.messaging)

  return (
    <div className="group/card flex min-w-0 items-start gap-3 rounded-xl border border-(--ui-stroke-quaternary) p-3 focus-within:bg-(--ui-sidebar-surface-background) hover:bg-(--ui-sidebar-surface-background)">
      <button className="flex min-w-0 flex-1 items-start gap-3 text-left" onClick={onConnect} type="button">
        <PlatformAvatar
          className="size-9 rounded-lg"
          glyphClassName="size-[1.125rem]"
          platformId={platform.id}
          platformName={platform.name}
          variant="tile"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{platform.name}</span>
          {description ? (
            <span className="mt-0.5 line-clamp-2 text-xs leading-4 text-(--ui-text-tertiary)">{description}</span>
          ) : null}
        </span>
      </button>
      <Button className="shrink-0" onClick={onConnect} size="xs" variant="text">
        {t.common.connect}
      </Button>
    </div>
  )
}
