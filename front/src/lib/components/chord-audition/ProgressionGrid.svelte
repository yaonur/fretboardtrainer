<script lang="ts">
	type Cell = {
		key: string;
		degree: number;
		roman: string;
		symbol: string;
		beats: number;
	};

	type Props = {
		cells: Cell[];
		activeIndex?: number | null;
		conceal?: boolean;
	};

	let { cells, activeIndex = null, conceal = false }: Props = $props();

	const degreeClass = [
		'bg-red-600 text-white',
		'bg-orange-600 text-white',
		'bg-amber-500 text-black',
		'bg-emerald-600 text-white',
		'bg-sky-600 text-white',
		'bg-violet-600 text-white',
		'bg-pink-600 text-white'
	];
</script>

<div class="flex flex-wrap gap-2">
	{#each cells as cell, index (cell.key)}
		<div
			class={[
				'flex min-h-20 min-w-16 flex-1 flex-col items-center justify-center rounded-md px-2 py-2 text-center',
				conceal
					? 'bg-slate-500 text-slate-200'
					: (degreeClass[cell.degree - 1] ?? 'bg-gray-600 text-white'),
				activeIndex === index && 'ring-2 ring-yellow-300 ring-inset'
			]}
			style:flex-grow={cell.beats}
			aria-label={conceal
				? `Chord ${index + 1}`
				: `${cell.roman}, ${cell.symbol}, degree ${cell.degree}`}
		>
			<span class="text-[10px] font-medium tracking-wide uppercase opacity-80">
				{cell.beats === 4 ? `Bar ${index + 1}` : `${cell.beats} beats`}
			</span>
			{#if conceal}
				<span class="text-lg leading-tight font-bold">?</span>
			{:else}
				<span class="text-lg leading-tight font-bold">{cell.roman}</span>
				<span class="text-xs font-medium">{cell.symbol}</span>
				<span class="font-mono text-[11px] opacity-80">{cell.degree}</span>
			{/if}
		</div>
	{/each}
</div>
