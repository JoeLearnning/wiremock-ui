export const THEME_COLOR_STORAGE_KEY = 'wiremock-ui-theme-color'

export const THEME_COLOR_PALETTE = [
  '#58a6ff',
  '#2db7f5',
  '#00a870',
  '#ed7b2f',
  '#e34d59',
  '#7b61ff',
] as const

export type PresetThemeColor = (typeof THEME_COLOR_PALETTE)[number]
export type ThemeColor = string

export const DEFAULT_THEME_COLOR: PresetThemeColor = '#58a6ff'

export function isThemeColor(value: string): value is PresetThemeColor {
  return (THEME_COLOR_PALETTE as readonly string[]).includes(value)
}
