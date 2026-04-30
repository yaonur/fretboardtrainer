<script lang="ts">
	import * as Tone from 'tone';
	import { onDestroy } from 'svelte';
	import { LocalStorage } from '$lib/stores/storage.svelte';
	import {
		CIRCLE_OF_FIFTHS,
		DEFAULT_CHORD_PROMPTS_SETTINGS,
		TONALITY_MODES,
		addPoolEntry,
		buildDiatonicScale,
		createChordPromptProfile,
		diatonicDegreePreview,
		formatPoolEntryLabel,
		getActiveProfile,
		pickRandomChordFromPool,
		poolEntryKey,
		profileIndex,
		removePoolEntry,
		sanitizeChordPromptsSettings,
		type ChordPromptPick,
		type ChordPromptProfile,
		type ChordPromptsSettings,
		type PooledChordEntry
	} from '$lib/chords/chordPrompts';

	const settings = new LocalStorage<ChordPromptsSettings>(
		'chordPromptsSettings',
		DEFAULT_CHORD_PROMPTS_SETTINGS
	);

	let didSanitizeSettings = $state(false);
	$effect.pre(() => {
		if (didSanitizeSettings) return;
		didSanitizeSettings = true;
		settings.current = sanitizeChordPromptsSettings(settings.current as Parameters<typeof sanitizeChordPromptsSettings>[0]);
	});

	const activeIx = $derived(profileIndex(settings.current));

	const scaleNotes = $derived(
		buildDiatonicScale(
			settings.current.profiles[activeIx]!.builderTonalityRoot,
			settings.current.profiles[activeIx]!.builderTonalityMode
		)
	);

	let drillRunning = $state(false);
	let currentPick = $state<ChordPromptPick | null>(null);
	let beatsOnChord = $state(0);
	let isAudioInitialized = $state(false);
	let clickSampler: Tone.Sampler | undefined;
	let metronomeInterval: ReturnType<typeof setInterval> | null = null;

	let slashBassByDegree = $state<Record<number, number>>({});

	function getSlashBass(degree: number): number {
		const v = slashBassByDegree[degree];
		if (typeof v === 'number' && v >= 1 && v <= 7) return v;
		const fallback = degree >= 2 ? degree - 1 : 2;
		return fallback <= 7 ? fallback : 1;
	}

	function setSlashBass(degree: number, bassDeg: number) {
		slashBassByDegree = { ...slashBassByDegree, [degree]: bassDeg };
	}

	function draftEntry(degree: number, kind: 'triad' | 'seventh', slashBassDegree?: number): PooledChordEntry {
		const p = settings.current.profiles[activeIx]!;
		return {
			tonalityRoot: p.builderTonalityRoot,
			tonalityMode: p.builderTonalityMode,
			degree,
			kind,
			slashBassDegree
		};
	}

	function addChord(degree: number, kind: 'triad' | 'seventh', slashBassDegree?: number) {
		const p = settings.current.profiles[activeIx]!;
		const entry = draftEntry(degree, kind, slashBassDegree);
		settings.current.profiles[activeIx]!.poolEntries = addPoolEntry(p.poolEntries, entry);
	}

	function removeFromPool(entry: PooledChordEntry) {
		const p = settings.current.profiles[activeIx]!;
		settings.current.profiles[activeIx]!.poolEntries = removePoolEntry(p.poolEntries, entry);
	}

	function clearPool() {
		settings.current.profiles[activeIx]!.poolEntries = [];
	}

	function advanceChord() {
		const p = getActiveProfile(settings.current);
		const pick = pickRandomChordFromPool({
			pool: p.poolEntries,
			lastLabel: currentPick?.label
		});
		currentPick = pick;
	}

	function playClick() {
		const p = getActiveProfile(settings.current);
		if (!p.metronomeEnabled || p.clickVolume <= 0) return;
		if (!isAudioInitialized || !clickSampler) return;
		clickSampler.volume.value = Tone.gainToDb(p.clickVolume);
		clickSampler.triggerAttackRelease('C4', '16n', Tone.now() + 0.02);
	}

	function stopMetronome() {
		if (metronomeInterval) {
			clearInterval(metronomeInterval);
			metronomeInterval = null;
		}
	}

	async function initAudio() {
		if (isAudioInitialized) return;
		await Tone.start();
		clickSampler = new Tone.Sampler({
			urls: { C4: '/sounds/Click.wav' }
		}).toDestination();
		isAudioInitialized = true;
	}

	function onBeatTick() {
		playClick();
		beatsOnChord++;
		const p = getActiveProfile(settings.current);
		if (beatsOnChord >= p.clicksPerChord) {
			beatsOnChord = 0;
			advanceChord();
		}
	}

	async function startDrill() {
		const p = getActiveProfile(settings.current);
		if (p.poolEntries.length === 0) return;
		await initAudio();
		beatsOnChord = 0;
		advanceChord();
		if (!currentPick) return;
		drillRunning = true;
	}

	function stopDrill() {
		drillRunning = false;
		currentPick = null;
		beatsOnChord = 0;
	}

	$effect(() => {
		if (!drillRunning) {
			stopMetronome();
			return;
		}
		const p = getActiveProfile(settings.current);
		const ms = 60000 / p.bpm;
		stopMetronome();
		metronomeInterval = setInterval(onBeatTick, ms);
		return () => {
			stopMetronome();
		};
	});

	function poolContains(entry: PooledChordEntry): boolean {
		const k = poolEntryKey(entry);
		return settings.current.profiles[activeIx]!.poolEntries.some(
			(e: PooledChordEntry) => poolEntryKey(e) === k
		);
	}

	function switchProfile(id: string) {
		if (drillRunning) return;
		settings.current.activeProfileId = id;
	}

	function addNewProfile() {
		if (drillRunning) return;
		const n = settings.current.profiles.length + 1;
		const p = createChordPromptProfile(`Profile ${n}`);
		settings.current.profiles = [...settings.current.profiles, p];
		settings.current.activeProfileId = p.id;
	}

	function deleteActiveProfile() {
		if (drillRunning || settings.current.profiles.length <= 1) return;
		const id = settings.current.activeProfileId;
		const next = settings.current.profiles.filter((x: ChordPromptProfile) => x.id !== id);
		settings.current.profiles = next;
		settings.current.activeProfileId = next[0]!.id;
	}

	const builder = $derived(settings.current.profiles[activeIx]!);

	onDestroy(() => {
		stopDrill();
		if (clickSampler) {
			try {
				clickSampler.dispose();
			} catch {
				/* ignore */
			}
		}
	});
