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
