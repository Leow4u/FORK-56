import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import type { MessagingPlatformInfo } from '@/types/work4you'

import { MCP_CONNECTOR_CARD_CLASS } from '../skills/mcp-catalog-chrome'

import { channelCardDescription } from './channel-kinds'
import { PlatformAvatar } from './platform-icon'

/** Discover card: the MCP Discover card's chrome with the channel's own icon
 *  and a line on what the channel is for. The card body and its Connect
 *  button both open the channel's setup. */
export function ChannelCard({ onConnect, platform }: { onConnect: () => void; platform: MessagingPlatformInfo }) {
  const { t } = useI18n()
  const description = channelCardDescription(platform, t.messaging)

  return (
    <div className={MCP_CONNECTOR_CARD_CLASS}>
      <div className="flex items-start gap-2.5">
        <button className="flex min-w-0 flex-1 items-center gap-2.5 text-left" onClick={onConnect} type="button">
          <PlatformAvatar className="size-8" platformId={platform.id} platformName={platform.name} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.82rem] font-medium text-foreground/85">{platform.name}</span>
            {description ? (
              <span className="mt-0.5 line-clamp-2 text-[0.68rem] text-muted-foreground/70">{description}</span>
            ) : null}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button onClick={onConnect} size="xs" variant="text">
            {t.common.connect}
          </Button>
        </div>
      </div>
    </div>
  )
}
