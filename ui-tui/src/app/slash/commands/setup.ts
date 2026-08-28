import { withInkSuspended } from '@work4you/ink'

import { firstRunSetupLaunchArgs } from '../../../content/setup.js'
import { launchWork4YouCommand } from '../../../lib/externalCli.js'
import { runExternalSetup } from '../../setupHandoff.js'
import type { SlashCommand } from '../types.js'

export const setupCommands: SlashCommand[] = [
  {
    help: 'sign in with Work4You Portal, or run the setup wizard',
    name: 'setup',
    run: (arg, ctx) =>
      void runExternalSetup({
        args: firstRunSetupLaunchArgs(ctx.ui.status, arg.split(/\s+/).filter(Boolean)),
        ctx,
        done: 'setup complete — starting session…',
        launcher: launchWork4YouCommand,
        suspend: withInkSuspended
      })
  }
]
