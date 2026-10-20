<script lang="ts">
	import { BEAT_STEP, BEATS_PER_BAR, notesToCells, type MelodyNote } from '$lib/audition/notation';

	type Props = {
		notes: MelodyNote[];
		expectedBeats: number;
		totalBeats: number;
		playheadBeat?: number | null;
		cursorBeat?: number | null;
		conceal?: boolean;
		oncell?: (beat: number) => void;
	};

	let {
		notes,
		expectedBeats,
		totalBeats,
		playheadBeat = null,
		cursorBeat = null,
		conceal = false,
		oncell
	}: Props = $props();

	const degreeClass = [
		'bg-red-600 text-white',
		'bg-orange-600 text-white',
		'bg-amber-500 text-black',
		'bg-emerald-600 text-white',
		'bg-sky-600 text-white',
		'bg-violet-600 text-white',
		'bg-pink-600 text-white'
	];

	const eighthsPerBar = Math.round(BEATS_PER_BAR / BEAT_STEP);

	const cells = $derived.by(() => {
		const raw = notesToCells(notes, totalBeats);
		const cursorIndex = cursorBeat === null ? -1 : Math.max(0, Math.round(cursorBeat / BEAT_STEP));
		let cursorStart = cursorIndex;
		while (cursorStart > 0 && raw[cursorStart]?.tied) cursorStart--;
		const playIndex =
			playheadBeat === null ? -1 : Math.max(0, Math.floor(playheadBeat / BEAT_STEP + 1e-6));

		return raw.map((cell, index) => {
			let noteStart = index;
			while (noteStart > 0 && raw[noteStart].tied) noteStart--;
			const octave =
				cell.degree === null
					? ''
					: cell.octave > 0
						? "'".repeat(cell.octave)
						: cell.octave < 0
							? ','.repeat(-cell.octave)
							: '';
			const label = cell.degree === null ? (cell.tied ? '·' : 'r') : `${cell.degree}${octave}`;
			const beat = index * BEAT_STEP;
			const bar = Math.floor(beat / BEATS_PER_BAR) + 1;
			const beatInBar = (beat % BEATS_PER_BAR) + 1;
			const what = cell.degree === null ? 'rest' : `degree ${cell.degree}`;
			return {
				index,
				beat,
				degree: cell.degree,
				tied: cell.tied,
				label: cell.tied && cell.degree !== null ? '·' : label,
				cursor: index === cursorIndex,
				inCursorNote: cursorIndex >= 0 && noteStart === cursorStart,
				playhead: index === playIndex,
				overflow: beat >= expectedBeats - 1e-6,
				barStart: index % eighthsPerBar === 0,
				beatStart: index % 2 === 0,
				aria: cell.tied ? `Held ${what}, bar ${bar}` : `${what}, bar ${bar}, beat ${beatInBar}`
			};
		});
	});

	const barCount = $derived(Math.max(1, Math.ceil(totalBeats / BEATS_PER_BAR)));
	const eighthCount = $derived(cells.length);
</script>

<div class="overflow-x-auto pb-1">
	<div class="min-w-full" style:--eighths={eighthCount}>
		<div class="melody-grid mb-1 grid">
			{#each Array.from({ length: barCount }, (_, index) => index) as bar (bar)}
				<div
					class={[
						'text-center text-[11px] font-medium text-gray-500 dark:text-gray-400',
						bar * BEATS_PER_BAR >= expectedBeats && 'text-red-500'
					]}
					style:grid-column={`span ${Math.min(eighthsPerBar, eighthCount - bar * eighthsPerBar)}`}
				>
					Bar {bar + 1}
				</div>
			{/each}
		</div>
		<div class="melody-grid mb-1 grid">
			{#each cells as cell (cell.index)}
				{#if cell.beatStart}
					<div class="text-center text-[10px] text-gray-400" style:grid-column="span 2">
						{((cell.index / 2) % BEATS_PER_BAR) + 1}
					</div>
				{/if}
			{/each}
		</div>
		<div class="melody-grid grid">
			{#each cells as cell (cell.index)}
				{@const color =
					conceal && cell.degree !== null
						? 'bg-slate-500 text-transparent'
						: cell.degree === null
							? 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
							: degreeClass[cell.degree - 1]}
				{#if oncell}
					<button
						type="button"
						aria-label={cell.aria}
						class={[
							'h-12 border-y border-r border-black/10 text-xs font-bold dark:border-white/10',
							color,
							cell.barStart && 'border-l-2 border-l-gray-500',
							!cell.barStart && cell.tied && 'border-l-0',
							!cell.barStart && !cell.tied && 'border-l border-l-black/20',
							cell.cursor && 'ring-2 ring-blue-500 ring-inset',
							cell.playhead && 'ring-2 ring-yellow-300 ring-inset',
							cell.inCursorNote && !cell.cursor && 'brightness-110',
							cell.overflow && 'outline outline-1 outline-red-500'
						]}
						onclick={() => oncell(cell.beat)}
					>
						{conceal ? '' : cell.label}
					</button>
				{:else}
					<div
						class={[
							'h-12 border-y border-r border-black/10 text-center text-xs leading-[3rem] font-bold dark:border-white/10',
							color,
							cell.barStart && 'border-l-2 border-l-gray-500',
							!cell.barStart && cell.tied && 'border-l-0',
							!cell.barStart && !cell.tied && 'border-l border-l-black/20',
							cell.playhead && 'ring-2 ring-yellow-300 ring-inset',
							cell.overflow && 'outline outline-1 outline-red-500'
						]}
					>
						{conceal ? '' : cell.label}
					</div>
				{/if}
			{/each}
		</div>
	</div>
</div>

<style>
	.melody-grid {
		grid-template-columns: repeat(var(--eighths), minmax(1.7rem, 1fr));
		min-width: calc(var(--eighths) * 1.7rem);
	}
</style>
