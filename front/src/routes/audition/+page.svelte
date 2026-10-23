<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
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
	import {
		formatPhaseSequence,
		formatPhaseSequenceCompact,
		parsePhaseSequenceText
	} from '$lib/audition/phases';
	import {
		AUDITION_SETTINGS_KEY,
		loadAuditionSettings,
		type AuditionPhase
	} from '$lib/stores/auditionSettings';

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
	let hideMelody = $state(initial.hideMelody);
	let poolIdsByBars = $state<Record<BarCount, string[]>>({
		1: initialPoolIds(1, bundledLibraries[1].melodies, initial.poolMelodyIds),
		2: initialPoolIds(2, bundledLibraries[2].melodies, initial.poolMelodyIds),
		3: initialPoolIds(3, bundledLibraries[3].melodies, initial.poolMelodyIds),
		4: initialPoolIds(4, bundledLibraries[4].melodies, initial.poolMelodyIds)
	});
	let phaseSequence = $state<AuditionPhase[]>([...initial.phaseSequence]);
	let phaseSequenceText = $state(formatPhaseSequenceCompact(initial.phaseSequence));
	let phaseTextError = $state('');

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
	let activePhase = $state<AuditionPhase | null>(null);
	let sessionMelody = $state<AuditionMelody | null>(null);
	let playbackMessage = $state('');
	let saving = $state(false);
	let saveMessage = $state('');

	function initialPoolIds(
		bars: BarCount,
		melodies: AuditionMelody[],
		saved: Partial<Record<BarCount, string[]>>
	): string[] {
		const ids = new Set(melodies.map((m) => m.id));
		const fromSaved = saved[bars]?.filter((id) => ids.has(id)) ?? [];
		return fromSaved.length > 0 ? fromSaved : melodies.map((m) => m.id);
	}

	function sameIdList(a: string[], b: string[]): boolean {
		return a.length === b.length && a.every((id, index) => id === b[index]);
	}

	function syncPoolWithLibrary(bars: BarCount) {
		const ids = new Set(libraries[bars].melodies.map((m) => m.id));
		const kept = poolIdsByBars[bars].filter((id) => ids.has(id));
		const next =
			kept.length > 0 ? kept : libraries[bars].melodies.map((m) => m.id);
		if (sameIdList(poolIdsByBars[bars], next)) return;
		poolIdsByBars[bars] = next;
	}

	const activeLibrary = $derived(libraries[barCount]);
	const poolIds = $derived(poolIdsByBars[barCount]);
	const poolSet = $derived(new Set(poolIds));
	const poolMelodies = $derived(activeLibrary.melodies.filter((melody) => poolSet.has(melody.id)));
	const activeMelody = $derived(
		activeLibrary.melodies.find((melody) => melody.id === selectedByBars[barCount]) ??
			activeLibrary.melodies[0] ??
			null
	);
	const displayMelody = $derived(sessionMelody ?? activeMelody);
	const activeParse = $derived(
		displayMelody ? parseNotation(displayMelody.notation, barCount) : null
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
				hideMelody,
				barCount,
				poolMelodyIds: poolIdsByBars,
				phaseSequence
			})
		);
	});

	$effect(() => {
		const bars = barCount;
		const catalogKey = libraries[bars].melodies.map((m) => m.id).join('\0');
		void catalogKey;
		untrack(() => syncPoolWithLibrary(bars));
	});

	function beatSeconds(): number {
		return 60 / bpm;
	}

	function phaseDurationSeconds(): number {
		return expectedBeats(barCount) * beatSeconds();
	}

	function pickMelodyFromPool(avoidId?: string | null): AuditionMelody | null {
		const all = activeLibrary.melodies;
		if (all.length === 0) return null;
		const pool = poolMelodies.length > 0 ? poolMelodies : all;
		if (pool.length === 0) return null;
		if (pool.length === 1) return pool[0];
		const lastId = avoidId ?? playingId;
		const candidates = pool.filter((m) => m.id !== lastId);
		const pickFrom = candidates.length > 0 ? candidates : pool;
		return pickFrom[Math.floor(Math.random() * pickFrom.length)] ?? null;
	}

	function togglePractice() {
		if (playing) stopPlayback();
		else void startPractice();
	}

	function togglePoolMelody(id: string) {
		if (poolSet.has(id)) {
			const next = poolIds.filter((poolId) => poolId !== id);
			const resolved =
				next.length > 0 ? next : activeLibrary.melodies.map((m) => m.id);
			if (!sameIdList(poolIds, resolved)) poolIdsByBars[barCount] = resolved;
		} else {
			const next = [...poolIds, id];
			if (!sameIdList(poolIds, next)) poolIdsByBars[barCount] = next;
		}
	}

	function setPoolAll() {
		poolIdsByBars[barCount] = activeLibrary.melodies.map((m) => m.id);
	}

	function setPoolNone() {
		if (activeLibrary.melodies.length === 0) return;
		poolIdsByBars[barCount] = [activeLibrary.melodies[0].id];
	}

	function addPhase(phase: AuditionPhase) {
		phaseSequence = [...phaseSequence, phase];
		phaseSequenceText = formatPhaseSequenceCompact(phaseSequence);
		phaseTextError = '';
	}

	function removePhase(index: number) {
		if (phaseSequence.length <= 1) return;
		phaseSequence = phaseSequence.filter((_, i) => i !== index);
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
		activePhase = null;
		sessionMelody = null;
	}

	type ScheduleContext = {
		token: number;
		transport: ReturnType<typeof Tone.getTransport>;
		scheduleAt: (offsetSec: number, run: (audioTime: number) => void) => void;
		totalBeats: number;
		secPerBeat: number;
	};

	function scheduleBassAt(
		ctx: ScheduleContext,
		startSec: number,
		durationSec: number,
		mode: 'sustain' | 'perBar'
	) {
		if (!bassEnabled || !droneSampler) return;
		const pitch = getBassPitch();
		if (mode === 'sustain') {
			ctx.scheduleAt(startSec, (audioTime) => {
				droneSampler?.triggerAttackRelease(pitch, durationSec * 0.98, audioTime);
			});
			return;
		}
		for (let bar = 0; bar < barCount; bar++) {
			const barStart = startSec + bar * 4 * ctx.secPerBeat;
			ctx.scheduleAt(barStart, (audioTime) => {
				droneSampler?.triggerAttackRelease(pitch, 4 * ctx.secPerBeat * 0.92, audioTime);
			});
		}
	}

	function scheduleClicksAt(ctx: ScheduleContext, startSec: number) {
		if (!clickEnabled || !clickSampler) return;
		for (let beat = 0; beat < ctx.totalBeats; beat++) {
			const when = startSec + beat * ctx.secPerBeat;
			ctx.scheduleAt(when, (audioTime) => {
				clickSampler?.triggerAttackRelease('C4', '16n', audioTime);
			});
		}
	}

	function scheduleListenPhase(
		ctx: ScheduleContext,
		melody: AuditionMelody,
		startSec: number,
		phase: AuditionPhase
	): boolean {
		const parsed = parseNotation(melody.notation, barCount);
		if (!parsed.ok) return false;

		const bassMode = bassSustain ? 'sustain' : 'perBar';
		scheduleBassAt(ctx, startSec, phaseDurationSeconds(), bassMode);
		scheduleClicksAt(ctx, startSec);

		ctx.scheduleAt(startSec, (audioTime) => {
			Tone.getDraw().schedule(() => {
				if (ctx.token !== playToken) return;
				activePhase = phase;
				sessionMelody = melody;
				playingId = melody.id;
				selectedByBars[barCount] = melody.id;
				playheadBeat = 0;
			}, audioTime);
		});

		let cursor = 0;
		for (const note of parsed.notes) {
			const when = startSec + cursor * ctx.secPerBeat;
			const noteBeat = cursor;
			if (note.degree) {
				const pitch = melodyPitch(note.degree, note.octave);
				const duration = Math.max(0.05, note.beats * ctx.secPerBeat * 0.9);
				ctx.scheduleAt(when, (audioTime) => {
					sampler?.triggerAttackRelease(pitch, duration, audioTime);
				});
			}
			ctx.scheduleAt(when, (audioTime) => {
				Tone.getDraw().schedule(() => {
					if (ctx.token !== playToken) return;
					playheadBeat = noteBeat;
				}, audioTime);
			});
			cursor += note.beats;
		}

		const endSec = startSec + phaseDurationSeconds();
		ctx.scheduleAt(endSec, (audioTime) => {
			Tone.getDraw().schedule(() => {
				if (ctx.token !== playToken) return;
				playheadBeat = null;
			}, audioTime);
		});
		return true;
	}

	function scheduleAudiatePhase(
		ctx: ScheduleContext,
		startSec: number,
		melody: AuditionMelody | null
	) {
		scheduleBassAt(ctx, startSec, phaseDurationSeconds(), 'perBar');
		scheduleClicksAt(ctx, startSec);

		ctx.scheduleAt(startSec, (audioTime) => {
			Tone.getDraw().schedule(() => {
				if (ctx.token !== playToken) return;
				activePhase = 'audiate';
				if (melody) {
					sessionMelody = melody;
					playingId = melody.id;
				}
				playheadBeat = null;
			}, audioTime);
		});
	}

	function finishPreviewPlayback(token: number) {
		if (token !== playToken) return;
		playing = false;
		playingId = null;
		playheadBeat = null;
		activePhase = null;
		sessionMelody = null;
	}

	type PracticeCycleSchedule = { endSec: number; lastListenId: string | null };

	type PracticeScheduleState = {
		scheduledUntilSec: number;
		lastListenId: string | null;
	};

	const PRACTICE_LOOKAHEAD_CYCLES = 4;
	const PRACTICE_TOP_UP_LEAD_CYCLES = 2;

	function sessionCycleDurationSec(): number {
		return phaseSequence.length * phaseDurationSeconds();
	}

	/** Schedule one full phase sequence; returns end time on the transport timeline. */
	function schedulePracticeCycle(
		ctx: ScheduleContext,
		startSec: number,
		avoidMelodyId?: string | null
	): PracticeCycleSchedule | null {
		let offsetSec = startSec;
		let carryMelody: AuditionMelody | null = null;
		let lastListenId: string | null = avoidMelodyId ?? null;

		for (const phase of phaseSequence) {
			if (phase === 'listen') {
				const melody = pickMelodyFromPool(lastListenId);
				if (!melody) return null;
				if (!scheduleListenPhase(ctx, melody, offsetSec, 'listen')) {
					if (startSec === 0) {
						playbackMessage = `${melody.name} is invalid for this bar length.`;
					}
					return null;
				}
				carryMelody = melody;
				lastListenId = melody.id;
			} else {
				scheduleAudiatePhase(ctx, offsetSec, carryMelody);
			}
			offsetSec += phaseDurationSeconds();
		}

		return { endSec: offsetSec, lastListenId };
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

	/** Top up cycles on the timeline tail so new Listen steps are never scheduled in the past. */
	function schedulePracticeTopUp(
		ctx: ScheduleContext,
		token: number,
		state: PracticeScheduleState
	) {
		const cycleSec = sessionCycleDurationSec();
		const triggerAt = Math.max(0, state.scheduledUntilSec - cycleSec * PRACTICE_TOP_UP_LEAD_CYCLES);

		ctx.scheduleAt(triggerAt, () => {
			if (token !== playToken) return;
			const horizon = ctx.transport.seconds + cycleSec * PRACTICE_LOOKAHEAD_CYCLES;
			if (!extendPracticeSchedule(ctx, state, horizon)) return;
			schedulePracticeTopUp(ctx, token, state);
		});
	}

	async function ensureAudioReady(): Promise<boolean> {
		playbackMessage = '';
		await initAudio();
		await waitUntilLoaded();
		if (disposed) return false;
		if (!sampler || !droneSampler || !samplerLoaded || !droneSamplerLoaded) {
			playbackMessage = 'Piano sounds are still loading.';
			return false;
		}
		if (clickSampler) clickSampler.volume.value = volumeToDb(clickVolume);
		droneSampler.volume.value = volumeToDb(droneVolume);
		return true;
	}

	function makeScheduleContext(token: number): ScheduleContext {
		const transport = Tone.getTransport();
		transport.bpm.value = bpm;
		return {
			token,
			transport,
			totalBeats: expectedBeats(barCount),
			secPerBeat: beatSeconds(),
			scheduleAt: (offsetSec, run) => {
				transport.schedule((audioTime) => {
					if (token !== playToken) return;
					run(audioTime);
				}, offsetSec);
			}
		};
	}

	async function startPlayback(melody: AuditionMelody) {
		const parsed = parseNotation(melody.notation, barCount);
		if (!parsed.ok) {
			playbackMessage = parsed.error ?? 'This melody needs a valid length before it can play.';
			return;
		}
		if (!(await ensureAudioReady())) return;

		stopPlayback();
		const token = playToken;
		const ctx = makeScheduleContext(token);
		ctx.transport.position = 0;

		if (!scheduleListenPhase(ctx, melody, 0, 'listen')) {
			playbackMessage = 'Could not schedule this melody.';
			return;
		}

		const endSec = phaseDurationSeconds();
		ctx.scheduleAt(endSec, (audioTime) => {
			Tone.getDraw().schedule(() => {
				if (token !== playToken) return;
				ctx.transport.stop();
				ctx.transport.position = 0;
				finishPreviewPlayback(token);
			}, audioTime);
		});

		playing = true;
		activePhase = 'listen';
		sessionMelody = melody;
		playingId = melody.id;
		selectedByBars[barCount] = melody.id;
		ctx.transport.start(Tone.now() + 0.08);
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
		const cycleSec = sessionCycleDurationSec();
		if (!extendPracticeSchedule(ctx, scheduleState, cycleSec * PRACTICE_LOOKAHEAD_CYCLES)) {
			if (scheduleState.scheduledUntilSec === 0) {
				playbackMessage = 'Select at least one valid melody in the pool.';
			}
			stopPlayback();
			return;
		}
		schedulePracticeTopUp(ctx, token, scheduleState);

		playing = true;
		ctx.transport.start(Tone.now() + 0.05);
	}

	function previewMelody() {
		if (activeMelody) void startPlayback(activeMelody);
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
			togglePractice();
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
				<button
					type="button"
					class="rounded border px-2 py-1 text-xs dark:border-gray-600"
					onclick={() => setPhasePreset(['listen', 'audiate', 'audiate', 'listen'])}
				>
					L-A-A-L
				</button>
			</div>
			<div class="mt-3 flex flex-wrap items-end gap-2">
				<label class="flex min-w-48 flex-1 flex-col gap-1 text-xs text-gray-500">
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
			</div>
			{#if phaseTextError}
				<p class="mt-2 text-sm text-red-600 dark:text-red-400">{phaseTextError}</p>
			{/if}
			<p class="mt-2 text-xs text-gray-500">
				Listen plays the melody with bass. Audiate is silent melody time with the tonic in the bass
				again so you can sing or audiate.
			</p>
		</details>

		<div class="mb-4 flex flex-wrap items-center gap-2">
			<button
				type="button"
				class="rounded bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
				disabled={poolMelodies.length === 0 || phaseSequence.length === 0}
				onclick={togglePractice}
			>
				{playing ? 'Stop' : 'Practice'}
			</button>
			<label class="flex items-center gap-2 text-sm">
				<input type="checkbox" bind:checked={hideMelody} class="accent-blue-500" />
				Hide melody
			</label>
		</div>

		<div class="mb-4 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
			<div class="mb-2 flex flex-wrap items-center justify-between gap-2">
				<span class="text-sm font-semibold">
					Random pool · {poolMelodies.length} / {activeLibrary.melodies.length} selected
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
						onclick={setPoolNone}
					>
						One only
					</button>
				</div>
			</div>
			<p class="text-sm text-gray-600 dark:text-gray-300">
				{#if poolMelodies.length === 1}
					One exercise selected — it repeats every Listen step.
				{:else}
					Each Listen step picks a random melody from the checked pool.
				{/if}
			</p>
		</div>

		{#if displayMelody}
			<div class="mb-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
				<div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
					<div>
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
							{hideMelody && activePhase !== 'audiate' ? 'Listening' : displayMelody.name}
						</h2>
					</div>
					{#if !hideMelody && activePhase === 'listen' && playheadLabel}
						<p class="text-2xl font-bold tabular-nums">{playheadLabel}</p>
					{/if}
				</div>
				{#if !hideMelody || activePhase === 'audiate'}
					<p class="mb-3 font-mono text-sm text-gray-600 dark:text-gray-300">
						{activePhase === 'audiate' ? 'Sing or audiate — tonic only.' : displayMelody.notation}
					</p>
				{/if}
				{#if activeParse?.ok}
					<MelodyGrid
						notes={activeParse.notes}
						expectedBeats={expectedBeats(barCount)}
						totalBeats={expectedBeats(barCount)}
						{playheadBeat}
						conceal={hideMelody || activePhase === 'audiate'}
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
					<div
						class={[
							'flex w-full items-stretch overflow-hidden rounded-lg border',
							melody.id === displayMelody?.id
								? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40'
								: 'border-gray-200 dark:border-gray-700'
						]}
					>
						<label
							class="flex cursor-pointer items-center border-r border-gray-200 px-3 dark:border-gray-700"
							title="Include in random pool"
						>
							<input
								type="checkbox"
								class="accent-blue-500"
								checked={poolSet.has(melody.id)}
								onchange={() => togglePoolMelody(melody.id)}
							/>
						</label>
						<button
							type="button"
							class="min-w-0 flex-1 px-3 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
							onclick={() => {
								selectedByBars[barCount] = melody.id;
								if (!playing) sessionMelody = null;
							}}
						>
							<span class="flex items-center justify-between gap-2">
								<span class="font-semibold">{melody.name}</span>
								{#if playingId === melody.id}
									<span class="text-xs font-medium text-emerald-600">
										{activePhase === 'audiate' ? 'Audiate' : 'Playing'}
									</span>
								{/if}
							</span>
							{#if !hideMelody}
								<span class="mt-1 block truncate font-mono text-xs text-gray-500"
									>{melody.notation}</span
								>
							{/if}
						</button>
					</div>
				</li>
			{/each}
		</ul>
		<p class="mt-4 text-xs text-gray-500">
			Check melodies for the pool. Practice repeats your phase sequence until you stop. Space toggles
			practice.
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
				play={previewMelody}
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
