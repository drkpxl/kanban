# Theme Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent theme switcher dropdown (top-right nav) that supports 17 themes across 40+ variants including light/dark/auto modes, with no-flash on page load.

**Architecture:** Each theme is a TypeScript file exporting a plain object of CSS variable key→value pairs. A Svelte store reads the selection from localStorage, resolves the correct variant, and applies vars via `document.documentElement.style.setProperty()`. A small inline script in `app.html` applies cached vars synchronously before first paint to prevent flash.

**Tech Stack:** SvelteKit 2, Svelte 5 (runes), TypeScript, CSS custom properties, localStorage, `matchMedia`

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `src/lib/themes/index.ts` | Types + ordered theme registry |
| Create | `src/lib/themes/dark-workshop.ts` | Default dark theme |
| Create | `src/lib/themes/nord.ts` | Nord dark |
| Create | `src/lib/themes/dracula.ts` | Dracula dark |
| Create | `src/lib/themes/tokyo-night.ts` | Tokyo Night dark |
| Create | `src/lib/themes/monokai.ts` | Monokai dark |
| Create | `src/lib/themes/tomorrow-night.ts` | Tomorrow Night dark |
| Create | `src/lib/themes/one-dark-pro.ts` | One Dark Pro dark |
| Create | `src/lib/themes/catppuccin.ts` | Catppuccin dual (Mocha/Latte) |
| Create | `src/lib/themes/solarized.ts` | Solarized dual |
| Create | `src/lib/themes/gruvbox.ts` | Gruvbox dual |
| Create | `src/lib/themes/rose-pine.ts` | Rosé Pine dual |
| Create | `src/lib/themes/ayu.ts` | Ayu dual |
| Create | `src/lib/themes/papercolor.ts` | Papercolor dual |
| Create | `src/lib/themes/everforest.ts` | Everforest dual |
| Create | `src/lib/themes/github.ts` | GitHub dual |
| Create | `src/lib/themes/atom-one.ts` | Atom One dual |
| Create | `src/lib/stores/theme.ts` | Store: initTheme, setTheme, themeKey |
| Create | `src/lib/components/ThemeSwitcher.svelte` | Select dropdown component |
| Modify | `src/app.html` | Add no-flash inline script |
| Modify | `src/routes/+layout.svelte` | Call initTheme on mount |
| Modify | `src/routes/+page.svelte` | Import + place ThemeSwitcher in nav-right |
| Modify | `src/app.css` | Replace hardcoded slash-popup colors with vars |

---

## Task 1: Theme registry types and scaffold

**Files:**
- Create: `src/lib/themes/index.ts`

- [ ] **Step 1: Create the registry file with types and an empty array**

```typescript
// src/lib/themes/index.ts
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

export const themes: ThemeEntry[] = []
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run check`
Expected: no errors

---

## Task 2: Single-variant dark theme files

**Files:**
- Create: `src/lib/themes/dark-workshop.ts`
- Create: `src/lib/themes/nord.ts`
- Create: `src/lib/themes/dracula.ts`
- Create: `src/lib/themes/tokyo-night.ts`
- Create: `src/lib/themes/monokai.ts`
- Create: `src/lib/themes/tomorrow-night.ts`
- Create: `src/lib/themes/one-dark-pro.ts`

- [ ] **Step 1: Create dark-workshop.ts** (mirrors the existing `:root` block)

```typescript
// src/lib/themes/dark-workshop.ts
import type { SingleTheme } from './index'

const darkWorkshop: SingleTheme = {
  key: 'dark-workshop',
  label: 'Dark Workshop',
  vars: {
    '--bg':           '#0f0f0f',
    '--nav':          '#0a0a0a',
    '--surface':      '#181818',
    '--card':         '#202020',
    '--card-hover':   '#272727',
    '--border':       '#2e2e2e',
    '--border-mid':   '#3d3d3d',
    '--border-hi':    '#555555',
    '--text':         '#ede8df',
    '--text-2':       '#bdb5a8',
    '--text-3':       '#7e7670',
    '--accent':       '#c17f3f',
    '--accent-hi':    '#d4924e',
    '--accent-faint': 'rgba(193,127,63,0.10)',
    '--accent-glow':  'rgba(193,127,63,0.18)',
    '--col-idea':     '#5b9bd5',
    '--col-progress': '#c17f3f',
    '--col-done':     '#5a9b6f',
    '--danger':       '#d45454',
    '--danger-faint': 'rgba(212,84,84,0.12)',
  }
}

export default darkWorkshop
```

- [ ] **Step 2: Create nord.ts**

