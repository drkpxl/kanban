import darkWorkshop from './dark-workshop'
import nord from './nord'
import dracula from './dracula'
import tokyoNight from './tokyo-night'
import monokai from './monokai'
import tomorrowNight from './tomorrow-night'
import oneDarkPro from './one-dark-pro'
import catppuccin from './catppuccin'
import solarized from './solarized'
import gruvbox from './gruvbox'
import rosePine from './rose-pine'
import ayu from './ayu'
import papercolor from './papercolor'
import everforest from './everforest'
import github from './github'
import atomOne from './atom-one'

export type ThemeVars = Record<string, string>

export type SingleTheme = {
  key: string
  label: string
  vars: ThemeVars
}

export type DualTheme = {
  key: string
  label: string
  dark: ThemeVars
  light: ThemeVars
}

export type ThemeEntry = SingleTheme | DualTheme

export function isDual(theme: ThemeEntry): theme is DualTheme {
  return 'dark' in theme && 'light' in theme
}

export const themes: ThemeEntry[] = [
  darkWorkshop,
  nord,
  dracula,
  tokyoNight,
  monokai,
  tomorrowNight,
  oneDarkPro,
  catppuccin,
  solarized,
  gruvbox,
  rosePine,
  ayu,
  papercolor,
  everforest,
  github,
  atomOne,
]