</script>

<div class="flex flex-col items-center p-6">
	<h1 class="mb-2 text-3xl font-bold">Chord prompts</h1>
	<p class="mb-8 max-w-xl text-center text-sm text-gray-600 dark:text-gray-400">
		Each profile has its own chord pool and metronome. Pick a key for the builder, add chords — each
		chord keeps the tonality from when you added it (later key changes do not alter the pool). Mix
		chords from different keys in one profile.
	</p>

	<div class="mb-8 w-full max-w-2xl rounded-lg bg-gray-50 p-6 dark:bg-gray-800">
		<h2 class="mb-3 text-xl font-semibold">Profile</h2>
		<div class="mb-6 flex flex-wrap items-end gap-3">
			<label class="flex flex-col gap-1 text-sm font-medium">
				Active profile
				<select
					value={settings.current.activeProfileId}
					onchange={(e) => switchProfile((e.target as HTMLSelectElement).value)}
					class="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
					disabled={drillRunning}
				>
					{#each settings.current.profiles as pr (pr.id)}
						<option value={pr.id}>{pr.name}</option>
					{/each}
				</select>
			</label>
			<input
				type="text"
				bind:value={settings.current.profiles[activeIx].name}
				class="min-w-[10rem] rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
				placeholder="Name"
				disabled={drillRunning}
				maxlength={48}
			/>
			<button
				type="button"
				onclick={addNewProfile}
				disabled={drillRunning}
				class="rounded border border-gray-400 bg-white px-3 py-1 text-sm font-medium hover:bg-gray-100 dark:border-gray-500 dark:bg-gray-700 dark:hover:bg-gray-600"
			>
				New profile
			</button>
			<button
				type="button"
				onclick={deleteActiveProfile}
				disabled={drillRunning || settings.current.profiles.length <= 1}
				class="rounded border border-red-300 bg-white px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-40 dark:border-red-800 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-950/40"
			>
				Delete profile
			</button>
		</div>

		<h2 class="mb-4 text-xl font-semibold">Builder (key for new chords only)</h2>
		<div class="mb-6 flex flex-wrap items-center gap-4">
			<label class="flex items-center gap-2 text-sm font-medium">
				Key
				<select
					bind:value={settings.current.profiles[activeIx].builderTonalityRoot}
					class="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
					disabled={drillRunning}
				>
					{#each CIRCLE_OF_FIFTHS as n (n)}
						<option value={n}>{n}</option>
					{/each}
				</select>
			</label>
			<label class="flex items-center gap-2 text-sm font-medium">
				Mode
				<select
					bind:value={settings.current.profiles[activeIx].builderTonalityMode}
					class="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
					disabled={drillRunning}
				>
					{#each TONALITY_MODES as m (m)}
						<option value={m}
							>{m === 'major'
								? 'Major'
								: m === 'naturalMinor'
									? 'Natural minor'
									: 'Harmonic minor'}</option
						>
					{/each}
				</select>
			</label>
		</div>
		{#if scaleNotes.length === 7}
			<p class="mb-4 text-xs text-gray-600 dark:text-gray-400">
				Scale for new chords: {scaleNotes.join(' — ')}
			</p>
		{/if}

		<h2 class="mb-3 text-lg font-semibold">Add diatonic chords</h2>
		<p class="mb-3 text-xs text-gray-600 dark:text-gray-400">
			Each chord is saved with the key/mode shown above. Change key and add more — existing pool
			chords stay the same.
		</p>

		<div class="mb-6 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
			{#each [1, 2, 3, 4, 5, 6, 7] as deg (deg)}
				{@const prev = diatonicDegreePreview(
					builder.builderTonalityRoot,
					builder.builderTonalityMode,
					deg
				)}
				<div
					class="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-600 dark:bg-gray-900/40"
				>
					<div class="mb-2 flex flex-wrap items-baseline gap-2">
						<span class="font-mono text-sm font-bold text-blue-700 dark:text-blue-300">{prev.roman}</span>
						<span class="text-sm text-gray-700 dark:text-gray-200">
							<span class="text-gray-500">{prev.triad}</span>
							<span class="mx-1 text-gray-400">·</span>
							<span class="text-gray-500">{prev.seventh}</span>
						</span>
					</div>
					<div class="flex flex-wrap gap-2">
						<button
							type="button"
							onclick={() => addChord(deg, 'triad')}
							disabled={drillRunning || poolContains(draftEntry(deg, 'triad'))}
							class="rounded bg-gray-200 px-2 py-1 text-xs font-medium hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600"
						>
							+ Triad {poolContains(draftEntry(deg, 'triad')) ? '(in pool)' : ''}
						</button>
						<button
							type="button"
							onclick={() => addChord(deg, 'seventh')}
							disabled={drillRunning || poolContains(draftEntry(deg, 'seventh'))}
							class="rounded bg-gray-200 px-2 py-1 text-xs font-medium hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600"
						>
							+ 7th {poolContains(draftEntry(deg, 'seventh')) ? '(in pool)' : ''}
						</button>
					</div>
					<div class="mt-2 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-2 dark:border-gray-700">
						<span class="text-xs text-gray-500">Bass (slash):</span>
						<select
							value={String(getSlashBass(deg))}
							onchange={(e) => setSlashBass(deg, parseInt((e.target as HTMLSelectElement).value, 10))}
							class="rounded border border-gray-300 bg-white px-1 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white"
							disabled={drillRunning}
						>
							{#each [1, 2, 3, 4, 5, 6, 7] as b (b)}
								<option value={String(b)}
									>{b}: {scaleNotes[b - 1] ?? '?'}</option
								>
							{/each}
						</select>
						<button
							type="button"
							onclick={() => addChord(deg, 'triad', getSlashBass(deg))}
							disabled={drillRunning ||
								poolContains(draftEntry(deg, 'triad', getSlashBass(deg)))}
							class="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 hover:bg-amber-200 disabled:opacity-50 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900/60"
						>
							+ Triad / bass
						</button>
						<button
							type="button"
							onclick={() => addChord(deg, 'seventh', getSlashBass(deg))}
							disabled={drillRunning ||
								poolContains(draftEntry(deg, 'seventh', getSlashBass(deg)))}
							class="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 hover:bg-amber-200 disabled:opacity-50 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900/60"
						>
							+ 7th / bass
						</button>
					</div>
				</div>
			{/each}
		</div>

		<h2 class="mb-2 text-lg font-semibold">Your pool (this profile)</h2>
		<div class="mb-3 flex flex-wrap gap-2">
			{#each builder.poolEntries as p (poolEntryKey(p))}
				<button
					type="button"
					onclick={() => removeFromPool(p)}
					disabled={drillRunning}
					class="group flex max-w-full items-center gap-1 rounded-full border border-blue-300 bg-blue-50 px-3 py-1 text-sm dark:border-blue-700 dark:bg-blue-950/50"
					title="Remove"
				>
					<span class="truncate">{formatPoolEntryLabel(p)}</span>
					<span class="shrink-0 text-xs text-gray-500"
						>({p.tonalityRoot}{p.tonalityMode === 'major'
							? ' · maj'
							: p.tonalityMode === 'naturalMinor'
								? ' · nat'
								: ' · harm'})</span
					>
					<span class="shrink-0 text-red-600 group-hover:underline dark:text-red-400">×</span>
				</button>
			{:else}
				<span class="text-sm text-gray-500">No chords yet—add from the list above.</span>
			{/each}
		</div>
		<button
			type="button"
			onclick={clearPool}
			disabled={drillRunning || builder.poolEntries.length === 0}
			class="text-xs text-red-600 underline disabled:opacity-40 dark:text-red-400"
		>
			Clear pool
		</button>

		<h2 class="mb-4 mt-8 text-xl font-semibold">Metronome (this profile)</h2>

		<div class="mb-4 flex flex-wrap items-center gap-4">
			<span class="text-sm font-medium">Tempo:</span>
			<input
				type="range"
				min="40"
				max="240"
				step="1"
				bind:value={settings.current.profiles[activeIx].bpm}
				class="w-40 accent-blue-500"
				disabled={drillRunning}
			/>
			<span class="text-sm">{builder.bpm} BPM</span>
		</div>

		<div class="mb-4 flex flex-wrap items-center gap-4">
			<span class="text-sm font-medium">Beats per chord:</span>
			<input
				type="range"
				min="1"
				max="32"
				step="1"
				bind:value={settings.current.profiles[activeIx].clicksPerChord}
				class="w-40 accent-blue-500"
				disabled={drillRunning}
			/>
			<span class="text-sm">{builder.clicksPerChord}</span>
		</div>

		<div class="mb-4 flex flex-wrap items-center gap-4">
			<span class="text-sm font-medium">Click:</span>
			<label class="flex cursor-pointer select-none items-center gap-2">
				<input
					type="checkbox"
					bind:checked={settings.current.profiles[activeIx].metronomeEnabled}
					class="accent-blue-500"
					disabled={drillRunning}
				/>
				<span class="text-sm">Enabled</span>
			</label>
			<span class="text-sm text-gray-500">Volume</span>
			<input
				type="range"
				min="0"
				max="1"
				step="0.01"
				bind:value={settings.current.profiles[activeIx].clickVolume}
				class="w-32 accent-blue-500"
				disabled={drillRunning || !builder.metronomeEnabled}
			/>
			<span class="text-sm">{Math.round(builder.clickVolume * 100)}%</span>
		</div>
	</div>

	<div class="mb-8 flex flex-col items-center gap-4">
		{#if !drillRunning}
			<button
				type="button"
				onclick={startDrill}
				disabled={builder.poolEntries.length === 0}
				class="rounded bg-blue-500 px-6 py-3 text-lg font-semibold text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-400"
			>
				Start
			</button>
		{:else}
			<button
				type="button"
				onclick={stopDrill}
				class="rounded bg-red-500 px-6 py-3 text-lg font-semibold text-white transition-colors hover:bg-red-600"
			>
				Stop
			</button>
		{/if}
	</div>

	{#if drillRunning && currentPick}
		<div class="flex min-h-[8rem] w-full max-w-3xl flex-col items-center justify-center rounded-xl border-2 border-gray-200 bg-white p-8 dark:border-gray-600 dark:bg-gray-900">
			<p class="mb-2 text-sm text-gray-500">Play this chord</p>
			<p class="break-all text-center text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl dark:text-white">
				{currentPick.label}
			</p>
			<p class="mt-4 text-sm text-gray-500">
				Beats this chord: {beatsOnChord} / {builder.clicksPerChord}
			</p>
		</div>
	{/if}
</div>
