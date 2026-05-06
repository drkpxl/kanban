<script lang="ts">
	interface Props {
		active: string;
		onchange: (board: string) => void;
	}
	let { active, onchange }: Props = $props();
</script>

<div class="switcher" role="tablist" aria-label="Board">
	<button
		role="tab"
		aria-selected={active === 'personal'}
		class:active={active === 'personal'}
		onclick={() => onchange('personal')}
	>
		Personal
	</button>
	<button
		role="tab"
		aria-selected={active === 'work'}
		class:active={active === 'work'}
		onclick={() => onchange('work')}
	>
		Work
	</button>
</div>

<style>
	.switcher {
		display: flex;
		gap: 2px;
		background: var(--surface);
		border: 1px solid var(--border-mid);
		border-radius: 7px;
		padding: 3px;
	}

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