```typescript
// src/lib/themes/nord.ts
import type { SingleTheme } from './index'

const nord: SingleTheme = {
  key: 'nord',
  label: 'Nord',
  vars: {
    '--bg':           '#2e3440',
    '--nav':          '#242933',
    '--surface':      '#3b4252',
    '--card':         '#434c5e',
    '--card-hover':   '#4c566a',
    '--border':       '#3b4252',
    '--border-mid':   '#4c566a',
    '--border-hi':    '#616e88',
    '--text':         '#eceff4',
    '--text-2':       '#d8dee9',
    '--text-3':       '#9099ab',
    '--accent':       '#88c0d0',
    '--accent-hi':    '#8fbcbb',
    '--accent-faint': 'rgba(136,192,208,0.10)',
    '--accent-glow':  'rgba(136,192,208,0.18)',
    '--col-idea':     '#5e81ac',
    '--col-progress': '#d08770',
    '--col-done':     '#a3be8c',
    '--danger':       '#bf616a',
    '--danger-faint': 'rgba(191,97,106,0.12)',
  }
}

export default nord
```

- [ ] **Step 3: Create dracula.ts**

```typescript
// src/lib/themes/dracula.ts
import type { SingleTheme } from './index'

const dracula: SingleTheme = {
  key: 'dracula',
  label: 'Dracula',
  vars: {
    '--bg':           '#282a36',
    '--nav':          '#21222c',
    '--surface':      '#343746',
    '--card':         '#3d3f54',
    '--card-hover':   '#44475a',
    '--border':       '#3d3f54',
    '--border-mid':   '#565979',
    '--border-hi':    '#6272a4',
    '--text':         '#f8f8f2',
    '--text-2':       '#cfcfe2',
    '--text-3':       '#6272a4',
    '--accent':       '#bd93f9',
    '--accent-hi':    '#caa9fa',
    '--accent-faint': 'rgba(189,147,249,0.10)',
    '--accent-glow':  'rgba(189,147,249,0.18)',
    '--col-idea':     '#8be9fd',
    '--col-progress': '#ffb86c',
    '--col-done':     '#50fa7b',
    '--danger':       '#ff5555',
    '--danger-faint': 'rgba(255,85,85,0.12)',
  }
}

export default dracula
```

- [ ] **Step 4: Create tokyo-night.ts**

```typescript
// src/lib/themes/tokyo-night.ts
import type { SingleTheme } from './index'

const tokyoNight: SingleTheme = {
  key: 'tokyo-night',
  label: 'Tokyo Night',
  vars: {
    '--bg':           '#1a1b26',
    '--nav':          '#16161e',
    '--surface':      '#1f2335',
    '--card':         '#24283b',
    '--card-hover':   '#292e42',
    '--border':       '#1f2335',
    '--border-mid':   '#3d4468',
    '--border-hi':    '#545c7e',
    '--text':         '#c0caf5',
    '--text-2':       '#a9b1d6',
    '--text-3':       '#565f89',
    '--accent':       '#7aa2f7',
    '--accent-hi':    '#89b4fa',
    '--accent-faint': 'rgba(122,162,247,0.10)',
    '--accent-glow':  'rgba(122,162,247,0.18)',
    '--col-idea':     '#7dcfff',
    '--col-progress': '#e0af68',
    '--col-done':     '#9ece6a',
    '--danger':       '#f7768e',
    '--danger-faint': 'rgba(247,118,142,0.12)',
  }
}

export default tokyoNight
```

- [ ] **Step 5: Create monokai.ts**

```typescript
// src/lib/themes/monokai.ts
import type { SingleTheme } from './index'

const monokai: SingleTheme = {
  key: 'monokai',
  label: 'Monokai',
  vars: {
    '--bg':           '#272822',
    '--nav':          '#1e1f1c',
    '--surface':      '#2d2e27',
    '--card':         '#3e3d32',
    '--card-hover':   '#49483e',
    '--border':       '#3e3d32',
    '--border-mid':   '#75715e',
    '--border-hi':    '#908e7c',
    '--text':         '#f8f8f2',
    '--text-2':       '#ccc9b5',
    '--text-3':       '#75715e',
    '--accent':       '#a6e22e',
    '--accent-hi':    '#b8f540',
    '--accent-faint': 'rgba(166,226,46,0.10)',
    '--accent-glow':  'rgba(166,226,46,0.18)',
    '--col-idea':     '#66d9e8',
    '--col-progress': '#fd971f',
    '--col-done':     '#a6e22e',
    '--danger':       '#f92672',
    '--danger-faint': 'rgba(249,38,114,0.12)',
  }
}

export default monokai
```

- [ ] **Step 6: Create tomorrow-night.ts**

```typescript
// src/lib/themes/tomorrow-night.ts
import type { SingleTheme } from './index'

const tomorrowNight: SingleTheme = {
  key: 'tomorrow-night',
  label: 'Tomorrow Night',
  vars: {
    '--bg':           '#1d1f21',
    '--nav':          '#181a1b',
    '--surface':      '#242628',
    '--card':         '#282a2e',
    '--card-hover':   '#313538',
    '--border':       '#282a2e',
    '--border-mid':   '#4a4e52',
    '--border-hi':    '#666a6e',
    '--text':         '#c5c8c6',
    '--text-2':       '#969896',
    '--text-3':       '#666a6e',
    '--accent':       '#81a2be',
    '--accent-hi':    '#9ab4c8',
    '--accent-faint': 'rgba(129,162,190,0.10)',
    '--accent-glow':  'rgba(129,162,190,0.18)',
    '--col-idea':     '#81a2be',
    '--col-progress': '#de935f',
    '--col-done':     '#b5bd68',
    '--danger':       '#cc6666',
    '--danger-faint': 'rgba(204,102,102,0.12)',
  }
}

export default tomorrowNight
```

