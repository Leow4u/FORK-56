import { SiDocker, SiJavascript, SiPython, SiTypescript } from '@icons-pack/react-simple-icons'
import type { ComponentType } from 'react'

import { ToolIcon, type ToolIconProps } from '@/components/ui/tool-icon'
import { codiconForFilename, codiconForLanguage } from '@/lib/markdown-code'
import { cn } from '@/lib/utils'

export interface FileTypeIconProps extends Omit<ToolIconProps, 'name'> {
  language?: string
  path?: string
}

const BRANDS: Record<
  string,
  { icon: ComponentType<{ size?: number | string; className?: string; color?: string }>; color: string }
> = {
  py: { icon: SiPython, color: 'text-(--ui-blue)' },
  pyi: { icon: SiPython, color: 'text-(--ui-blue)' },
  js: { icon: SiJavascript, color: 'text-(--ui-yellow)' },
  jsx: { icon: SiJavascript, color: 'text-(--ui-yellow)' },
  mjs: { icon: SiJavascript, color: 'text-(--ui-yellow)' },
  cjs: { icon: SiJavascript, color: 'text-(--ui-yellow)' },
  ts: { icon: SiTypescript, color: 'text-(--ui-blue)' },
  tsx: { icon: SiTypescript, color: 'text-(--ui-blue)' },
  docker: { icon: SiDocker, color: 'text-(--ui-blue)' }
}

const FILE_ICONS: Record<string, string> = {
  pdf: 'file-pdf',
  csv: 'table',
  xls: 'table',
  xlsx: 'table',
  ods: 'table',
  doc: 'file-text',
  docx: 'file-text',
  odt: 'file-text',
  txt: 'file-text',
  log: 'file-text',
  png: 'file-media',
  jpg: 'file-media',
  jpeg: 'file-media',
  gif: 'file-media',
  webp: 'file-media',
  bmp: 'file-media',
  ico: 'file-media'
}

const FILE_COLORS: Record<string, string> = {
  markdown: 'text-(--ui-green)',
  json: 'text-(--ui-orange)',
  'file-pdf': 'text-(--ui-red)',
  table: 'text-(--ui-green)'
}

/** Same file identity in tree rows and tabs; color never changes the filename. */
export function FileTypeIcon({ language, path, className, size = '0.875rem' }: FileTypeIconProps) {
  if (!path) {
    return <ToolIcon className={className} name={codiconForLanguage(language)} size={size} />
  }

  const base = path.replace(/\\/g, '/').split('/').at(-1)?.toLowerCase() || ''
  const extension = base.split('.').at(-1) || ''
  const docker = /^(dockerfile(?:\..*)?|(?:docker-)?compose\.ya?ml)$/.test(base)
  const brand = BRANDS[docker ? 'docker' : extension]

  if (brand) {
    const Icon = brand.icon

    return <Icon className={cn('shrink-0', brand.color, className)} color="currentColor" size={size} />
  }

  const resolved = codiconForFilename(path)

  const icon =
    FILE_ICONS[extension] ?? (/prettier|eslint/.test(base) ? 'settings-gear' : resolved === 'code' ? 'file' : resolved)

  return <ToolIcon className={cn(FILE_COLORS[icon], className)} name={icon} size={size} />
}
