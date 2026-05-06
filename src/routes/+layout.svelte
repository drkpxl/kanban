<script lang="ts">
	import '../app.css';
	let { children } = $props();
</script>

<svelte:head>
	<title>Kanban</title>
	<meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

{@render children()}