- [ ] **Step 7: Create one-dark-pro.ts**

```typescript
// src/lib/themes/one-dark-pro.ts
import type { SingleTheme } from './index'

const oneDarkPro: SingleTheme = {
  key: 'one-dark-pro',
  label: 'One Dark Pro',
  vars: {
    '--bg':           '#282c34',
    '--nav':          '#21252b',
    '--surface':      '#2c313a',
    '--card':         '#323842',
    '--card-hover':   '#3e4451',
    '--border':       '#2c313a',
    '--border-mid':   '#4b5263',
    '--border-hi':    '#5c6370',
    '--text':         '#abb2bf',
    '--text-2':       '#9da5b4',
    '--text-3':       '#5c6370',
    '--accent':       '#61afef',
    '--accent-hi':    '#79c0ff',
    '--accent-faint': 'rgba(97,175,239,0.10)',
    '--accent-glow':  'rgba(97,175,239,0.18)',
    '--col-idea':     '#56b6c2',
    '--col-progress': '#e5c07b',
    '--col-done':     '#98c379',
    '--danger':       '#e06c75',
    '--danger-faint': 'rgba(224,108,117,0.12)',
  }
}

export default oneDarkPro
```

- [ ] **Step 8: Verify TypeScript compiles**

Run: `npm run check`
Expected: no errors

---

## Task 3: Dual-variant theme files — batch 1

**Files:**
- Create: `src/lib/themes/catppuccin.ts`
- Create: `src/lib/themes/solarized.ts`
- Create: `src/lib/themes/gruvbox.ts`
- Create: `src/lib/themes/rose-pine.ts`
- Create: `src/lib/themes/ayu.ts`

- [ ] **Step 1: Create catppuccin.ts** (Mocha dark, Latte light)

```typescript
// src/lib/themes/catppuccin.ts
import type { DualTheme } from './index'

const catppuccin: DualTheme = {
  key: 'catppuccin',
  label: 'Catppuccin',
  dark: {
    '--bg':           '#1e1e2e',
    '--nav':          '#181825',
    '--surface':      '#313244',
    '--card':         '#45475a',
    '--card-hover':   '#585b70',
    '--border':       '#313244',
    '--border-mid':   '#45475a',
    '--border-hi':    '#6c7086',
    '--text':         '#cdd6f4',
    '--text-2':       '#bac2de',
    '--text-3':       '#9399b2',
    '--accent':       '#cba6f7',
    '--accent-hi':    '#d4b7f8',
    '--accent-faint': 'rgba(203,166,247,0.10)',
    '--accent-glow':  'rgba(203,166,247,0.18)',
    '--col-idea':     '#89b4fa',
    '--col-progress': '#fab387',
    '--col-done':     '#a6e3a1',
    '--danger':       '#f38ba8',
    '--danger-faint': 'rgba(243,139,168,0.12)',
  },
  light: {
    '--bg':           '#eff1f5',
    '--nav':          '#e6e9ef',
    '--surface':      '#ccd0da',
    '--card':         '#dce0e8',
    '--card-hover':   '#bcc0cc',
    '--border':       '#ccd0da',
    '--border-mid':   '#bcc0cc',
    '--border-hi':    '#9ca0b0',
    '--text':         '#4c4f69',
    '--text-2':       '#5c5f77',
    '--text-3':       '#8c8fa1',
    '--accent':       '#8839ef',
    '--accent-hi':    '#7027d0',
    '--accent-faint': 'rgba(136,57,239,0.10)',
    '--accent-glow':  'rgba(136,57,239,0.18)',
    '--col-idea':     '#1e66f5',
    '--col-progress': '#fe640b',
    '--col-done':     '#40a02b',
    '--danger':       '#d20f39',
    '--danger-faint': 'rgba(210,15,57,0.12)',
  }
}

export default catppuccin
```

- [ ] **Step 2: Create solarized.ts**

