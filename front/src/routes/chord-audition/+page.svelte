<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import * as Tone from 'tone';
	import { browser } from '$app/environment';
	import ProgressionGrid from '$lib/components/chord-audition/ProgressionGrid.svelte';
	import { chordLibrary } from '$lib/chord-audition/catalog';
	import { voiceProgression } from '$lib/chord-audition/harmony';
	import {
		BEATS_PER_CHORD_OPTIONS,
		chordCount,
		lengthsIn,
		parseProgression,
		type ChordProgression
	} from '$lib/chord-audition/notation';
	import {
		CIRCLE_OF_FIFTHS,
		buildDiatonicScale,
		diatonicDegreePreview,
		type CircleRoot
	} from '$lib/chords/chordPrompts';
	import { createDegreeVoiceSampler, triggerDegreeVoice } from '$lib/audition/degreeVoice';
	import {
		formatPhaseSequence,
		formatPhaseSequenceCompact,
		parsePhaseSequenceText
	} from '$lib/audition/phases';
	import {
		CHORD_AUDITION_SETTINGS_KEY,
		loadChordAuditionSettings,
		type AudiateBass
	} from '$lib/stores/chordAuditionSettings';
	import type { AuditionPhase } from '$lib/stores/auditionSettings';

	const lengthOptions = lengthsIn(chordLibrary);
	const registerOptions = ['C', 'D', 'E', 'F', 'G', 'A', 'B'].flatMap((name) =>
		[2, 3].map((octave) => `${name}${octave}`)
	);
	const bassOptions: { value: AudiateBass; label: string }[] = [
		{ value: 'off', label: 'Off' },
		{ value: 'roots', label: 'Chord roots' },
		{ value: 'tonic', label: 'Tonic' }
	];

	const initial = loadChordAuditionSettings();

	let selectedKey = $state<CircleRoot>(initial.selectedKey);
	let bpm = $state(initial.bpm);
	let beatsPerChord = $state(initial.beatsPerChord);
	let clickEnabled = $state(initial.clickEnabled);
	let clickVolume = $state(initial.clickVolume);
	let audiateBass = $state<AudiateBass>(initial.audiateBass);
	let bassRegister = $state(initial.bassRegister);
	let hideProgression = $state(initial.hideProgression);
	let length = $state(lengthOptions.includes(initial.length) ? initial.length : 4);
	let poolIdsByLength = $state<Partial<Record<number, string[]>>>({ ...initial.poolIdsByLength });
	let phaseSequence = $state<AuditionPhase[]>([...initial.phaseSequence]);
	let phaseSequenceText = $state(formatPhaseSequenceCompact(initial.phaseSequence));
	let phaseTextError = $state('');
	let selectedId = $state<string | null>(null);
	let announceDegreesListen = $state(initial.announceDegreesListen);
	let announceDegreesAudiate = $state(initial.announceDegreesAudiate);

	let sampler: Tone.Sampler | undefined;
	let clickSampler: Tone.Sampler | undefined;
	let voiceSampler: Tone.Sampler | undefined;
	let samplerLoaded = $state(false);
	let voiceSamplerLoaded = $state(false);
	let creatingAudio: Promise<void> | null = null;
	let playToken = 0;
	let disposed = false;

	let playing = $state(false);
	let playingId = $state<string | null>(null);
	let playheadIndex = $state<number | null>(null);
	let activePhase = $state<AuditionPhase | null>(null);
	let sessionProgression = $state<ChordProgression | null>(null);
	let playbackMessage = $state('');

	const visible = $derived(
		chordLibrary.progressions.filter((progression) => chordCount(progression.notation) === length)
	);
	const poolIds = $derived.by(() => {
		const ids = new Set(visible.map((progression) => progression.id));
		const saved = (poolIdsByLength[length] ?? []).filter((id) => ids.has(id));
		return saved.length > 0 ? saved : visible.map((progression) => progression.id);
	});
	const pool = $derived(visible.filter((progression) => poolIds.includes(progression.id)));
	const selected = $derived(
		visible.find((progression) => progression.id === selectedId) ?? visible[0] ?? null
	);
	const displayProgression = $derived(sessionProgression ?? selected);
	const scale = $derived(buildDiatonicScale(selectedKey, 'major'));
	const scaleSpelling = $derived(scale.map((note, index) => `${index + 1} ${note}`).join('   '));
	const displayParse = $derived(
		displayProgression ? parseProgression(displayProgression.notation, beatsPerChord) : null
	);
	const cells = $derived.by(() => {
		if (!displayParse?.ok || !displayProgression) return [];
		return displayParse.chords.map((chord, index) => {
			const names = diatonicDegreePreview(selectedKey, 'major', chord.degree);
			return {
				key: `${displayProgression.id}-${index}`,
				degree: chord.degree,
				roman: names.roman,
				symbol: names.triad,
				beats: chord.beats
			};
		});
	});
	const concealScore = $derived(hideProgression && activePhase === 'listen');

	$effect(() => {
		if (!browser) return;
		localStorage.setItem(
			CHORD_AUDITION_SETTINGS_KEY,
			JSON.stringify({
				selectedKey,
				bpm,
				beatsPerChord,
				clickEnabled,
				clickVolume,
				audiateBass,
				bassRegister,
				hideProgression,
				length,
				poolIdsByLength,
				phaseSequence,
				announceDegreesListen,
				announceDegreesAudiate
			})
		);
	});

	function shiftKey(delta: number) {
		const index = CIRCLE_OF_FIFTHS.indexOf(selectedKey);
		const start = index === -1 ? 0 : index;
		selectedKey =
			CIRCLE_OF_FIFTHS[(start + delta + CIRCLE_OF_FIFTHS.length) % CIRCLE_OF_FIFTHS.length];
	}

	function chooseLength(next: number) {
		if (next === length) return;
		stopPlayback();
		length = next;
		playbackMessage = '';
	}

	function togglePool(id: string) {
		const next = poolIds.includes(id)
			? poolIds.filter((poolId) => poolId !== id)
			: [...poolIds, id];
		const resolved = next.length > 0 ? next : visible.map((progression) => progression.id);
		poolIdsByLength = { ...poolIdsByLength, [length]: resolved };
	}

	function setPoolAll() {
		const next = { ...poolIdsByLength };
		delete next[length];
		poolIdsByLength = next;
	}

	function setPoolOne() {
		const id = visible[0]?.id;
		if (!id) return;
		poolIdsByLength = { ...poolIdsByLength, [length]: [id] };
	}

	function addPhase(phase: AuditionPhase) {
		phaseSequence = [...phaseSequence, phase];
		phaseSequenceText = formatPhaseSequenceCompact(phaseSequence);
		phaseTextError = '';
	}

	function removePhase(index: number) {
		if (phaseSequence.length <= 1) return;
		phaseSequence = phaseSequence.filter((_, item) => item !== index);
		phaseSequenceText = formatPhaseSequenceCompact(phaseSequence);
	}

	function movePhase(index: number, delta: -1 | 1) {
		const target = index + delta;
		if (target < 0 || target >= phaseSequence.length) return;
		const next = [...phaseSequence];
		[next[index], next[target]] = [next[target], next[index]];
		phaseSequence = next;
		phaseSequenceText = formatPhaseSequenceCompact(phaseSequence);
	}

	function applyPhaseSequenceText() {
		const parsed = parsePhaseSequenceText(phaseSequenceText);
		if (!parsed) {
			phaseTextError = 'Use L/A or listen/audiate, separated by spaces or dashes.';
			phaseSequenceText = formatPhaseSequenceCompact(phaseSequence);
			return;
		}
		phaseSequence = parsed;
		phaseSequenceText = formatPhaseSequenceCompact(parsed);
		phaseTextError = '';
	}

	function setPhasePreset(sequence: AuditionPhase[]) {
		phaseSequence = [...sequence];
		phaseSequenceText = formatPhaseSequenceCompact(sequence);
		phaseTextError = '';
	}

	function volumeToDb(volume: number): number {
		if (volume <= 0) return -Infinity;
		return Tone.gainToDb(volume);
	}

	function createSamplers() {
		sampler = new Tone.Sampler({
			urls: { C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3' },
			release: 0.6,
			baseUrl: 'https://tonejs.github.io/audio/salamander/',
			onload: () => {
				samplerLoaded = true;
			}
		}).toDestination();
		sampler.volume.value = -4;

		clickSampler = new Tone.Sampler({
			urls: { C4: '/sounds/Click.wav' }
		}).toDestination();

		voiceSampler = createDegreeVoiceSampler(() => {
			voiceSamplerLoaded = true;
		});
	}

	async function initAudio() {
		await Tone.start();
		if (sampler && clickSampler && voiceSampler) return;
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
		while ((!samplerLoaded || !voiceSamplerLoaded) && Date.now() - started < 10000) {
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
		playing = false;
		playingId = null;
		playheadIndex = null;
		activePhase = null;
		sessionProgression = null;
	}

	type ScheduleContext = {
		token: number;
		transport: ReturnType<typeof Tone.getTransport>;
		secPerBeat: number;
		scheduleAt: (offsetSec: number, run: (audioTime: number) => void) => void;
	};

	function progressionSeconds(progression: ChordProgression, secPerBeat: number): number {
		const parsed = parseProgression(progression.notation, beatsPerChord);
		return parsed.ok ? parsed.beats * secPerBeat : 0;
	}

	function pickProgression(avoidId?: string | null): ChordProgression | null {
		if (pool.length === 0) return null;
		if (pool.length === 1) return pool[0];
		const candidates = pool.filter((progression) => progression.id !== avoidId);
		const pickFrom = candidates.length > 0 ? candidates : pool;
		return pickFrom[Math.floor(Math.random() * pickFrom.length)] ?? null;
	}

	function scheduleClicks(ctx: ScheduleContext, startSec: number, totalBeats: number) {
		if (!clickEnabled || !clickSampler) return;
		for (let beat = 0; beat < totalBeats - 1e-6; beat += 1) {
			const when = startSec + beat * ctx.secPerBeat;
			ctx.scheduleAt(when, (audioTime) => {
				clickSampler?.triggerAttackRelease('C4', '16n', audioTime);
			});
		}
	}

	function schedulePhase(
		ctx: ScheduleContext,
		progression: ChordProgression,
		startSec: number,
		phase: AuditionPhase
	): boolean {
		const parsed = parseProgression(progression.notation, beatsPerChord);
		if (!parsed.ok) return false;
		const voiced = voiceProgression(scale, parsed.chords, bassRegister);
		if (voiced.length !== parsed.chords.length) return false;

		const tonic = voiceProgression(scale, [{ degree: 1, beats: 1 }], bassRegister)[0]?.bass;
		let beat = 0;
		for (let index = 0; index < voiced.length; index++) {
			const chord = voiced[index]!;
			const when = startSec + beat * ctx.secPerBeat;
			const duration = Math.max(0.05, chord.beats * ctx.secPerBeat * 0.92);
			const notes: string[] = [];
			const addPitch = (pitch: string) => {
				if (!notes.includes(pitch)) notes.push(pitch);
			};
			if (phase === 'listen') {
				addPitch(chord.bass);
				for (const note of chord.upper) addPitch(note);
			} else if (audiateBass === 'roots') {
				addPitch(chord.bass);
			} else if (audiateBass === 'tonic' && tonic) {
				addPitch(tonic);
			}
			if (notes.length > 0) {
				ctx.scheduleAt(when, (audioTime) => {
					for (const pitch of notes) sampler?.triggerAttackRelease(pitch, duration, audioTime);
				});
			}
			const announce =
				phase === 'listen' ? announceDegreesListen : announceDegreesAudiate;
			if (announce) {
				ctx.scheduleAt(when, (audioTime) => {
					triggerDegreeVoice(voiceSampler, chord.degree, audioTime);
				});
			}
			const chordIndex = index;
			ctx.scheduleAt(when, (audioTime) => {
				Tone.getDraw().schedule(() => {
					if (ctx.token !== playToken) return;
					activePhase = phase;
					sessionProgression = progression;
					playingId = progression.id;
					selectedId = progression.id;
					playheadIndex = chordIndex;
				}, audioTime);
			});
			beat += chord.beats;
		}

		scheduleClicks(ctx, startSec, parsed.beats);
		return true;
	}

	type PracticeScheduleState = {
		scheduledUntilSec: number;
		lastListenId: string | null;
	};

	const PRACTICE_LOOKAHEAD = 4;

	function schedulePracticeCycle(
		ctx: ScheduleContext,
		startSec: number,
		avoidId?: string | null
	): { endSec: number; lastListenId: string | null } | null {
		let offsetSec = startSec;
		let carry: ChordProgression | null = null;
		let lastListenId = avoidId ?? null;

		for (const phase of phaseSequence) {
			if (phase === 'listen') {
				const progression = carry ?? pickProgression(lastListenId);
				if (!progression) return null;
				if (!schedulePhase(ctx, progression, offsetSec, 'listen')) {
					if (startSec === 0) playbackMessage = `${progression.name} could not be played.`;
					return null;
				}
				carry = progression;
			} else {
				if (!carry) return null;
				if (!schedulePhase(ctx, carry, offsetSec, 'audiate')) {
					if (startSec === 0) playbackMessage = `${carry.name} could not be played.`;
					return null;
				}
			}
			offsetSec += progressionSeconds(carry, ctx.secPerBeat);
		}

		return { endSec: offsetSec, lastListenId: carry?.id ?? lastListenId };
	}

	function extendPracticeSchedule(
		ctx: ScheduleContext,
		state: PracticeScheduleState,
		minUntilSec: number
	): boolean {
		while (state.scheduledUntilSec + 1e-6 < minUntilSec) {
			const result = schedulePracticeCycle(ctx, state.scheduledUntilSec, state.lastListenId);
			if (!result) return false;
			state.lastListenId = result.lastListenId;
			state.scheduledUntilSec = result.endSec;
		}
		return true;
	}

	function schedulePracticeTopUp(
		ctx: ScheduleContext,
		token: number,
		state: PracticeScheduleState
	) {
		const lead = Math.max(4, phaseSequence.length * beatsPerChord * length * ctx.secPerBeat);
		const triggerAt = Math.max(0, state.scheduledUntilSec - lead);
		ctx.scheduleAt(triggerAt, () => {
			if (token !== playToken) return;
			const horizon = ctx.transport.seconds + lead * PRACTICE_LOOKAHEAD;
			if (!extendPracticeSchedule(ctx, state, horizon)) return;
			schedulePracticeTopUp(ctx, token, state);
		});
	}

	async function ensureAudioReady(): Promise<boolean> {
		playbackMessage = '';
		await initAudio();
		await waitUntilLoaded();
		if (disposed) return false;
		if (!sampler || !samplerLoaded) {
			playbackMessage = 'Piano sounds are still loading.';
			return false;
		}
		if (clickSampler) clickSampler.volume.value = volumeToDb(clickVolume);
		return true;
	}

	function makeScheduleContext(token: number): ScheduleContext {
		const transport = Tone.getTransport();
		transport.bpm.value = bpm;
		const secPerBeat = 60 / bpm;
		return {
			token,
			transport,
			secPerBeat,
			scheduleAt: (offsetSec, run) => {
				transport.schedule((audioTime) => {
					if (token !== playToken) return;
					run(audioTime);
				}, offsetSec);
			}
		};
	}

	async function startPractice() {
		if (phaseSequence.length === 0) {
			playbackMessage = 'Add at least one phase to the practice sequence.';
			return;
		}
		if (!(await ensureAudioReady())) return;

		stopPlayback();
		const token = playToken;
		const ctx = makeScheduleContext(token);
		ctx.transport.position = 0;

		const scheduleState: PracticeScheduleState = {
			scheduledUntilSec: 0,
			lastListenId: playingId
		};
		const lead = Math.max(4, phaseSequence.length * beatsPerChord * length * ctx.secPerBeat);
		if (!extendPracticeSchedule(ctx, scheduleState, lead * PRACTICE_LOOKAHEAD)) {
			playbackMessage = 'Select at least one progression in the pool.';
			stopPlayback();
			return;
		}
		schedulePracticeTopUp(ctx, token, scheduleState);

		playing = true;
		ctx.transport.start(Tone.now() + 0.05);
	}

	async function previewSelected() {
		if (!selected) return;
		const parsed = parseProgression(selected.notation, beatsPerChord);
		if (!parsed.ok) {
			playbackMessage = parsed.error ?? 'This progression cannot be played.';
			return;
		}
		if (!(await ensureAudioReady())) return;

		stopPlayback();
		const token = playToken;
		const ctx = makeScheduleContext(token);
		ctx.transport.position = 0;
		if (!schedulePhase(ctx, selected, 0, 'listen')) {
			playbackMessage = 'Could not schedule this progression.';
			return;
		}
		const endSec = progressionSeconds(selected, ctx.secPerBeat);
		ctx.scheduleAt(endSec, (audioTime) => {
			Tone.getDraw().schedule(() => {
				if (token !== playToken) return;
				ctx.transport.stop();
				ctx.transport.position = 0;
				playing = false;
				playingId = null;
				playheadIndex = null;
				activePhase = null;
				sessionProgression = null;
			}, audioTime);
		});
		playing = true;
		activePhase = 'listen';
		sessionProgression = selected;
		playingId = selected.id;
		ctx.transport.start(Tone.now() + 0.08);
	}

	function togglePractice() {
		if (playing) stopPlayback();
		else void startPractice();
	}

	function onWindowKey(event: KeyboardEvent) {
		const target = event.target as HTMLElement | null;
		const tag = target?.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable)
			return;
		if (event.key === ' ') {
			event.preventDefault();
			togglePractice();
		}
	}

	onMount(() => {
		void initAudio().catch(() => {
			playbackMessage = 'Click Practice to start audio.';
		});
	});

	onDestroy(() => {
		disposed = true;
		stopPlayback();
		sampler?.dispose();
		clickSampler?.dispose();
		voiceSampler?.dispose();
	});
</script>

<svelte:head>
	<title>Chord audition</title>
</svelte:head>

<svelte:window onkeydown={onWindowKey} />

<div class="mx-auto flex w-full max-w-5xl flex-col px-4 py-6">
	<div class="mb-4">
		<h1 class="text-3xl font-bold">Chord audition</h1>
		<p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
			Diatonic progressions in a major key. Listen to the chords, then audiate them.
			{visible.length} in the {length}-chord set.
		</p>
	</div>

	<div class="mb-4 flex flex-wrap gap-2">
		{#each lengthOptions as count (count)}
			<button
				type="button"
				class={[
					'rounded-full border px-4 py-1.5 text-sm font-semibold',
					length === count
						? 'border-blue-600 bg-blue-600 text-white'
						: 'border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800'
				]}
				onclick={() => chooseLength(count)}
			>
				{count} chord{count === 1 ? '' : 's'}
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
					{#each CIRCLE_OF_FIFTHS as key (key)}
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
		<div class="mt-3 flex flex-wrap items-center gap-2 text-sm">
			<span>Beats per chord</span>
			{#each BEATS_PER_CHORD_OPTIONS as beats (beats)}
				<button
					type="button"
					class={[
						'rounded border px-2 py-1',
						beatsPerChord === beats
							? 'border-blue-600 bg-blue-600 text-white'
							: 'border-gray-300 dark:border-gray-600'
					]}
					onclick={() => (beatsPerChord = beats)}
				>
					{beats}
				</button>
			{/each}
		</div>
		<p class="mt-3 font-mono text-xs text-gray-600 dark:text-gray-300">{scaleSpelling}</p>
		<p class="mt-2 text-xs text-gray-500">{chordLibrary.notationHelp}</p>

		<div class="mt-4 rounded-lg bg-amber-50 p-3 dark:bg-amber-950/40">
			<p class="text-sm font-medium">Audiate bass</p>
			<p class="mt-1 text-xs text-gray-600 dark:text-gray-300">
				Listen always plays the full triad. This only changes the audiate phase.
			</p>
			<div class="mt-3 flex flex-wrap gap-2">
				{#each bassOptions as option (option.value)}
					<button
						type="button"
						class={[
							'rounded border px-2 py-1 text-sm',
							audiateBass === option.value
								? 'border-amber-600 bg-amber-500 text-black'
								: 'border-gray-300 dark:border-gray-600'
						]}
						onclick={() => (audiateBass = option.value)}
					>
						{option.label}
					</button>
				{/each}
			</div>
			<label class="mt-3 flex items-center gap-2 text-sm">
				Bass register
				<select
					bind:value={bassRegister}
					class="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900"
				>
					{#each registerOptions as register (register)}
						<option value={register}>{register}</option>
					{/each}
				</select>
			</label>
		</div>
	</details>

	<details class="mb-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700" open>
		<summary class="cursor-pointer text-sm font-semibold">
			Practice phases · {formatPhaseSequence(phaseSequence)}
		</summary>
		<div class="mt-3 flex flex-wrap gap-2">
			{#each phaseSequence as phase, index (index)}
				<div
					class={[
						'flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-bold',
						phase === 'listen'
							? 'border-emerald-600 bg-emerald-600 text-white'
							: 'border-violet-600 bg-violet-600 text-white'
					]}
				>
					<span>{phase === 'listen' ? 'Listen' : 'Audiate'}</span>
					<button
						type="button"
						class="rounded px-1 opacity-80 hover:opacity-100"
						disabled={index === 0}
						onclick={() => movePhase(index, -1)}
					>
						↑
					</button>
					<button
						type="button"
						class="rounded px-1 opacity-80 hover:opacity-100"
						disabled={index === phaseSequence.length - 1}
						onclick={() => movePhase(index, 1)}
					>
						↓
					</button>
					<button
						type="button"
						class="rounded px-1 opacity-80 hover:opacity-100"
						disabled={phaseSequence.length <= 1}
						onclick={() => removePhase(index)}
					>
						×
					</button>
				</div>
			{/each}
		</div>
		<div class="mt-3 flex flex-wrap gap-2">
			<button
				type="button"
				class="rounded border border-emerald-600 px-3 py-1 text-sm font-medium dark:border-emerald-500"
				onclick={() => addPhase('listen')}
			>
				+ Listen
			</button>
			<button
				type="button"
				class="rounded border border-violet-600 px-3 py-1 text-sm font-medium dark:border-violet-500"
				onclick={() => addPhase('audiate')}
			>
				+ Audiate
			</button>
			<button
				type="button"
				class="rounded border px-2 py-1 text-xs dark:border-gray-600"
				onclick={() => setPhasePreset(['listen', 'audiate'])}
			>
				L → A
			</button>
			<button
				type="button"
				class="rounded border px-2 py-1 text-xs dark:border-gray-600"
				onclick={() => setPhasePreset(['listen', 'audiate', 'listen', 'audiate'])}
			>
				L-A-L-A
			</button>
		</div>
		<label class="mt-3 flex min-w-48 flex-col gap-1 text-xs text-gray-500">
			Sequence text (L / A, spaces or dashes)
			<input
				class="rounded border border-gray-300 bg-white px-2 py-1 font-mono text-sm dark:border-gray-600 dark:bg-gray-900"
				bind:value={phaseSequenceText}
				onchange={applyPhaseSequenceText}
				onkeydown={(event) => {
					if (event.key === 'Enter') applyPhaseSequenceText();
				}}
			/>
		</label>
		{#if phaseTextError}
			<p class="mt-2 text-sm text-red-600 dark:text-red-400">{phaseTextError}</p>
		{/if}
		<p class="mt-2 text-xs text-gray-500">
			Listen plays each triad. Audiate keeps the click and the bass you chose so you can hear the
			changes in your head.
		</p>
		<div class="mt-3 flex flex-wrap gap-4 text-sm">
			<label class="flex items-center gap-2">
				<input type="checkbox" bind:checked={announceDegreesListen} class="accent-emerald-500" />
				Announce degrees on Listen
			</label>
			<label class="flex items-center gap-2">
				<input type="checkbox" bind:checked={announceDegreesAudiate} class="accent-violet-500" />
				Announce degrees on Audiate
			</label>
		</div>
	</details>

	<div class="mb-4 flex flex-wrap items-center gap-2">
		<button
			type="button"
			class="rounded bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
			disabled={pool.length === 0 || phaseSequence.length === 0}
			onclick={togglePractice}
		>
			{playing ? 'Stop' : 'Practice'}
		</button>
		<button
			type="button"
			class="rounded border border-gray-300 px-4 py-2.5 text-sm font-semibold dark:border-gray-600"
			disabled={!selected}
			onclick={() => void previewSelected()}
		>
			Play selected
		</button>
		<label class="flex items-center gap-2 text-sm">
			<input type="checkbox" bind:checked={hideProgression} class="accent-blue-500" />
			Hide progression
		</label>
	</div>

	<div class="mb-4 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
		<div class="mb-2 flex flex-wrap items-center justify-between gap-2">
			<span class="text-sm font-semibold">
				Random pool · {pool.length} / {visible.length} selected
			</span>
			<div class="flex gap-2">
				<button
					type="button"
					class="rounded border px-2 py-1 text-xs dark:border-gray-600"
					onclick={setPoolAll}
				>
					All
				</button>
				<button
					type="button"
					class="rounded border px-2 py-1 text-xs dark:border-gray-600"
					onclick={setPoolOne}
				>
					One only
				</button>
			</div>
		</div>
		<p class="text-sm text-gray-600 dark:text-gray-300">
			{#if pool.length === 1}
				One progression selected — it repeats every Listen step.
			{:else}
				Each Listen step picks a random progression from the checked pool.
			{/if}
		</p>
	</div>

	{#if displayProgression && displayParse?.ok}
		<div class="mb-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
			<div class="mb-3">
				{#if activePhase === 'audiate'}
					<p
						class="text-xs font-semibold tracking-wide text-violet-600 uppercase dark:text-violet-300"
					>
						Audiate
					</p>
				{:else if activePhase === 'listen'}
					<p
						class="text-xs font-semibold tracking-wide text-emerald-600 uppercase dark:text-emerald-300"
					>
						Listen
					</p>
				{/if}
				<h2 class="text-xl font-semibold">
					{concealScore ? 'Listening' : displayProgression.name}
				</h2>
				{#if !concealScore}
					<p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
						{displayProgression.skill}
					</p>
					<p class="mt-1 font-mono text-sm text-gray-600 dark:text-gray-300">
						{displayProgression.notation}
					</p>
				{/if}
			</div>
			<ProgressionGrid {cells} activeIndex={playheadIndex} conceal={concealScore} />
		</div>
	{:else if displayParse && !displayParse.ok}
		<p class="mb-4 text-sm text-red-600">{displayParse.error}</p>
	{/if}

	{#if playbackMessage}
		<p class="mb-3 text-sm text-amber-700 dark:text-amber-300">{playbackMessage}</p>
	{/if}
	{#if !samplerLoaded}
		<p class="mb-3 text-xs text-gray-500">Loading piano sounds…</p>
	{/if}

	<ul class="grid gap-2 sm:grid-cols-2">
		{#each visible as progression (progression.id)}
			<li>
				<div
					class={[
						'flex w-full items-stretch overflow-hidden rounded-lg border',
						progression.id === displayProgression?.id
							? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40'
							: 'border-gray-200 dark:border-gray-700'
					]}
				>
					<label
						class="flex cursor-pointer items-center border-r border-gray-200 px-3 dark:border-gray-700"
					>
						<input
							type="checkbox"
							class="accent-blue-500"
							checked={poolIds.includes(progression.id)}
							onchange={() => togglePool(progression.id)}
							aria-label={`Include ${progression.name} in the random pool`}
						/>
					</label>
					<button
						type="button"
						class="min-w-0 flex-1 px-3 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
						onclick={() => {
							selectedId = progression.id;
							if (!playing) sessionProgression = null;
						}}
					>
						<span class="flex items-center justify-between gap-2">
							<span class="font-semibold">{progression.name}</span>
							{#if playingId === progression.id}
								<span class="text-xs font-medium text-emerald-600">
									{activePhase === 'audiate' ? 'Audiate' : 'Playing'}
								</span>
							{/if}
						</span>
						{#if !hideProgression}
							<span class="mt-1 block truncate font-mono text-xs text-gray-500">
								{progression.notation}
							</span>
							<span class="mt-0.5 block truncate text-xs text-gray-500">{progression.skill}</span>
						{/if}
					</button>
				</div>
			</li>
		{/each}
	</ul>
	<p class="mt-4 text-xs text-gray-500">
		Degrees are diatonic triads: 6–4–5–1 is vi–IV–V–I. Space toggles practice.
	</p>
</div>
