<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import * as Tone from 'tone';
	import { browser, dev } from '$app/environment';
	import MelodyEditor from '$lib/components/audition/MelodyEditor.svelte';
	import MelodyGrid from '$lib/components/audition/MelodyGrid.svelte';
	import { bundledLibraries } from '$lib/audition/catalog';
	import {
		canonicalLibrary,
		expectedBeats,
		libraryIssues,
		normalizeLibrary,
		parseNotation,
		type AuditionLibrary,
		type AuditionMelody,
		type BarCount
	} from '$lib/audition/notation';
	import { AUDITION_SETTINGS_KEY, loadAuditionSettings } from '$lib/stores/auditionSettings';

	const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
	const circleOfFifths = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
	const degreeButtons = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
	const barOptions = [1, 2, 3, 4] as const;
	const registerOptions = noteNames.flatMap((name) =>
		[1, 2, 3].map((octave) => `${name}${octave}`)
	);

	const initial = loadAuditionSettings();

	let libraries = $state<Record<BarCount, AuditionLibrary>>(structuredClone(bundledLibraries));
	let selectedByBars = $state<Record<BarCount, string | null>>({
		1: bundledLibraries[1].melodies[0]?.id ?? null,
		2: bundledLibraries[2].melodies[0]?.id ?? null,
		3: bundledLibraries[3].melodies[0]?.id ?? null,
		4: bundledLibraries[4].melodies[0]?.id ?? null
	});
	let savedJson = $state<Record<BarCount, string>>(
		snapshotLibraries(structuredClone(bundledLibraries))
	);

	let mode = $state<'play' | 'edit'>('play');
	let barCount = $state<BarCount>(initial.barCount);
	let selectedKey = $state(initial.selectedKey);
	let bpm = $state(initial.bpm);
	let clickEnabled = $state(initial.clickEnabled);
	let clickVolume = $state(initial.clickVolume);
	let bassEnabled = $state(initial.bassEnabled);
	let bassDegree = $state(initial.bassDegree);
	let bassSustain = $state(initial.bassSustain);
	let droneRegister = $state(initial.droneRegister);
	let droneVolume = $state(initial.droneVolume);
	let melodyOctave = $state(initial.melodyOctave);
	let loop = $state(initial.loop);
	let autoAdvance = $state(initial.autoAdvance);
	let hideMelody = $state(initial.hideMelody);

	let sampler: Tone.Sampler | undefined;
	let clickSampler: Tone.Sampler | undefined;
	let droneSampler: Tone.Sampler | undefined;
	let samplerLoaded = $state(false);
	let droneSamplerLoaded = $state(false);
	let creatingAudio: Promise<void> | null = null;
	let playToken = 0;
	let disposed = false;

	let playing = $state(false);
	let playingId = $state<string | null>(null);
	let playheadBeat = $state<number | null>(null);
	let playbackMessage = $state('');
	let saving = $state(false);
	let saveMessage = $state('');

	const activeLibrary = $derived(libraries[barCount]);
	const activeMelody = $derived(
		activeLibrary.melodies.find((melody) => melody.id === selectedByBars[barCount]) ??
			activeLibrary.melodies[0] ??
			null
	);
	const activeParse = $derived(
		activeMelody ? parseNotation(activeMelody.notation, barCount) : null
	);
	const dirty = $derived(
		JSON.stringify(canonicalLibrary(libraries[barCount])) !== savedJson[barCount]
	);
	const currentScale = $derived(generateMajorScale(selectedKey));
	const scaleSpelling = $derived(
		currentScale.map((note, index) => `${index + 1} ${note}`).join('   ')
	);
	const playheadLabel = $derived.by(() => {
		if (!activeParse?.ok || playheadBeat === null) return '';
		let beat = 0;
		for (const note of activeParse.notes) {
			if (playheadBeat >= beat - 1e-6 && playheadBeat < beat + note.beats - 1e-6) {
				if (note.degree === null) return 'Rest';
				const name = currentScale[note.degree - 1] ?? '';
				const mark =
					note.octave > 0
						? "'".repeat(note.octave)
						: note.octave < 0
							? ','.repeat(-note.octave)
							: '';
				return `${note.degree}${mark}  ${name}`;
			}
			beat += note.beats;
		}
		return '';
	});

	function snapshotLibraries(libs: Record<BarCount, AuditionLibrary>): Record<BarCount, string> {
		return {
			1: JSON.stringify(canonicalLibrary(libs[1])),
			2: JSON.stringify(canonicalLibrary(libs[2])),
			3: JSON.stringify(canonicalLibrary(libs[3])),
			4: JSON.stringify(canonicalLibrary(libs[4]))
		};
	}

	$effect(() => {
		if (!browser) return;
		localStorage.setItem(
			AUDITION_SETTINGS_KEY,
			JSON.stringify({
				selectedKey,
				bpm,
				clickEnabled,
				clickVolume,
				bassEnabled,
				bassDegree,
				bassSustain,
				droneRegister,
				droneVolume,
				melodyOctave,
				loop,
				autoAdvance,
				hideMelody,
				barCount
			})
		);
	});

	function generateMajorScale(rootNote: string): string[] {
		const majorScaleIntervals = [0, 2, 4, 5, 7, 9, 11];
		const flats: Record<string, string> = {
			Db: 'C#',
			Eb: 'D#',
			Gb: 'F#',
			Ab: 'G#',
			Bb: 'A#'
		};
		let start = noteNames.indexOf(rootNote);
		if (start === -1) start = noteNames.indexOf(flats[rootNote] ?? '');
		if (start === -1) return ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
		return majorScaleIntervals.map((interval) => noteNames[(start + interval) % 12]);
	}

	function getBestOctaveForReference(noteName: string, referenceNote: string): number {
		const reference = parsePitch(referenceNote);
		const targetIndex = noteNames.indexOf(noteName);
		const referenceIndex = noteNames.indexOf(reference.noteName);
		if (targetIndex === -1 || referenceIndex === -1) return 4;
		if (targetIndex < referenceIndex) return reference.octave + 1;
		return reference.octave;
	}

	function parsePitch(pitch: string): { noteName: string; octave: number } {
		const match = /^([A-G]#?)(-?\d+)$/.exec(pitch);
		if (!match) return { noteName: 'C', octave: 3 };
		return { noteName: match[1], octave: Number(match[2]) };
	}

	function getBassPitch(): string {
		const noteName = currentScale[bassDegree - 1] ?? 'C';
		return `${noteName}${getBestOctaveForReference(noteName, droneRegister)}`;
	}

	function melodyPitch(degree: number, octaveOffset: number): string {
		const noteName = currentScale[degree - 1] ?? 'C';
		const bass = parsePitch(getBassPitch());
		const reference = `${bass.noteName}${bass.octave + 1 + melodyOctave}`;
		const octave = Math.max(
			1,
			Math.min(6, getBestOctaveForReference(noteName, reference) + octaveOffset)
		);
		return `${noteName}${octave}`;
	}

	function volumeToDb(volume: number): number {
		if (volume <= 0) return -Infinity;
		return Tone.gainToDb(volume);
	}

	function createSamplers() {
		sampler = new Tone.Sampler({
			urls: { C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3' },
			release: 0.35,
			baseUrl: 'https://tonejs.github.io/audio/salamander/',
			onload: () => {
				samplerLoaded = true;
			}
		}).toDestination();

		clickSampler = new Tone.Sampler({
			urls: { C4: '/sounds/Click.wav' }
		}).toDestination();

		droneSampler = new Tone.Sampler({
			urls: { C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3' },
			release: 0.45,
			attack: 0.02,
			baseUrl: 'https://tonejs.github.io/audio/salamander/',
			onload: () => {
				droneSamplerLoaded = true;
			}
		}).toDestination();
	}

	async function initAudio() {
		await Tone.start();
		if (sampler && clickSampler && droneSampler) return;
		if (!creatingAudio) {
			creatingAudio = Promise.resolve()
				.then(() => createSamplers())
				.catch((cause) => {
					creatingAudio = null;
					throw cause;
				});
		}
		await creatingAudio;
	}

	async function waitUntilLoaded() {
		const started = Date.now();
		while ((!samplerLoaded || !droneSamplerLoaded) && Date.now() - started < 10000) {
			await new Promise((resolve) => setTimeout(resolve, 40));
		}
	}

	function stopPlayback() {
		playToken += 1;
		const transport = Tone.getTransport();
		transport.stop();
		transport.cancel(0);
		transport.position = 0;
		try {
			sampler?.releaseAll();
		} catch {
			/* sampler may already be gone */
		}
		try {
			droneSampler?.releaseAll();
		} catch {
			/* drone may already be gone */
		}
		playing = false;
		playingId = null;
		playheadBeat = null;
	}

	async function startPlayback(melody: AuditionMelody) {
		const parsed = parseNotation(melody.notation, barCount);
		if (!parsed.ok) {
			playbackMessage = parsed.error ?? 'This melody needs a valid length before it can play.';
			return;
		}
		playbackMessage = '';
		await initAudio();
		await waitUntilLoaded();
		if (disposed) return;
		if (!sampler || !droneSampler || !samplerLoaded || !droneSamplerLoaded) {
			playbackMessage = 'Piano sounds are still loading.';
			return;
		}

		stopPlayback();
		const token = playToken;
		const melodyToPlay = melody;
		const beatSeconds = 60 / bpm;
		const total = expectedBeats(barCount);
		const transport = Tone.getTransport();
		transport.bpm.value = bpm;
		transport.position = 0;

		if (clickSampler) clickSampler.volume.value = volumeToDb(clickVolume);
		droneSampler.volume.value = volumeToDb(droneVolume);

		const schedule = (time: number, run: (audioTime: number) => void) => {
			transport.schedule((audioTime) => {
				if (token !== playToken) return;
				run(audioTime);
			}, time);
		};

		if (bassEnabled) {
			const pitch = getBassPitch();
			if (bassSustain) {
				schedule(0, (audioTime) => {
					droneSampler?.triggerAttackRelease(pitch, total * beatSeconds * 0.98, audioTime);
				});
			} else {
				for (let bar = 0; bar < barCount; bar++) {
					schedule(bar * 4 * beatSeconds, (audioTime) => {
						droneSampler?.triggerAttackRelease(pitch, 4 * beatSeconds * 0.92, audioTime);
					});
				}
			}
		}

		if (clickEnabled && clickSampler) {
			for (let beat = 0; beat < total; beat++) {
				schedule(beat * beatSeconds, (audioTime) => {
					clickSampler?.triggerAttackRelease('C4', '16n', audioTime);
				});
			}
		}

		let cursor = 0;
		for (const note of parsed.notes) {
			const when = cursor * beatSeconds;
			const noteBeat = cursor;
			if (note.degree) {
				const pitch = melodyPitch(note.degree, note.octave);
				const duration = Math.max(0.05, note.beats * beatSeconds * 0.9);
				schedule(when, (audioTime) => {
					sampler?.triggerAttackRelease(pitch, duration, audioTime);
				});
			}
			schedule(when, (audioTime) => {
				Tone.getDraw().schedule(() => {
					if (token !== playToken) return;
					playheadBeat = noteBeat;
				}, audioTime);
			});
			cursor += note.beats;
		}

		schedule(total * beatSeconds, (audioTime) => {
			Tone.getDraw().schedule(() => {
				if (token !== playToken) return;
				const liveTransport = Tone.getTransport();
				liveTransport.stop();
				liveTransport.position = 0;
				if (loop) {
					void startPlayback(melodyToPlay);
					return;
				}
				if (autoAdvance) {
					void playDelta(1);
					return;
				}
				playing = false;
				playingId = null;
				playheadBeat = null;
			}, audioTime);
		});

		playing = true;
		playingId = melody.id;
		selectedByBars[barCount] = melody.id;
		transport.start(Tone.now() + 0.08);
	}

	function playActive() {
		if (activeMelody) void startPlayback(activeMelody);
	}

	async function playDelta(delta: number) {
		const list = libraries[barCount].melodies;
		if (list.length === 0) return;
		const index = list.findIndex((melody) => melody.id === selectedByBars[barCount]);
		const next = list[(Math.max(index, 0) + delta + list.length) % list.length];
		selectedByBars[barCount] = next.id;
		await startPlayback(next);
	}

	async function playRandom() {
		const list = libraries[barCount].melodies;
		if (list.length === 0) return;
		const pool = list.filter((melody) => melody.id !== selectedByBars[barCount]);
		const choice = (pool.length > 0 ? pool : list)[
			Math.floor(Math.random() * (pool.length > 0 ? pool.length : list.length))
		];
		selectedByBars[barCount] = choice.id;
		await startPlayback(choice);
	}

	function chooseBars(next: BarCount) {
		if (next === barCount) return;
		stopPlayback();
		barCount = next;
		saveMessage = '';
		playbackMessage = '';
	}

	function shiftKey(delta: number) {
		const index = circleOfFifths.indexOf(selectedKey);
		const start = index === -1 ? 0 : index;
		selectedKey = circleOfFifths[(start + delta + circleOfFifths.length) % circleOfFifths.length];
	}

	async function saveLibrary() {
		const library = canonicalLibrary(libraries[barCount]);
		const issues = libraryIssues(library);
		if (issues.length > 0) {
			saveMessage = issues[0] ?? 'Fix the melodies before saving.';
			return;
		}
		saving = true;
		saveMessage = '';
		try {
			const response = await fetch('/api/audition/melodies', {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(library)
			});
			const data = (await response.json()) as AuditionLibrary & { message?: string };
			if (!response.ok) {
				saveMessage = data.message ?? 'Save failed';
				return;
			}
			const saved = normalizeLibrary(data);
			libraries[barCount] = saved;
			savedJson[barCount] = JSON.stringify(canonicalLibrary(saved));
			saveMessage = `Saved ${barCount}-bar.json`;
		} catch (cause) {
			saveMessage = cause instanceof Error ? cause.message : 'Save failed';
		} finally {
			saving = false;
		}
	}

	async function reloadLibrary() {
		if (dirty && !confirm('Reload this file and drop unsaved edits?')) return;
		const response = await fetch(`/api/audition/melodies?bars=${barCount}`);
		if (!response.ok) {
			saveMessage = 'Could not reload the melody file.';
			return;
		}
		const saved = normalizeLibrary(await response.json());
		libraries[barCount] = saved;
		savedJson[barCount] = JSON.stringify(canonicalLibrary(saved));
		if (!saved.melodies.some((melody) => melody.id === selectedByBars[barCount])) {
			selectedByBars[barCount] = saved.melodies[0]?.id ?? null;
		}
		saveMessage = 'Reloaded from disk';
	}

	function downloadLibrary() {
		const library = canonicalLibrary(libraries[barCount]);
		const blob = new Blob([`${JSON.stringify(library, null, '\t')}\n`], {
			type: 'application/json'
		});
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `${barCount}-bar.json`;
		link.click();
		URL.revokeObjectURL(url);
	}

	function onWindowKey(event: KeyboardEvent) {
		if (mode !== 'play') return;
		const target = event.target as HTMLElement | null;
		const tag = target?.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable)
			return;
		if (event.key === ' ') {
			event.preventDefault();
			if (playing) stopPlayback();
			else playActive();
		} else if (event.key === 'ArrowRight') {
			event.preventDefault();
			void playDelta(1);
		} else if (event.key === 'ArrowLeft') {
			event.preventDefault();
			void playDelta(-1);
		}
	}

	onMount(() => {
		void initAudio().catch(() => {
			playbackMessage = 'Click Play to start audio.';
		});
	});

	onDestroy(() => {
		disposed = true;
		stopPlayback();
		sampler?.dispose();
		clickSampler?.dispose();
		droneSampler?.dispose();
	});
</script>

<svelte:window onkeydown={onWindowKey} />

<div class="mx-auto flex w-full max-w-5xl flex-col px-4 py-6">
	<div class="mb-4 flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="text-3xl font-bold">Audition</h1>
			<p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
				Premade melodies with the tonic in the bass. {activeLibrary.melodies.length} in the {barCount}-bar
				file.
			</p>
		</div>
		<div class="flex rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
			<button
				type="button"
				class={[
					'rounded px-4 py-1.5 text-sm font-semibold',
					mode === 'play' && 'bg-white shadow dark:bg-gray-700'
				]}
				onclick={() => (mode = 'play')}
			>
				Play
			</button>
			<button
				type="button"
				class={[
					'rounded px-4 py-1.5 text-sm font-semibold',
					mode === 'edit' && 'bg-white shadow dark:bg-gray-700'
				]}
				onclick={() => (mode = 'edit')}
			>
				Edit
			</button>
		</div>
	</div>

	<div class="mb-4 flex flex-wrap gap-2">
		{#each barOptions as count (count)}
			<button
				type="button"
				class={[
					'rounded-full border px-4 py-1.5 text-sm font-semibold',
					barCount === count
						? 'border-blue-600 bg-blue-600 text-white'
						: 'border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800'
				]}
				onclick={() => chooseBars(count)}
			>
				{count} bar{count === 1 ? '' : 's'}
			</button>
		{/each}
	</div>

	<details class="mb-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-800" open>
		<summary class="cursor-pointer text-sm font-semibold">Playback</summary>
		<div class="mt-4 flex flex-wrap items-center gap-4">
			<div class="flex items-center gap-2">
				<span class="text-sm font-medium">Key</span>
				<button
					type="button"
					class="rounded border px-2 py-1 text-sm font-bold dark:border-gray-600"
					onclick={() => shiftKey(-1)}>&lt;</button
				>
				<select
					bind:value={selectedKey}
					class="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900"
				>
					{#each circleOfFifths as key (key)}
						<option value={key}>{key}</option>
					{/each}
				</select>
				<button
					type="button"
					class="rounded border px-2 py-1 text-sm font-bold dark:border-gray-600"
					onclick={() => shiftKey(1)}>&gt;</button
				>
			</div>
			<label class="flex items-center gap-2 text-sm">
				Tempo
				<input
					type="range"
					min="40"
					max="200"
					step="1"
					bind:value={bpm}
					class="w-28 accent-blue-500"
				/>
				<span class="w-14">{bpm} bpm</span>
			</label>
			<label class="flex items-center gap-2 text-sm">
				<input type="checkbox" bind:checked={clickEnabled} class="accent-blue-500" />
				Click
			</label>
			{#if clickEnabled}
				<label class="flex items-center gap-2 text-sm">
					<input
						type="range"
						min="0"
						max="1"
						step="0.01"
						bind:value={clickVolume}
						class="w-24 accent-blue-500"
					/>
					{Math.round(clickVolume * 100)}%
				</label>
			{/if}
		</div>
		<p class="mt-3 font-mono text-xs text-gray-600 dark:text-gray-300">{scaleSpelling}</p>

		<div class="mt-4 rounded-lg bg-amber-50 p-3 dark:bg-amber-950/40">
			<label class="flex items-center gap-2 text-sm font-medium">
				<input type="checkbox" bind:checked={bassEnabled} class="accent-amber-500" />
				Tonic bass
			</label>
			{#if bassEnabled}
				<div class="mt-3 flex flex-wrap items-center gap-2">
					{#each degreeButtons as degree, index (degree)}
						<button
							type="button"
							class={[
								'rounded border px-2 py-1 text-sm font-bold',
								bassDegree === index + 1
									? 'border-amber-600 bg-amber-500 text-black'
									: 'border-gray-300 dark:border-gray-600'
							]}
							onclick={() => (bassDegree = index + 1)}
						>
							{degree}
						</button>
					{/each}
					<span class="text-xs text-gray-600 dark:text-gray-300">Now {getBassPitch()}</span>
				</div>
				<div class="mt-3 flex flex-wrap items-center gap-4">
					<label class="flex items-center gap-2 text-sm">
						Register
						<select
							bind:value={droneRegister}
							class="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900"
						>
							{#each registerOptions as register (register)}
								<option value={register}>{register}</option>
							{/each}
						</select>
					</label>
					<label class="flex items-center gap-2 text-sm">
						Volume
						<input
							type="range"
							min="0"
							max="1"
							step="0.01"
							bind:value={droneVolume}
							class="w-24 accent-amber-500"
						/>
						{Math.round(droneVolume * 100)}%
					</label>
					<label class="flex items-center gap-2 text-sm">
						<input type="checkbox" bind:checked={bassSustain} class="accent-amber-500" />
						Hold through the whole melody
					</label>
				</div>
				<div class="mt-3 flex flex-wrap items-center gap-2 text-sm">
					<span>Melody register</span>
					{#each [{ value: -1, label: 'Near bass' }, { value: 0, label: 'Above bass' }, { value: 1, label: 'High' }, { value: 2, label: 'Higher' }] as option (option.value)}
						<button
							type="button"
							class={[
								'rounded border px-2 py-1',
								melodyOctave === option.value
									? 'border-amber-600 bg-amber-500 text-black'
									: 'border-gray-300 dark:border-gray-600'
							]}
							onclick={() => (melodyOctave = option.value)}
						>
							{option.label}
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</details>

	{#if mode === 'play'}
		<div class="mb-4 flex flex-wrap items-center gap-2">
			<button
				type="button"
				class="rounded border px-3 py-2 text-sm dark:border-gray-600"
				onclick={() => void playDelta(-1)}>Prev</button
			>
			<button
				type="button"
				class="rounded bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
				disabled={!activeMelody || activeParse?.ok === false}
				onclick={() => (playing ? stopPlayback() : playActive())}
			>
				{playing ? 'Stop' : 'Play'}
			</button>
			<button
				type="button"
				class="rounded border px-3 py-2 text-sm dark:border-gray-600"
				onclick={() => void playDelta(1)}>Next</button
			>
			<button
				type="button"
				class="rounded border px-3 py-2 text-sm dark:border-gray-600"
				onclick={() => void playRandom()}>Random</button
			>
			<label class="flex items-center gap-2 text-sm">
				<input type="checkbox" bind:checked={loop} class="accent-blue-500" />
				Loop
			</label>
			<label class="flex items-center gap-2 text-sm">
				<input type="checkbox" bind:checked={autoAdvance} class="accent-blue-500" />
				Auto-next
			</label>
			<label class="flex items-center gap-2 text-sm">
				<input type="checkbox" bind:checked={hideMelody} class="accent-blue-500" />
				Hide melody
			</label>
		</div>

		{#if activeMelody}
			<div class="mb-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
				<div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
					<h2 class="text-xl font-semibold">{hideMelody ? 'Listening' : activeMelody.name}</h2>
					{#if !hideMelody && playheadLabel}
						<p class="text-2xl font-bold tabular-nums">{playheadLabel}</p>
					{/if}
				</div>
				{#if !hideMelody}
					<p class="mb-3 font-mono text-sm text-gray-600 dark:text-gray-300">
						{activeMelody.notation}
					</p>
				{/if}
				{#if activeParse?.ok}
					<MelodyGrid
						notes={activeParse.notes}
						expectedBeats={expectedBeats(barCount)}
						totalBeats={expectedBeats(barCount)}
						{playheadBeat}
						conceal={hideMelody}
					/>
				{:else}
					<p class="text-sm text-red-600">{activeParse?.error}</p>
				{/if}
			</div>
		{/if}

		{#if playbackMessage}
			<p class="mb-3 text-sm text-amber-700 dark:text-amber-300">{playbackMessage}</p>
		{/if}
		{#if !samplerLoaded}
			<p class="mb-3 text-xs text-gray-500">Loading piano sounds…</p>
		{/if}

		<ul class="grid gap-2 sm:grid-cols-2">
			{#each activeLibrary.melodies as melody (melody.id)}
				<li>
					<button
						type="button"
						class={[
							'w-full rounded-lg border px-3 py-3 text-left',
							melody.id === activeMelody?.id
								? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40'
								: 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'
						]}
						onclick={() => {
							selectedByBars[barCount] = melody.id;
							void startPlayback(melody);
						}}
					>
						<span class="flex items-center justify-between gap-2">
							<span class="font-semibold">{melody.name}</span>
							{#if playingId === melody.id}
								<span class="text-xs font-medium text-emerald-600">Playing</span>
							{/if}
						</span>
						{#if !hideMelody}
							<span class="mt-1 block truncate font-mono text-xs text-gray-500"
								>{melody.notation}</span
							>
						{/if}
					</button>
				</li>
			{/each}
		</ul>
		<p class="mt-4 text-xs text-gray-500">
			Space plays and stops. Arrow keys move through the list.
		</p>
	{:else}
		{#key barCount}
			<MelodyEditor
				bars={barCount}
				bind:melodies={libraries[barCount].melodies}
				bind:selectedId={selectedByBars[barCount]}
				{playheadBeat}
				{playing}
				{dirty}
				{saving}
				{saveMessage}
				play={playActive}
				stop={stopPlayback}
				save={saveLibrary}
				download={downloadLibrary}
				reload={reloadLibrary}
			/>
		{/key}
		{#if !dev}
			<p class="mt-2 text-xs text-gray-500">
				Open the dev server to write melodies back into the JSON files.
			</p>
		{/if}
	{/if}
</div>
