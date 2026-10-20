<script lang="ts">
	import { tick } from 'svelte';
	import { dev } from '$app/environment';
	import MelodyGrid from '$lib/components/audition/MelodyGrid.svelte';
	import {
		BEAT_STEP,
		BEATS_PER_BAR,
		blankNotation,
		expectedBeats,
		fitNotes,
		formatBeats,
		mapNoteAt,
		parseNotation,
		placeNote,
		serializeNotation,
		type AuditionMelody,
		type MelodyNote
	} from '$lib/audition/notation';

	type History = { undo: string[]; redo: string[] };

	type Props = {
		bars: number;
		melodies?: AuditionMelody[];
		selectedId?: string | null;
		playheadBeat?: number | null;
		playing?: boolean;
		dirty?: boolean;
		saving?: boolean;
		saveMessage?: string;
		play: () => void;
		stop: () => void;
		save: () => void;
		download: () => void;
		reload: () => void;
	};

	let {
		bars,
		melodies = $bindable([]),
		selectedId = $bindable(null),
		playheadBeat = null,
		playing = false,
		dirty = false,
		saving = false,
		saveMessage = '',
		play,
		stop,
		save,
		download,
		reload
	}: Props = $props();

	const durations = [
		{ beats: 0.5, label: '⅛' },
		{ beats: 1, label: '¼' },
		{ beats: 1.5, label: '¼·' },
		{ beats: 2, label: '½' },
		{ beats: 3, label: '½·' },
		{ beats: 4, label: '1' }
	];

	const solfege = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Ti'];

	let armed = $state<{ degree: number | null; octave: number; beats: number }>({
		degree: 1,
		octave: 0,
		beats: 1
	});
	let cursorBeat = $state(0);
	let history = $state<Record<string, History>>({});
	let confirmDelete = $state(false);
	let notationCheckpoint = '';
	let checkpointPending = false;

	const selected = $derived(melodies.find((melody) => melody.id === selectedId) ?? null);
	const parsed = $derived(selected ? parseNotation(selected.notation, bars) : null);
	const neededBeats = $derived(expectedBeats(bars));
	const gridBeats = $derived.by(() => {
		if (
			!parsed ||
			parsed.code === 'token' ||
			parsed.code === 'duration' ||
			parsed.code === 'empty'
		) {
			return neededBeats;
		}
		return Math.max(neededBeats, parsed.beats);
	});
	const canPaint = $derived(
		parsed !== null && parsed.code !== 'token' && parsed.code !== 'duration'
	);
	const undoCount = $derived(selected ? (history[selected.id]?.undo.length ?? 0) : 0);
	const redoCount = $derived(selected ? (history[selected.id]?.redo.length ?? 0) : 0);

	function buckets(id: string): History {
		if (!history[id]) history[id] = { undo: [], redo: [] };
		return history[id];
	}

	function commitNotation(next: string) {
		if (!selected || next === selected.notation) return;
		const bucket = buckets(selected.id);
		bucket.undo.push(selected.notation);
		if (bucket.undo.length > 100) bucket.undo.shift();
		bucket.redo = [];
		selected.notation = next;
		notationCheckpoint = next;
		checkpointPending = false;
		stop();
	}

	function sourceNotes(): MelodyNote[] {
		return parsed?.notes ?? [];
	}

	function writeAt(startBeat: number) {
		if (!selected || !canPaint) return;
		cursorBeat = startBeat;
		const nextNotes = placeNote(
			sourceNotes(),
			startBeat,
			{
				degree: armed.degree,
				octave: armed.degree === null ? 0 : armed.octave,
				beats: armed.beats
			},
			gridBeats
		);
		commitNotation(serializeNotation(nextNotes));
		const advance = startBeat + Math.min(armed.beats, Math.max(BEAT_STEP, gridBeats - startBeat));
		cursorBeat = Math.min(advance, Math.max(0, gridBeats - BEAT_STEP));
		if (cursorBeat >= gridBeats) cursorBeat = 0;
	}

	function paintCell(beat: number) {
		writeAt(beat);
		const active = document.activeElement;
		if (active instanceof HTMLElement) {
			active.closest<HTMLElement>('[role="grid"]')?.focus();
		}
	}

	function undo() {
		if (!selected) return;
		const bucket = buckets(selected.id);
		const previous = bucket.undo.pop();
		if (previous === undefined) return;
		bucket.redo.push(selected.notation);
		selected.notation = previous;
		notationCheckpoint = previous;
		checkpointPending = false;
		stop();
	}

	function redo() {
		if (!selected) return;
		const bucket = buckets(selected.id);
		const next = bucket.redo.pop();
		if (next === undefined) return;
		bucket.undo.push(selected.notation);
		selected.notation = next;
		notationCheckpoint = next;
		checkpointPending = false;
		stop();
	}

	function onNotationFocus() {
		if (!selected) return;
		notationCheckpoint = selected.notation;
		checkpointPending = false;
	}

	function onNotationInput(value: string) {
		if (!selected) return;
		if (!checkpointPending) {
			const bucket = buckets(selected.id);
			bucket.undo.push(notationCheckpoint);
			bucket.redo = [];
			checkpointPending = true;
		}
		selected.notation = value;
		stop();
	}

	function fitLength() {
		if (!selected || !parsed) return;
		commitNotation(serializeNotation(fitNotes(parsed.notes, neededBeats)));
	}

	function cleanNotation() {
		if (!selected || !parsed?.ok) return;
		commitNotation(serializeNotation(parsed.notes));
	}

	function newId(): string {
		return `m-${crypto.randomUUID().slice(0, 8)}`;
	}

	async function addMelody() {
		const melody: AuditionMelody = {
			id: newId(),
			name: 'New melody',
			notation: blankNotation(bars)
		};
		melodies.push(melody);
		selectedId = melody.id;
		cursorBeat = 0;
		confirmDelete = false;
		await tick();
		document.getElementById(`melody-${melody.id}`)?.scrollIntoView({ block: 'nearest' });
	}

	function duplicateMelody() {
		if (!selected) return;
		const copy: AuditionMelody = {
			id: newId(),
			name: `${selected.name} copy`,
			notation: selected.notation
		};
		const index = melodies.findIndex((melody) => melody.id === selected.id);
		melodies.splice(index + 1, 0, copy);
		selectedId = copy.id;
		confirmDelete = false;
	}

	function deleteMelody() {
		if (!selected) return;
		if (!confirmDelete) {
			confirmDelete = true;
			return;
		}
		const index = melodies.findIndex((melody) => melody.id === selected.id);
		melodies.splice(index, 1);
		delete history[selected.id];
		selectedId = melodies[Math.min(index, melodies.length - 1)]?.id ?? null;
		confirmDelete = false;
		stop();
	}

	function moveMelody(direction: -1 | 1) {
		if (!selected) return;
		const index = melodies.findIndex((melody) => melody.id === selected.id);
		const target = index + direction;
		if (target < 0 || target >= melodies.length) return;
		const [item] = melodies.splice(index, 1);
		melodies.splice(target, 0, item);
	}

	function selectMelody(id: string) {
		selectedId = id;
		cursorBeat = 0;
		confirmDelete = false;
	}

	function changeArmedOctave(octave: number) {
		armed.octave = octave;
	}

	function deleteNoteAtCursor() {
		if (!selected || !canPaint || !parsed) return;
		const nextNotes = mapNoteAt(parsed.notes, cursorBeat, gridBeats, (note) => ({
			...note,
			degree: null,
			octave: 0
		}));
		const current = parsed.notes;
		let beat = 0;
		for (const note of current) {
			if (cursorBeat >= beat - 1e-6 && cursorBeat < beat + note.beats - 1e-6) {
				cursorBeat = beat;
				break;
			}
			beat += note.beats;
		}
		commitNotation(serializeNotation(nextNotes));
	}

	function onGridKey(event: KeyboardEvent) {
		if (!selected) return;
		const beatSpan = Math.max(BEAT_STEP, gridBeats);
		if (event.key === 'ArrowRight') {
			event.preventDefault();
			cursorBeat = Math.min(beatSpan - BEAT_STEP, cursorBeat + BEAT_STEP);
		} else if (event.key === 'ArrowLeft') {
			event.preventDefault();
			cursorBeat = Math.max(0, cursorBeat - BEAT_STEP);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			cursorBeat = Math.max(0, cursorBeat - BEATS_PER_BAR);
		} else if (event.key === 'ArrowDown') {
			event.preventDefault();
			cursorBeat = Math.min(beatSpan - BEAT_STEP, cursorBeat + BEATS_PER_BAR);
		} else if (/^[1-7]$/.test(event.key)) {
			event.preventDefault();
			armed.degree = Number(event.key);
			writeAt(cursorBeat);
		} else if (event.key === 'r' || event.key === 'R') {
			event.preventDefault();
			armed.degree = null;
			writeAt(cursorBeat);
		} else if (event.key === 'Backspace') {
			event.preventDefault();
			deleteNoteAtCursor();
		} else if (event.key === 'z' && (event.metaKey || event.ctrlKey)) {
			event.preventDefault();
			if (event.shiftKey) redo();
			else undo();
		}
	}
