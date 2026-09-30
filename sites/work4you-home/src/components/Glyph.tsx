import { APP_LOGOS, isAppGlyph } from '../lib/glyphs'
import type { GlyphName } from '../lib/glyphs'
import { Icon } from './Icon'
import styles from './Glyph.module.css'

interface GlyphProps {
  className?: string
  name: GlyphName
}

/** Logo de app (public/brand/apps) ou ícone de traço, pelo mesmo nome. */
export function Glyph({ className, name }: GlyphProps) {
  if (isAppGlyph(name)) {
    const classes = [styles.app, name === 'notion' ? styles.mono : '', className].filter(Boolean).join(' ')

    return <img alt="" className={classes} height={16} src={`/brand/apps/${APP_LOGOS[name]}.svg`} width={16} />
  }

  return <Icon className={[styles.icon, className].filter(Boolean).join(' ')} name={name} />
}