```typescript
// src/lib/themes/solarized.ts
import type { DualTheme } from './index'

const solarized: DualTheme = {
  key: 'solarized',
  label: 'Solarized',
  dark: {
    '--bg':           '#002b36',
    '--nav':          '#00212b',
    '--surface':      '#073642',
    '--card':         '#0a3d4a',
    '--card-hover':   '#104e5e',
    '--border':       '#073642',
    '--border-mid':   '#1a4a56',
    '--border-hi':    '#586e75',
    '--text':         '#839496',
    '--text-2':       '#657b83',
    '--text-3':       '#586e75',
    '--accent':       '#268bd2',
    '--accent-hi':    '#2aa198',
    '--accent-faint': 'rgba(38,139,210,0.10)',
    '--accent-glow':  'rgba(38,139,210,0.18)',
    '--col-idea':     '#268bd2',
    '--col-progress': '#cb4b16',
    '--col-done':     '#859900',
    '--danger':       '#dc322f',
    '--danger-faint': 'rgba(220,50,47,0.12)',
  },
  light: {
    '--bg':           '#fdf6e3',
    '--nav':          '#eee8d5',
    '--surface':      '#eee8d5',
    '--card':         '#e4dece',
    '--card-hover':   '#d9d3c4',
    '--border':       '#e4dece',
    '--border-mid':   '#cbc5b5',
    '--border-hi':    '#b5b0a1',
    '--text':         '#657b83',
    '--text-2':       '#839496',
    '--text-3':       '#93a1a1',
    '--accent':       '#268bd2',
    '--accent-hi':    '#2aa198',
    '--accent-faint': 'rgba(38,139,210,0.10)',
    '--accent-glow':  'rgba(38,139,210,0.18)',
    '--col-idea':     '#268bd2',
    '--col-progress': '#cb4b16',
    '--col-done':     '#859900',
    '--danger':       '#dc322f',
    '--danger-faint': 'rgba(220,50,47,0.12)',
  }
}

export default solarized
```

- [ ] **Step 3: Create gruvbox.ts**

```typescript
// src/lib/themes/gruvbox.ts
import type { DualTheme } from './index'

const gruvbox: DualTheme = {
  key: 'gruvbox',
  label: 'Gruvbox',
  dark: {
    '--bg':           '#282828',
    '--nav':          '#1d2021',
    '--surface':      '#3c3836',
    '--card':         '#504945',
    '--card-hover':   '#665c54',
    '--border':       '#3c3836',
    '--border-mid':   '#504945',
    '--border-hi':    '#7c6f64',
    '--text':         '#ebdbb2',
    '--text-2':       '#d5c4a1',
    '--text-3':       '#bdae93',
    '--accent':       '#d79921',
    '--accent-hi':    '#fabd2f',
    '--accent-faint': 'rgba(215,153,33,0.10)',
    '--accent-glow':  'rgba(215,153,33,0.18)',
    '--col-idea':     '#458588',
    '--col-progress': '#d65d0e',
    '--col-done':     '#98971a',
    '--danger':       '#cc241d',
    '--danger-faint': 'rgba(204,36,29,0.12)',
  },
  light: {
    '--bg':           '#fbf1c7',
    '--nav':          '#f2e5bc',
    '--surface':      '#ebdbb2',
    '--card':         '#fdf4c1',
    '--card-hover':   '#d5c4a1',
    '--border':       '#ebdbb2',
    '--border-mid':   '#d5c4a1',
    '--border-hi':    '#bdae93',
    '--text':         '#3c3836',
    '--text-2':       '#504945',
    '--text-3':       '#665c54',
    '--accent':       '#b57614',
    '--accent-hi':    '#d79921',
    '--accent-faint': 'rgba(181,118,20,0.10)',
    '--accent-glow':  'rgba(181,118,20,0.18)',
    '--col-idea':     '#076678',
    '--col-progress': '#af3a03',
    '--col-done':     '#79740e',
    '--danger':       '#9d0006',
    '--danger-faint': 'rgba(157,0,6,0.12)',
  }
}

export default gruvbox
```

- [ ] **Step 4: Create rose-pine.ts** (regular dark, Dawn light)

```typescript
// src/lib/themes/rose-pine.ts
import type { DualTheme } from './index'

const rosePine: DualTheme = {
  key: 'rose-pine',
  label: 'Rosé Pine',
  dark: {
    '--bg':           '#191724',
    '--nav':          '#12101e',
    '--surface':      '#26233a',
    '--card':         '#2a2837',
    '--card-hover':   '#302d45',
    '--border':       '#26233a',
    '--border-mid':   '#403d52',
    '--border-hi':    '#524f67',
    '--text':         '#e0def4',
    '--text-2':       '#c4c2d4',
    '--text-3':       '#6e6a86',
    '--accent':       '#c4a7e7',
    '--accent-hi':    '#d1b5f0',
    '--accent-faint': 'rgba(196,167,231,0.10)',
    '--accent-glow':  'rgba(196,167,231,0.18)',
    '--col-idea':     '#9ccfd8',
    '--col-progress': '#f6c177',
    '--col-done':     '#31748f',
    '--danger':       '#eb6f92',
    '--danger-faint': 'rgba(235,111,146,0.12)',
  },
  light: {
    '--bg':           '#faf4ed',
    '--nav':          '#f2e9de',
    '--surface':      '#fffaf3',
    '--card':         '#f4ede8',
    '--card-hover':   '#e8ddd5',
    '--border':       '#dfdad9',
    '--border-mid':   '#c9c4c3',
    '--border-hi':    '#b4aeac',
    '--text':         '#575279',
    '--text-2':       '#6e6a86',
    '--text-3':       '#9893a5',
    '--accent':       '#907aa9',
    '--accent-hi':    '#7a5f94',
    '--accent-faint': 'rgba(144,122,169,0.10)',
    '--accent-glow':  'rgba(144,122,169,0.18)',
    '--col-idea':     '#56949f',
    '--col-progress': '#ea9d34',
    '--col-done':     '#286983',
    '--danger':       '#b4637a',
    '--danger-faint': 'rgba(180,99,122,0.12)',
  }
}

export default rosePine
```

