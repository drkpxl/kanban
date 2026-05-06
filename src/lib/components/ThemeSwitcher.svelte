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
