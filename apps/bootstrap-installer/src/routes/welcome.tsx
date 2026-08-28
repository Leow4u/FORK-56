import { BrandMark } from '../components/brand-mark'
import { Button } from '../components/button'
import { startInstall } from '../store'

/*
 * Welcome screen.
 *
 * Same quiet hero the rest of the product uses after the visual-identity
 * pass: BrandMark + sentence-case headline + muted tagline + the system
 * ink Button. Copy and the startInstall() click are unchanged.
 */
export default function Welcome() {
  return (
    <div className="work4you-fade-in relative flex h-full flex-col items-center justify-center px-8 py-10">
      <div className="work4you-glow pointer-events-none absolute inset-0" />
      <div className="relative flex w-full max-w-md flex-col items-center gap-8 text-center">
        <BrandMark className="size-16" />
        <div className="min-w-0">
          <h1 className="mb-2 text-xl font-semibold leading-snug tracking-tight text-foreground">Work4You</h1>
          <p className="m-0 text-sm leading-normal tracking-tight text-muted-foreground">
            The agent that grows with you. We&rsquo;ll set things up in the
            background &mdash; takes a few minutes.
          </p>
        </div>
        <Button onClick={() => void startInstall()} size="lg">
          Install
        </Button>
      </div>
    </div>
  )
}
