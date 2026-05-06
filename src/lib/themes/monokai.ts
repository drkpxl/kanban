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