- [ ] **Step 5: Create ayu.ts** (Mirage dark, Light)

```typescript
// src/lib/themes/ayu.ts
import type { DualTheme } from './index'

const ayu: DualTheme = {
  key: 'ayu',
  label: 'Ayu',
  dark: {
    '--bg':           '#1f2430',
    '--nav':          '#1a1f2e',
    '--surface':      '#242b38',
    '--card':         '#2d3347',
    '--card-hover':   '#343d52',
    '--border':       '#2d3347',
    '--border-mid':   '#3d4663',
    '--border-hi':    '#4d5a78',
    '--text':         '#cbccc6',
    '--text-2':       '#a2a8b4',
    '--text-3':       '#4d5a78',
    '--accent':       '#ffcc66',
    '--accent-hi':    '#ffd580',
    '--accent-faint': 'rgba(255,204,102,0.10)',
    '--accent-glow':  'rgba(255,204,102,0.18)',
    '--col-idea':     '#5ccfe6',
    '--col-progress': '#ff8f40',
    '--col-done':     '#bae67e',
    '--danger':       '#ff3333',
    '--danger-faint': 'rgba(255,51,51,0.12)',
  },
  light: {
    '--bg':           '#fafafa',
    '--nav':          '#f0f0f0',
    '--surface':      '#e8e8e8',
    '--card':         '#ffffff',
    '--card-hover':   '#f5f5f5',
    '--border':       '#e8e8e8',
    '--border-mid':   '#d0d0d0',
    '--border-hi':    '#b8b8b8',
    '--text':         '#575f66',
    '--text-2':       '#8a9199',
    '--text-3':       '#acb6bf',
    '--accent':       '#ff9940',
    '--accent-hi':    '#f2ae49',
    '--accent-faint': 'rgba(255,153,64,0.10)',
    '--accent-glow':  'rgba(255,153,64,0.18)',
    '--col-idea':     '#36a3d9',
    '--col-progress': '#ff9940',
    '--col-done':     '#86b300',
    '--danger':       '#ff3333',
    '--danger-faint': 'rgba(255,51,51,0.12)',
  }
}

export default ayu
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npm run check`
Expected: no errors

---

## Task 4: Dual-variant theme files — batch 2 + populate registry

**Files:**
- Create: `src/lib/themes/papercolor.ts`
- Create: `src/lib/themes/everforest.ts`
- Create: `src/lib/themes/github.ts`
- Create: `src/lib/themes/atom-one.ts`
- Modify: `src/lib/themes/index.ts`

- [ ] **Step 1: Create papercolor.ts**

```typescript
// src/lib/themes/papercolor.ts
import type { DualTheme } from './index'

const papercolor: DualTheme = {
  key: 'papercolor',
  label: 'PaperColor',
  dark: {
    '--bg':           '#1c1c1c',
    '--nav':          '#141414',
    '--surface':      '#262626',
    '--card':         '#303030',
    '--card-hover':   '#383838',
    '--border':       '#303030',
    '--border-mid':   '#444444',
    '--border-hi':    '#585858',
    '--text':         '#d0d0d0',
    '--text-2':       '#b2b2b2',
    '--text-3':       '#767676',
    '--accent':       '#00afaf',
    '--accent-hi':    '#00d7d7',
    '--accent-faint': 'rgba(0,175,175,0.10)',
    '--accent-glow':  'rgba(0,175,175,0.18)',
    '--col-idea':     '#5fafd7',
    '--col-progress': '#d75f00',
    '--col-done':     '#87af87',
    '--danger':       '#d75f5f',
    '--danger-faint': 'rgba(215,95,95,0.12)',
  },
  light: {
    '--bg':           '#eeeeee',
    '--nav':          '#e4e4e4',
    '--surface':      '#d0d0d0',
    '--card':         '#ffffff',
    '--card-hover':   '#f5f5f5',
    '--border':       '#d0d0d0',
    '--border-mid':   '#b8b8b8',
    '--border-hi':    '#a0a0a0',
    '--text':         '#444444',
    '--text-2':       '#666666',
    '--text-3':       '#878787',
    '--accent':       '#0087af',
    '--accent-hi':    '#00afd7',
    '--accent-faint': 'rgba(0,135,175,0.10)',
    '--accent-glow':  'rgba(0,135,175,0.18)',
    '--col-idea':     '#0087af',
    '--col-progress': '#d75f00',
    '--col-done':     '#5f8700',
    '--danger':       '#d70000',
    '--danger-faint': 'rgba(215,0,0,0.12)',
  }
}

export default papercolor
```

