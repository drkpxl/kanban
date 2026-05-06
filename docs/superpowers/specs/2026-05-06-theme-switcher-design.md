# Theme Switcher — Design Spec
_2026-05-06_

## Context

The kanban board ships with a single hardcoded dark theme ("Dark Workshop"). Users want to switch between a library of popular editor themes (Nord, Catppuccin, Dracula, Solarized, etc.) and have their choice persist across sessions. For themes that have both light and dark variants, an "Auto" option should follow the OS `prefers-color-scheme` setting and update live.

---

## Architecture

### Approach: Per-file TypeScript theme objects + inline CSS custom properties

Each theme is a plain TypeScript file that exports an object of CSS variable name → value pairs. The active theme's variables are written directly to `document.documentElement.style.setProperty(...)` at runtime — no CSS class toggling, no dynamic `<style>` injection.

**Why this over CSS class blocks in `app.css`:**
- Themes are isolated files — add one, remove one, diff one cleanly
- No hundreds-of-lines CSS block sprawl
- The theme registry is a simple import list in one file

---

## File Structure

```
src/lib/
  themes/
    index.ts              ← registry: imports all themes, exports sorted list
    dark-workshop.ts      ← single-variant (dark)
    nord.ts               ← single-variant (dark)
    dracula.ts
    tokyo-night.ts
    monokai.ts
    tomorrow-night.ts
    one-dark-pro.ts
    catppuccin.ts         ← dual-variant: { dark, light }
    solarized.ts
    gruvbox.ts
    rose-pine.ts
    ayu.ts
    papercolor.ts
    everforest.ts
    github.ts
    atom-one.ts
  stores/
    theme.ts              ← Svelte store: selected key, setTheme(), matchMedia listener
  components/
    ThemeSwitcher.svelte  ← <select> dropdown, bound to store
```

---

## Theme File Shape

```typescript
// Single-variant example: src/lib/themes/nord.ts
export default {
  key: 'nord',
  label: 'Nord',
  vars: {
    '--bg': '#2e3440',
    '--nav': '#242933',
    '--surface': '#3b4252',
    '--card': '#434c5e',
    '--card-hover': '#4c566a',
    '--border': '#4c566a',
    '--border-mid': '#616e88',
    '--border-hi': '#7b88a1',
    '--text': '#eceff4',
    '--text-2': '#d8dee9',
    '--text-3': '#a3be8c',
    '--accent': '#88c0d0',
    '--accent-hi': '#8fbcbb',
    '--accent-faint': 'rgba(136,192,208,0.10)',
    '--accent-glow': 'rgba(136,192,208,0.18)',
    '--col-idea': '#5e81ac',
    '--col-progress': '#d08770',
    '--col-done': '#a3be8c',
    '--danger': '#bf616a',
    '--danger-faint': 'rgba(191,97,106,0.12)',
  }
}

// Dual-variant example: src/lib/themes/catppuccin.ts
export default {
  key: 'catppuccin',
  label: 'Catppuccin',
  dark: { '--bg': '#1e1e2e', /* … */ },
  light: { '--bg': '#eff1f5', /* … */ },
}
```

### Registry (`index.ts`)

```typescript
export type SingleTheme = { key: string; label: string; vars: Record<string, string> }
export type DualTheme = { key: string; label: string; dark: Record<string, string>; light: Record<string, string> }
export type ThemeEntry = SingleTheme | DualTheme

import darkWorkshop from './dark-workshop'
import nord from './nord'
// … all imports

export const themes: ThemeEntry[] = [
  darkWorkshop, nord, dracula, tokyoNight, monokai, tomorrowNight, oneDarkPro,
  catppuccin, solarized, gruvbox, rosePine, ayu, papercolor, everforest, github, atomOne,
]
```

---

## Dropdown Entries

The `ThemeSwitcher` builds dropdown options from the registry:
- Single-variant themes → one `<option>` with key `"{key}"`
- Dual-variant themes → an `<optgroup label="{label}">` containing:
  - `<option value="{key}-dark">` — label: `"{Label} Dark"`
  - `<option value="{key}-light">` — label: `"{Label} Light"`
  - `<option value="{key}-auto">` — label: `"{Label} Auto"`

**Theme list (17 themes, ~40 total options):**

Single-variant (dark): Dark Workshop, Nord, Dracula, Tokyo Night, Monokai, Tomorrow Night, One Dark Pro

Dual-variant (dark + light + auto): Catppuccin, Solarized, Gruvbox, Rosé Pine, Ayu, Papercolor, Everforest, GitHub, Atom One

---

## Store (`src/lib/stores/theme.ts`)

```typescript
// Responsibilities:
// 1. On init: read localStorage('theme') → default 'dark-workshop'
// 2. Look up theme entry, resolve vars (for auto: check matchMedia)
// 3. Apply vars to document.documentElement
// 4. For auto entries: register matchMedia('prefers-color-scheme: dark') listener → reapply on change
// 5. On setTheme(key): apply vars + write to localStorage

export const themeKey = writable<string>('dark-workshop')
export function setTheme(key: string): void { /* apply + persist */ }
```

### No-flash inline script in `app.html`

The inline script cannot import TypeScript modules, so `setTheme()` stores **two** values in localStorage: the key (`"theme"`) and the resolved vars as a JSON string (`"theme-vars"`). The inline script reads the vars JSON and applies them synchronously before first paint.

```html
<script>
  (function() {
    try {
      const vars = JSON.parse(localStorage.getItem('theme-vars') || 'null');
      if (vars) {
        const root = document.documentElement;
        Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
      }
    } catch (e) {}
  })();
</script>
```

`setTheme()` writes both `localStorage.setItem('theme', key)` and `localStorage.setItem('theme-vars', JSON.stringify(resolvedVars))` on every theme change. On first ever load (no localStorage), the `:root` defaults in `app.css` are already Dark Workshop so no flash occurs.

---

## ThemeSwitcher Component (`src/lib/components/ThemeSwitcher.svelte`)

- A `<select>` element bound to `$themeKey`
- On `change`: calls `setTheme(event.target.value)`
- Styled with `var(--*)` so it inherits the active theme automatically
- Placed top-right in `+page.svelte` alongside the board header

---

## Layout Integration

`+layout.svelte`: call `initTheme()` in `onMount` to initialize the store (reads localStorage, registers matchMedia listener). The inline script in `app.html` handles the no-flash case before mount fires.

`app.css`: the existing `:root` block remains as the ultimate fallback. The slash-command popup styles (currently hardcoded `#0d0d0d`, `#3d3d3d`) are migrated to `var(--surface)`, `var(--border)`, etc.

---

## Verification

1. Dev server starts, board loads with Dark Workshop — no flash of unstyled content
2. Each theme in the dropdown changes colors instantly on selection
3. Selecting an Auto variant matches OS appearance
4. Switching OS dark/light mode while app is open updates live (no reload)
5. Refreshing the page restores the last selected theme from localStorage
6. DevTools → Elements → `<html style="...">` shows correct `--bg` etc. for selected theme
7. Slash-command popup inherits theme colors (no longer hardcoded grays)
