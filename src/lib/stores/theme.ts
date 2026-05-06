import { writable } from 'svelte/store'
import { themes, isDual } from '$lib/themes/index'
import type { ThemeVars } from '$lib/themes/index'

export const themeKey = writable<string>('dark-workshop')

let mediaListener: (() => void) | null = null

function resolveVars(key: string): ThemeVars {
  const isDarkVariant = key.endsWith('-dark')
  const isLightVariant = key.endsWith('-light')
  const isAutoVariant = key.endsWith('-auto')
  const isVariant = isDarkVariant || isLightVariant || isAutoVariant

  const baseKey = isVariant ? key.replace(/-(dark|light|auto)$/, '') : key
  const theme = themes.find(t => t.key === baseKey)
  if (!theme) return {}

  if (!isDual(theme)) return theme.vars

  if (isDarkVariant) return theme.dark
  if (isLightVariant) return theme.light

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return prefersDark ? theme.dark : theme.light
}

function applyVars(vars: ThemeVars) {
  const root = document.documentElement
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v))
}

export function setTheme(key: string) {
  const vars = resolveVars(key)
  applyVars(vars)
  localStorage.setItem('theme', key)
  localStorage.setItem('theme-vars', JSON.stringify(vars))
  themeKey.set(key)

  if (mediaListener) {
    window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', mediaListener)
    mediaListener = null
  }

  if (key.endsWith('-auto')) {
    mediaListener = () => {
      const updated = resolveVars(key)
      applyVars(updated)
      localStorage.setItem('theme-vars', JSON.stringify(updated))
    }
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', mediaListener)
  }
}

export function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark-workshop'
  setTheme(saved)
}