- [ ] **Step 2: Create everforest.ts**

```typescript
// src/lib/themes/everforest.ts
import type { DualTheme } from './index'

const everforest: DualTheme = {
  key: 'everforest',
  label: 'Everforest',
  dark: {
    '--bg':           '#2d353b',
    '--nav':          '#272e33',
    '--surface':      '#343f44',
    '--card':         '#3d484d',
    '--card-hover':   '#475258',
    '--border':       '#343f44',
    '--border-mid':   '#53605c',
    '--border-hi':    '#7a8478',
    '--text':         '#d3c6aa',
    '--text-2':       '#b8af9a',
    '--text-3':       '#859289',
    '--accent':       '#a7c080',
    '--accent-hi':    '#b8d09a',
    '--accent-faint': 'rgba(167,192,128,0.10)',
    '--accent-glow':  'rgba(167,192,128,0.18)',
    '--col-idea':     '#7fbbb3',
    '--col-progress': '#e69875',
    '--col-done':     '#a7c080',
    '--danger':       '#e67e80',
    '--danger-faint': 'rgba(230,126,128,0.12)',
  },
  light: {
    '--bg':           '#fdf6e3',
    '--nav':          '#f4ede1',
    '--surface':      '#eae4ca',
    '--card':         '#fdf6e3',
    '--card-hover':   '#f0ead6',
    '--border':       '#eae4ca',
    '--border-mid':   '#d6cead',
    '--border-hi':    '#c0b89a',
    '--text':         '#5c6a72',
    '--text-2':       '#708089',
    '--text-3':       '#939f91',
    '--accent':       '#8da101',
    '--accent-hi':    '#93a600',
    '--accent-faint': 'rgba(141,161,1,0.10)',
    '--accent-glow':  'rgba(141,161,1,0.18)',
    '--col-idea':     '#3a94a5',
    '--col-progress': '#f57d26',
    '--col-done':     '#8da101',
    '--danger':       '#f85552',
    '--danger-faint': 'rgba(248,85,82,0.12)',
  }
}

export default everforest
```

- [ ] **Step 3: Create github.ts**

```typescript
// src/lib/themes/github.ts
import type { DualTheme } from './index'

const github: DualTheme = {
  key: 'github',
  label: 'GitHub',
  dark: {
    '--bg':           '#0d1117',
    '--nav':          '#010409',
    '--surface':      '#161b22',
    '--card':         '#1c2128',
    '--card-hover':   '#22272e',
    '--border':       '#30363d',
    '--border-mid':   '#3d444d',
    '--border-hi':    '#484f58',
    '--text':         '#e6edf3',
    '--text-2':       '#c9d1d9',
    '--text-3':       '#8b949e',
    '--accent':       '#388bfd',
    '--accent-hi':    '#58a6ff',
    '--accent-faint': 'rgba(56,139,253,0.10)',
    '--accent-glow':  'rgba(56,139,253,0.18)',
    '--col-idea':     '#388bfd',
    '--col-progress': '#d29922',
    '--col-done':     '#3fb950',
    '--danger':       '#f85149',
    '--danger-faint': 'rgba(248,81,73,0.12)',
  },
  light: {
    '--bg':           '#ffffff',
    '--nav':          '#f6f8fa',
    '--surface':      '#f6f8fa',
    '--card':         '#ffffff',
    '--card-hover':   '#f0f6fc',
    '--border':       '#d0d7de',
    '--border-mid':   '#c9d1d9',
    '--border-hi':    '#b1bac4',
    '--text':         '#24292f',
    '--text-2':       '#57606a',
    '--text-3':       '#8c959f',
    '--accent':       '#0969da',
    '--accent-hi':    '#0a3069',
    '--accent-faint': 'rgba(9,105,218,0.10)',
    '--accent-glow':  'rgba(9,105,218,0.18)',
    '--col-idea':     '#0969da',
    '--col-progress': '#9a6700',
    '--col-done':     '#116329',
    '--danger':       '#cf222e',
    '--danger-faint': 'rgba(207,34,46,0.12)',
  }
}

export default github
```

- [ ] **Step 4: Create atom-one.ts**

