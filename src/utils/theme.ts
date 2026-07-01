function toHexByte(value: number): string {
  return value.toString(16).padStart(2, '0')
}

function normalizeHexColor(color: string): string | null {
  const value = color.trim().toLowerCase()
  if (!value.startsWith('#')) {
    return null
  }

  const raw = value.slice(1)
  if (raw.length === 3 && /^[0-9a-f]{3}$/.test(raw)) {
    const expanded = raw
      .split('')
      .map((ch) => ch + ch)
      .join('')
    return `#${expanded}`
  }

  if (raw.length === 6 && /^[0-9a-f]{6}$/.test(raw)) {
    return value
  }

  return null
}

function normalizeRgbColor(color: string): string | null {
  const value = color.trim().toLowerCase()
  const match = value.match(/^rgba?\(([^)]+)\)$/)
  if (!match) {
    return null
  }

  const parts = match[1].split(',').map((part) => part.trim())
  if (parts.length < 3) {
    return null
  }

  const rgb = parts.slice(0, 3).map((part) => Number(part))
  if (rgb.some((channel) => Number.isNaN(channel) || channel < 0 || channel > 255)) {
    return null
  }

  return `#${toHexByte(rgb[0])}${toHexByte(rgb[1])}${toHexByte(rgb[2])}`
}

export function normalizeThemeColor(color: string): string | null {
  return normalizeHexColor(color) ?? normalizeRgbColor(color)
}

export function resolveThemeColor(color: string, fallback: string): string {
  const normalized = normalizeThemeColor(color)
  if (normalized) {
    return normalized
  }

  return normalizeThemeColor(fallback) ?? '#58a6ff'
}

export function withAlpha(hexColor: string, alpha: number): string {
  const normalized = normalizeThemeColor(hexColor)
  if (!normalized) {
    return hexColor
  }

  const clamped = Math.max(0, Math.min(1, alpha))
  const alphaByte = Math.round(clamped * 255)
  return `${normalized}${toHexByte(alphaByte)}`
}

export function applyThemePrimaryColor(hexColor: string): void {
  if (typeof document === 'undefined') {
    return
  }

  const normalized = normalizeThemeColor(hexColor)
  if (!normalized) {
    return
  }

  const root = document.documentElement
  root.style.setProperty('--theme-primary', normalized)
  root.style.setProperty('--theme-primary-light', withAlpha(normalized, 0.12))
  root.style.setProperty('--td-brand-color', normalized)
  root.style.setProperty('--td-brand-color-light', withAlpha(normalized, 0.12))
}
