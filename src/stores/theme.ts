import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  DEFAULT_THEME_COLOR,
  isThemeColor,
  THEME_COLOR_PALETTE,
  THEME_COLOR_STORAGE_KEY,
  type PresetThemeColor,
  type ThemeColor,
} from '@/styles/theme'
import { applyThemePrimaryColor, normalizeThemeColor, resolveThemeColor } from '@/utils/theme'

export const useThemeStore = defineStore('theme', () => {
  const activeColor = ref<ThemeColor>(DEFAULT_THEME_COLOR)

  function isPresetColor(color: string): color is PresetThemeColor {
    return isThemeColor(color)
  }

  function isSupportedColor(color: string): boolean {
    return normalizeThemeColor(color) !== null
  }

  function persistThemeColor(color: ThemeColor): void {
    if (typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(THEME_COLOR_STORAGE_KEY, color)
  }

  function setActiveColor(color: string): boolean {
    const normalized = normalizeThemeColor(color)
    if (!normalized || !isSupportedColor(normalized)) {
      return false
    }

    activeColor.value = normalized
    applyThemePrimaryColor(normalized)
    persistThemeColor(normalized)
    return true
  }

  function restoreThemeColor(): void {
    if (typeof window === 'undefined') {
      applyThemePrimaryColor(DEFAULT_THEME_COLOR)
      activeColor.value = DEFAULT_THEME_COLOR
      return
    }

    const saved = window.localStorage.getItem(THEME_COLOR_STORAGE_KEY)
    if (saved) {
      const restored = resolveThemeColor(saved, DEFAULT_THEME_COLOR)
      activeColor.value = restored
      applyThemePrimaryColor(restored)
      persistThemeColor(restored)
      return
    }

    activeColor.value = DEFAULT_THEME_COLOR
    applyThemePrimaryColor(DEFAULT_THEME_COLOR)
    persistThemeColor(DEFAULT_THEME_COLOR)
  }

  return {
    palette: THEME_COLOR_PALETTE,
    activeColor,
    isPresetColor,
    isSupportedColor,
    setActiveColor,
    restoreThemeColor,
  }
})