```typescript
// src/lib/themes/atom-one.ts
import type { DualTheme } from './index'

const atomOne: DualTheme = {
  key: 'atom-one',
  label: 'Atom One',
  dark: {
    '--bg':           '#282c34',
    '--nav':          '#21252b',
    '--surface':      '#2c313c',
    '--card':         '#333842',
    '--card-hover':   '#3e4451',
    '--border':       '#2c313c',
    '--border-mid':   '#4b5263',
    '--border-hi':    '#5c6370',
    '--text':         '#abb2bf',
    '--text-2':       '#828997',
    '--text-3':       '#5c6370',
    '--accent':       '#61afef',
    '--accent-hi':    '#79c0ff',
    '--accent-faint': 'rgba(97,175,239,0.10)',
    '--accent-glow':  'rgba(97,175,239,0.18)',
    '--col-idea':     '#56b6c2',
    '--col-progress': '#d19a66',
    '--col-done':     '#98c379',
    '--danger':       '#e06c75',
    '--danger-faint': 'rgba(224,108,117,0.12)',
  },
  light: {
    '--bg':           '#fafafa',
    '--nav':          '#f0f0f0',
    '--surface':      '#e8e8e8',
    '--card':         '#ffffff',
    '--card-hover':   '#f5f5f5',
    '--border':       '#e0e0e0',
    '--border-mid':   '#d0d0d0',
    '--border-hi':    '#c0c0c0',
    '--text':         '#383a42',
    '--text-2':       '#696c77',
    '--text-3':       '#a0a1a7',
    '--accent':       '#4078f2',
    '--accent-hi':    '#2c64de',
    '--accent-faint': 'rgba(64,120,242,0.10)',
    '--accent-glow':  'rgba(64,120,242,0.18)',
    '--col-idea':     '#0184bc',
    '--col-progress': '#986801',
    '--col-done':     '#50a14f',
    '--danger':       '#e45649',
    '--danger-faint': 'rgba(228,86,73,0.12)',
  }
}

export default atomOne
```

- [ ] **Step 5: Populate the registry in index.ts**

Replace the entire contents of `src/lib/themes/index.ts` with:

```typescript
// src/lib/themes/index.ts
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
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npm run check`
Expected: no errors

---

## Task 5: Theme store

**Files:**
- Create: `src/lib/stores/theme.ts`

- [ ] **Step 1: Create the theme store**

```typescript
// src/lib/stores/theme.ts
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

  // auto: follow system preference
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

  // Remove previous auto listener
  if (mediaListener) {
    window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', mediaListener)
    mediaListener = null
  }

  // Register listener for auto variants so the board updates live on OS switch
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run check`
Expected: no errors

---

## Task 6: No-flash inline script in app.html

**Files:**
- Modify: `src/app.html`

- [ ] **Step 1: Add inline script before %sveltekit.head%**

In `src/app.html`, replace:
```html
		%sveltekit.head%
```
with:
```html
		<script>
			(function() {
				try {
					var vars = JSON.parse(localStorage.getItem('theme-vars') || 'null');
					if (vars) {
						var root = document.documentElement;
						Object.keys(vars).forEach(function(k) { root.style.setProperty(k, vars[k]); });
					}
				} catch (e) {}
			})();
		</script>
		%sveltekit.head%
```

- [ ] **Step 2: Start dev server and verify no flash**

Run: `npm run dev`

Open the app in the browser, switch to any non-default theme, then hard-refresh (Ctrl+Shift+R). The theme should be visible immediately with no flash of the dark-workshop default.

---

## Task 7: ThemeSwitcher component

**Files:**
- Create: `src/lib/components/ThemeSwitcher.svelte`

- [ ] **Step 1: Create the component**

```svelte
<!-- src/lib/components/ThemeSwitcher.svelte -->
<script lang="ts">
  import { themeKey, setTheme } from '$lib/stores/theme'
  import { themes, isDual } from '$lib/themes/index'

  function handleChange(e: Event) {
    setTheme((e.target as HTMLSelectElement).value)
  }
</script>

<select value={$themeKey} onchange={handleChange}>
  {#each themes as theme}
    {#if isDual(theme)}
      <optgroup label={theme.label}>
        <option value="{theme.key}-dark">{theme.label} Dark</option>
        <option value="{theme.key}-light">{theme.label} Light</option>
        <option value="{theme.key}-auto">{theme.label} Auto</option>
      </optgroup>
    {:else}
      <option value={theme.key}>{theme.label}</option>
    {/if}
  {/each}
</select>

<style>
  select {
    width: 100%;
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--border-mid);
    border-radius: 5px;
    padding: 4px 6px;
    font-family: var(--font);
    font-size: 12px;
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
  }

  select:hover {
    border-color: var(--border-hi);
  }

  select:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run check`
Expected: no errors

---

## Task 8: Wire up layout and page

**Files:**
- Modify: `src/routes/+layout.svelte`
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Update +layout.svelte to call initTheme on mount**

Replace the entire contents of `src/routes/+layout.svelte` with:

```svelte
<script lang="ts">
  import { onMount } from 'svelte'
  import { initTheme } from '$lib/stores/theme'
  import '../app.css'
  let { children } = $props()

  onMount(() => {
    initTheme()
  })
</script>

<svelte:head>
  <title>Kanban</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

{@render children()}
```

- [ ] **Step 2: Add ThemeSwitcher import to +page.svelte**

In `src/routes/+page.svelte`, in the `<script>` block, add after the existing imports:

```typescript
import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte'
```

- [ ] **Step 3: Place ThemeSwitcher in the nav-right div**

In `src/routes/+page.svelte`, replace:

```html
		<div class="nav-right"></div>
```

with:

