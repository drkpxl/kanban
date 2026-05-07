import { themes, isDual } from '$lib/themes/index'
import type { ThemeVars } from '$lib/themes/index'

const THEME_KEY = 'theme'
const THEME_VARS_KEY = 'theme-vars'

export const themeStore = $state({ key: 'dark-workshop' })

let darkMq: MediaQueryList | null = null
let mediaListener: (() => void) | null = null

function getMq(): MediaQueryList {
  darkMq ??= window.matchMedia('(prefers-color-scheme: dark)')
  return darkMq
}

function resolveVars(key: string): ThemeVars {
  const variant = key.match(/-(dark|light|auto)$/)?.[1] as 'dark' | 'light' | 'auto' | undefined
  const baseKey = variant ? key.slice(0, -(variant.length + 1)) : key
  const theme = themes.find(t => t.key === baseKey)
  if (!theme) return {}

  if (!isDual(theme)) return theme.vars
  if (variant === 'dark') return theme.dark
  if (variant === 'light') return theme.light
  return getMq().matches ? theme.dark : theme.light
}

function applyVars(vars: ThemeVars) {
  const root = document.documentElement
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v))
}

export function setTheme(key: string) {
  const vars = resolveVars(key)
  applyVars(vars)
  localStorage.setItem(THEME_KEY, key)
  localStorage.setItem(THEME_VARS_KEY, JSON.stringify(vars))
  themeStore.key = key

  if (mediaListener) {
    getMq().removeEventListener('change', mediaListener)
    mediaListener = null
  }

  if (key.endsWith('-auto')) {
    mediaListener = () => {
      const updated = resolveVars(key)
      applyVars(updated)
      localStorage.setItem(THEME_VARS_KEY, JSON.stringify(updated))
    }
    getMq().addEventListener('change', mediaListener)
  }
}

export function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'dark-workshop'
  setTheme(saved)
}
