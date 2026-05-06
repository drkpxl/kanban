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