</script>

<div class="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
	<div class="flex flex-col gap-2">
		<div class="flex gap-2">
			<button
				type="button"
				class="flex-1 rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500"
				onclick={addMelody}
			>
				Add melody
			</button>
			<button
				type="button"
				class="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-40 dark:border-gray-600 dark:hover:bg-gray-700"
				disabled={!selected}
				onclick={duplicateMelody}
			>
				Duplicate
			</button>
		</div>
		<ul class="max-h-[28rem] space-y-1 overflow-y-auto pr-1">
			{#each melodies as melody, index (melody.id)}
				<li id="melody-{melody.id}">
					<button
						type="button"
						class={[
							'w-full rounded border px-3 py-2 text-left',
							melody.id === selectedId
								? 'border-blue-500 bg-blue-600 text-white'
								: 'border-gray-200 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800'
						]}
						onclick={() => selectMelody(melody.id)}
					>
						<span class="block text-sm font-semibold">{index + 1}. {melody.name}</span>
						<span class="mt-0.5 block truncate font-mono text-[11px] opacity-80"
							>{melody.notation}</span
						>
					</button>
				</li>
			{/each}
		</ul>
		{#if melodies.length === 0}
			<p class="text-sm text-gray-500">No melodies in this file yet.</p>
		{/if}
	</div>

	<div class="min-w-0">
		{#if selected}
			<div class="mb-3 flex flex-wrap items-center gap-2">
				<input
					class="min-w-48 flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
					value={selected.name}
					aria-label="Melody name"
					oninput={(event) => {
						selected.name = event.currentTarget.value;
					}}
				/>
				<button
					type="button"
					class="rounded border border-gray-300 px-2 py-2 text-sm disabled:opacity-40 dark:border-gray-600"
					disabled={melodies.findIndex((melody) => melody.id === selected.id) <= 0}
					onclick={() => moveMelody(-1)}
				>
					Up
				</button>
				<button
					type="button"
					class="rounded border border-gray-300 px-2 py-2 text-sm disabled:opacity-40 dark:border-gray-600"
					disabled={melodies.findIndex((melody) => melody.id === selected.id) >=
						melodies.length - 1}
					onclick={() => moveMelody(1)}
				>
					Down
				</button>
				<button
					type="button"
					class={[
						'rounded px-3 py-2 text-sm font-medium',
						confirmDelete ? 'bg-red-600 text-white' : 'border border-gray-300 dark:border-gray-600'
					]}
					onclick={deleteMelody}
				>
					{confirmDelete ? 'Confirm delete' : 'Delete'}
				</button>
				{#if confirmDelete}
					<button
						type="button"
						class="rounded px-2 py-2 text-sm text-gray-500"
						onclick={() => (confirmDelete = false)}
					>
						Cancel
					</button>
				{/if}
			</div>

			<label class="mb-1 block text-xs font-medium text-gray-500" for="melody-notation">
				Notation · {parsed ? formatBeats(parsed.beats) : 0} / {neededBeats} beats
			</label>
			<input
				id="melody-notation"
				class={[
					'mb-1 w-full rounded border bg-white px-3 py-2 font-mono text-sm dark:bg-gray-900',
					parsed?.ok ? 'border-gray-300 dark:border-gray-600' : 'border-red-400 dark:border-red-500'
				]}
				value={selected.notation}
				spellcheck="false"
				onfocus={onNotationFocus}
				oninput={(event) => onNotationInput(event.currentTarget.value)}
			/>
			<p class="mb-3 text-xs text-gray-500 dark:text-gray-400">
				1–7 degree, r rest, ' octave up, , octave down, :beats (0.5 eighth, 2 half, 4 whole). |
				splits bars.
			</p>
			{#if parsed && !parsed.ok}
				<p class="mb-3 text-sm text-red-600 dark:text-red-400">{parsed.error}</p>
			{/if}

			<div class="mb-3 flex flex-wrap gap-2">
				<button
					type="button"
					class="rounded border px-2 py-1 text-sm disabled:opacity-40 dark:border-gray-600"
					disabled={undoCount === 0}
					onclick={undo}
				>
					Undo
				</button>
				<button
					type="button"
					class="rounded border px-2 py-1 text-sm disabled:opacity-40 dark:border-gray-600"
					disabled={redoCount === 0}
					onclick={redo}
				>
					Redo
				</button>
				<button
					type="button"
					class="rounded border px-2 py-1 text-sm disabled:opacity-40 dark:border-gray-600"
					disabled={!parsed || parsed.code === 'token' || parsed.code === 'duration'}
					onclick={fitLength}
				>
					Fit to {bars} bar{bars === 1 ? '' : 's'}
				</button>
				<button
					type="button"
					class="rounded border px-2 py-1 text-sm disabled:opacity-40 dark:border-gray-600"
					disabled={!parsed?.ok}
					onclick={cleanNotation}
				>
					Tidy notation
				</button>
			</div>

			<div class="mb-2 flex flex-wrap items-center gap-2">
				<span class="text-xs font-medium text-gray-500">Degree</span>
				{#each solfege as name, index (name)}
					<button
						type="button"
						title={name}
						class={[
							'h-9 w-9 rounded border text-sm font-bold',
							armed.degree === index + 1
								? 'border-blue-600 bg-blue-600 text-white'
								: 'border-gray-300 dark:border-gray-600'
						]}
						onclick={() => (armed.degree = index + 1)}
					>
						{index + 1}
					</button>
				{/each}
				<button
					type="button"
					class={[
						'h-9 rounded border px-3 text-sm font-bold',
						armed.degree === null
							? 'border-blue-600 bg-blue-600 text-white'
							: 'border-gray-300 dark:border-gray-600'
					]}
					onclick={() => (armed.degree = null)}
				>
					Rest
				</button>
			</div>

			<div class="mb-3 flex flex-wrap items-center gap-2">
				<span class="text-xs font-medium text-gray-500">Length</span>
				{#each durations as duration (duration.beats)}
					<button
						type="button"
						class={[
							'h-9 min-w-9 rounded border px-2 text-sm font-semibold',
							armed.beats === duration.beats
								? 'border-blue-600 bg-blue-600 text-white'
								: 'border-gray-300 dark:border-gray-600'
						]}
						onclick={() => (armed.beats = duration.beats)}
					>
						{duration.label}
					</button>
				{/each}
				<span class="ml-2 text-xs font-medium text-gray-500">Octave</span>
				{#each [-1, 0, 1, 2] as octave (octave)}
					<button
						type="button"
						class={[
							'h-9 rounded border px-2 text-sm',
							armed.octave === octave
								? 'border-amber-600 bg-amber-500 text-black'
								: 'border-gray-300 dark:border-gray-600'
						]}
						onclick={() => changeArmedOctave(octave)}
					>
						{octave > 0 ? `+${octave}` : octave}
					</button>
				{/each}
			</div>

			<p class="mb-2 text-xs text-gray-500">
				Click a cell to write
				{armed.degree === null ? 'a rest' : `degree ${armed.degree}`}
				· {durations.find((duration) => duration.beats === armed.beats)?.label}
				· octave {armed.octave > 0 ? `+${armed.octave}` : armed.octave}. Keys 1–7 and R write at the
				cursor. Arrows move. Backspace clears the note.
			</p>
			{#if !canPaint}
				<p class="mb-2 text-sm text-red-600 dark:text-red-400">
					Fix the notation text before painting on the grid.
				</p>
			{/if}

			<div
				role="grid"
				aria-label="Melody grid"
				tabindex="0"
				class="rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
				onkeydown={onGridKey}
			>
				<MelodyGrid
					notes={parsed?.notes ?? []}
					expectedBeats={neededBeats}
					totalBeats={gridBeats}
					{playheadBeat}
					{cursorBeat}
					oncell={canPaint ? paintCell : undefined}
				/>
			</div>
		{:else}
			<p class="text-sm text-gray-500">Add a melody to start editing this file.</p>
		{/if}

		<div class="mt-4 flex flex-wrap items-center gap-2">
			<button
				type="button"
				class="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
				disabled={!selected || !parsed?.ok}
				onclick={play}
			>
				Play
			</button>
			<button
				type="button"
				class="rounded border border-gray-300 px-3 py-2 text-sm disabled:opacity-40 dark:border-gray-600"
				disabled={!playing}
				onclick={stop}
			>
				Stop
			</button>
			<button
				type="button"
				class="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40"
				disabled={!dev || saving}
				onclick={save}
			>
				{saving ? 'Saving…' : `Save ${bars}-bar.json`}
			</button>
			<button
				type="button"
				class="rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600"
				onclick={download}
			>
				Download
			</button>
			<button
				type="button"
				class="rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600"
				onclick={reload}
			>
				Reload file
			</button>
			{#if dirty}
				<span class="text-xs font-medium text-amber-600 dark:text-amber-400">Unsaved changes</span>
			{/if}
			{#if saveMessage}
				<span class="text-xs text-gray-600 dark:text-gray-300">{saveMessage}</span>
			{/if}
		</div>
		<p class="mt-2 text-xs text-gray-500">
			{#if dev}
				Save writes <span class="font-mono">src/lib/audition/melodies/{bars}-bar.json</span>. You
				can also edit that file by hand using the same notation.
			{:else}
				Saving the JSON files is available while the dev server is running. Download a copy here.
			{/if}
		</p>
	</div>
</div>