```html
		<div class="nav-right">
			<ThemeSwitcher />
		</div>
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npm run check`
Expected: no errors

- [ ] **Step 5: Verify in dev build**

With `npm run dev` running, open the app. The top-right of the nav should show a theme selector dropdown. Changing the selection should immediately update all colors. Refreshing should restore the selected theme.

---

## Task 9: Fix hardcoded slash-popup colors in app.css

**Files:**
- Modify: `src/app.css`

The slash-command popup (lines 81–151) has hardcoded hex colors. Replace them with CSS variables so the popup inherits theme colors.

- [ ] **Step 1: Update .slash-popup**

Replace:
```css
.slash-popup {
	position: absolute;
	z-index: 9999;
	background: #0d0d0d;
	border: 1px solid #3d3d3d;
	border-radius: 8px;
	padding: 4px;
	min-width: 220px;
	max-width: 280px;
	max-height: 320px;
	overflow-y: auto;
	box-shadow: 0 12px 36px rgba(0,0,0,0.7);
	font-family: 'Atkinson Hyperlegible Mono', 'SF Mono', ui-monospace, monospace;
	font-size: 13px;
}
```

with:
```css
.slash-popup {
	position: absolute;
	z-index: 9999;
	background: var(--surface);
	border: 1px solid var(--border-mid);
	border-radius: 8px;
	padding: 4px;
	min-width: 220px;
	max-width: 280px;
	max-height: 320px;
	overflow-y: auto;
	box-shadow: 0 12px 36px rgba(0,0,0,0.7);
	font-family: var(--font);
	font-size: 13px;
}
```

- [ ] **Step 2: Update .slash-item--active and hover**

Replace:
```css
.slash-item--active,
.slash-item:hover {
	background: #1e1e1e;
}
```

with:
```css
.slash-item--active,
.slash-item:hover {
	background: var(--card-hover);
}
```

- [ ] **Step 3: Update .slash-icon**

Replace:
```css
.slash-icon {
	width: 28px;
	height: 28px;
	display: flex;
	align-items: center;
	justify-content: center;
	background: #1a1a1a;
	border: 1px solid #333;
	border-radius: 5px;
	font-size: 11px;
	font-weight: 700;
	color: #c17f3f;
	flex-shrink: 0;
}
```

with:
```css
.slash-icon {
	width: 28px;
	height: 28px;
	display: flex;
	align-items: center;
	justify-content: center;
	background: var(--card);
	border: 1px solid var(--border);
	border-radius: 5px;
	font-size: 11px;
	font-weight: 700;
	color: var(--accent);
	flex-shrink: 0;
}
```

- [ ] **Step 4: Update .slash-title**

Replace:
```css
.slash-title {
	font-weight: 600;
	color: #ede8df;
	font-size: 13px;
}
```

with:
```css
.slash-title {
	font-weight: 600;
	color: var(--text);
	font-size: 13px;
}
```

- [ ] **Step 5: Update .slash-desc and .slash-empty**

Replace:
```css
.slash-desc {
	font-size: 11px;
	color: #7e7670;
}

.slash-empty {
	padding: 10px 12px;
	color: #555;
	font-size: 12px;
	text-align: center;
}
```

with:
```css
.slash-desc {
	font-size: 11px;
	color: var(--text-3);
}

.slash-empty {
	padding: 10px 12px;
	color: var(--text-3);
	font-size: 12px;
	text-align: center;
}
```

- [ ] **Step 6: Verify in dev build**

Open a card with a text editor, type `/` to trigger the slash popup. Verify the popup uses the active theme's colors. Switch themes and trigger the popup again — it should update.

---

## Task 10: Final verification and commit

- [ ] **Step 1: Run type check**

Run: `npm run check`
Expected: no errors

- [ ] **Step 2: Full manual verification checklist**

With `npm run dev` running:
1. Board loads with Dark Workshop — no flash before JS hydrates
2. Open theme dropdown — see all 17 themes grouped correctly (single-variants flat, dual-variants in optgroups with Dark/Light/Auto options)
3. Switch to Dracula — board turns purple immediately
4. Switch to GitHub Light — board turns white/light immediately
5. Switch to Catppuccin Auto — matches current OS dark/light mode
6. Change OS appearance mode — Catppuccin Auto updates live without page reload
7. Hard refresh (Ctrl+Shift+R) — same theme is restored instantly with no flash
8. Open DevTools → Elements → `<html>` — `style` attribute contains the correct `--bg` value for the active theme
9. Open a card, type `/` — slash popup inherits theme colors correctly
10. Check mobile viewport (768px or smaller) — ThemeSwitcher is hidden (nav-right has `display: none` at that breakpoint, which is correct)

- [ ] **Step 3: Commit**

```bash
git add src/lib/themes/ src/lib/stores/theme.ts src/lib/components/ThemeSwitcher.svelte src/app.html src/routes/+layout.svelte src/routes/+page.svelte src/app.css
git commit -m "feat: add theme switcher with 17 themes and localStorage persistence"
```
