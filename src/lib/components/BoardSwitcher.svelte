<script lang="ts">
	interface Tab { id: string; label: string; }
	interface Props {
		tabs: Tab[];
		active: string;
		onchange: (id: string) => void;
	}
	let { tabs, active, onchange }: Props = $props();
</script>

<div class="switcher" role="tablist" aria-label="View">
	{#each tabs as tab}
		<button
			role="tab"
			aria-selected={active === tab.id}
			class:active={active === tab.id}
			onclick={() => onchange(tab.id)}
		>
			{tab.label}
		</button>
	{/each}
</div>

<style>
	.switcher {
		display: flex;
		gap: 2px;
		background: var(--surface);
		border: 1px solid var(--border-mid);
		border-radius: 7px;
		padding: 3px;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.switcher::-webkit-scrollbar { display: none; }

	button {
		padding: 6px 22px;
		font-size: 13px;
		font-weight: 600;
		background: none;
		border: none;
		border-radius: 5px;
		color: var(--text-3);
		letter-spacing: 0.3px;
		transition: background 0.15s, color 0.15s;
		min-height: 34px;
		white-space: nowrap;
	}

	@media (max-width: 768px) {
		button { min-height: 44px; }
	}

	button:hover:not(.active) {
		color: var(--text-2);
		background: rgba(255,255,255,0.04);
	}

	button.active {
		background: var(--accent);
		color: #fff;
		letter-spacing: 0.3px;
	}
</style>
