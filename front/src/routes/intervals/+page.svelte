<script lang="ts">
	import * as Tone from 'tone';
	import { LocalStorage } from '$lib/stores/storage.svelte';
	import { SEVENTH_IDS, SEVENTH_SHAPES, TRIAD_IDS, TRIAD_SHAPES } from '$lib/intervals/chordShapes';

	/** Semitone steps between consecutive chord tones (1–12). */
	const INTERVAL_OPTIONS: { semitones: number; label: string }[] = [
		{ semitones: 1, label: 'm2' },
		{ semitones: 2, label: 'M2' },
		{ semitones: 3, label: 'm3' },
		{ semitones: 4, label: 'M3' },
		{ semitones: 5, label: 'P4' },
		{ semitones: 6, label: 'TT' },
		{ semitones: 7, label: 'P5' },
		{ semitones: 8, label: 'm6' },
		{ semitones: 9, label: 'M6' },
		{ semitones: 10, label: 'm7' },
		{ semitones: 11, label: 'M7' },
		{ semitones: 12, label: 'P8' }
	];

	const SEMITONE_TO_LABEL = Object.fromEntries(
		INTERVAL_OPTIONS.map((o) => [o.semitones, o.label])
	) as Record<number, string>;

	const FLOOR_NOTE_OPTIONS = [
		'B1',
		'C2',
		'D2',
		'E2',
		'F2',
		'G2',
		'A2',
		'B2',
		'C3',
		'D3',
		'E3',
		'F3',
		'G3',
		'A3',
		'B3',
		'C4'
	] as const;

	type IntervalsExerciseSettings = {
		lowestNote: string;
		/** Chord root may be floor .. floor + N half steps */
		rangeSemitones: number;
		noteCount: 2 | 3 | 4;
		/** Two-note mode: random single intervals */
		selectedSemitones: number[];
		/** Three-note mode: triad voicings (maj/min/dim/aug + inversions) */
		selectedTriadIds: string[];
		/** Four-note mode: seventh chord voicings */
		selectedSeventhIds: string[];
		pauseAfterHarmonicMs: number;
		playAscending: boolean;
		playDescending: boolean;
		gapBetweenAscDescMs: number;
		bpm: number;
		answerPauseMs: number;
	};

	const DEFAULT_SETTINGS: IntervalsExerciseSettings = {
		lowestNote: 'G3',
		rangeSemitones: 12,
		noteCount: 2,
		selectedSemitones: [3, 4, 5, 7],
		selectedTriadIds: [...TRIAD_IDS],
		selectedSeventhIds: [...SEVENTH_IDS],
		pauseAfterHarmonicMs: 2100,
		playAscending: true,
		playDescending: false,
		gapBetweenAscDescMs: 300,
		bpm: 90,
		answerPauseMs: 900
	};

	function sanitizeIntervalsSettings(raw: Partial<IntervalsExerciseSettings>): IntervalsExerciseSettings {
		const d = DEFAULT_SETTINGS;
		const ln = raw.lowestNote;
		const lowestNote: string =
			typeof ln === 'string' && FLOOR_NOTE_OPTIONS.includes(ln as (typeof FLOOR_NOTE_OPTIONS)[number])
				? ln
				: d.lowestNote;

		let rangeSemitones = Math.round(Number(raw.rangeSemitones));
		if (!Number.isFinite(rangeSemitones)) rangeSemitones = d.rangeSemitones;
		rangeSemitones = Math.min(18, Math.max(1, rangeSemitones));

		const noteCount =
			raw.noteCount === 2 || raw.noteCount === 3 || raw.noteCount === 4 ? raw.noteCount : d.noteCount;

		let selectedSemitones: number[];
		if (!Array.isArray(raw.selectedSemitones) || raw.selectedSemitones.length === 0) {
			selectedSemitones = [...d.selectedSemitones];
		} else {
			selectedSemitones = [
				...new Set(
					raw.selectedSemitones
						.map((n) => Math.round(Number(n)))
						.filter((n) => Number.isFinite(n) && n >= 1 && n <= 12)
				)
			].sort((a, b) => a - b);
			if (selectedSemitones.length === 0) selectedSemitones = [...d.selectedSemitones];
		}

		let selectedTriadIds: string[];
		if (!Array.isArray(raw.selectedTriadIds) || raw.selectedTriadIds.length === 0) {
			selectedTriadIds = [...d.selectedTriadIds];
		} else {
			selectedTriadIds = [...new Set(raw.selectedTriadIds.filter((id) => TRIAD_IDS.includes(id)))];
			if (selectedTriadIds.length === 0) selectedTriadIds = [...d.selectedTriadIds];
		}

		let selectedSeventhIds: string[];
		if (!Array.isArray(raw.selectedSeventhIds) || raw.selectedSeventhIds.length === 0) {
			selectedSeventhIds = [...d.selectedSeventhIds];
		} else {
			selectedSeventhIds = [...new Set(raw.selectedSeventhIds.filter((id) => SEVENTH_IDS.includes(id)))];
			if (selectedSeventhIds.length === 0) selectedSeventhIds = [...d.selectedSeventhIds];
		}

		const clamp = (n: number, lo: number, hi: number, fallback: number) => {
			const x = Math.round(Number(n));
			if (!Number.isFinite(x)) return fallback;
			return Math.min(hi, Math.max(lo, x));
		};

		const pauseAfterHarmonicMs = Math.round(
			clamp(
				raw.pauseAfterHarmonicMs ?? d.pauseAfterHarmonicMs,
				0,
				5000,
				d.pauseAfterHarmonicMs
			) / 100
		) * 100;
		const gapBetweenAscDescMs = Math.round(
			clamp(
				raw.gapBetweenAscDescMs ?? d.gapBetweenAscDescMs,
				0,
				2000,
				d.gapBetweenAscDescMs
			) / 100
		) * 100;
		const answerPauseMs = Math.round(
			clamp(raw.answerPauseMs ?? d.answerPauseMs, 500, 8000, d.answerPauseMs) / 100
		) * 100;

		return {
			lowestNote,
			rangeSemitones,
			noteCount,
			selectedSemitones,
			selectedTriadIds,
			selectedSeventhIds,
			pauseAfterHarmonicMs,
			playAscending: typeof raw.playAscending === 'boolean' ? raw.playAscending : d.playAscending,
			playDescending: typeof raw.playDescending === 'boolean' ? raw.playDescending : d.playDescending,
			gapBetweenAscDescMs,
			bpm: clamp(raw.bpm ?? d.bpm, 40, 240, d.bpm),
			answerPauseMs
		};
	}

	const settings = new LocalStorage<IntervalsExerciseSettings>('intervalsExerciseSettings', DEFAULT_SETTINGS);

	let didSanitizeSettings = $state(false);
	$effect.pre(() => {
		if (didSanitizeSettings) return;
		didSanitizeSettings = true;
		settings.current = sanitizeIntervalsSettings(settings.current);
	});

	let feedback = $state('');
	/** Lowest pitch of the current question (matches playback). */
	let currentLowestNoteName = $state('');
	let questionCount = $state(0);
	let gameStarted = $state(false);
	let isAudioInitialized = $state(false);
	let sampler: Tone.Sampler;
	let samplerLoaded = $state(false);
	/** Audio-clock timeout ids (Tone); must clear with Tone.getContext().clearTimeout */
	let toneRevealTimeoutId: number | null = null;
	let toneNextQuestionTimeoutId: number | null = null;
	let lastStepsKey = $state<string | null>(null);

	function midiToNoteName(midi: number): string {
		const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
		const pc = ((midi % 12) + 12) % 12;
		const octave = Math.floor(midi / 12) - 1;
		return `${names[pc]}${octave}`;
	}

	/** Sliders use 0.1 s steps (stored as ms); display as seconds with one decimal. */
	function formatSecondsLabel(ms: number): string {
		return `${(ms / 1000).toFixed(1)} s`;
	}

	function msToDs(ms: number): number {
		return Math.round(ms / 100);
	}

	function setPauseAfterHarmonicDs(ds: number) {
		settings.current.pauseAfterHarmonicMs = ds * 100;
	}

	function setGapBetweenAscDescDs(ds: number) {
		settings.current.gapBetweenAscDescMs = ds * 100;
	}

	function setAnswerPauseDs(ds: number) {
		settings.current.answerPauseMs = ds * 100;
	}

	const PAUSE_AFTER_HARMONIC_MAX_DS = 50; // 0–5.0 s
	const GAP_MAX_DS = 20; // 0–2.0 s
	const ANSWER_PAUSE_MIN_DS = 5; // 0.5 s
	const ANSWER_PAUSE_MAX_DS = 80; // 8.0 s

	const beatDuration = $derived(60000 / settings.current.bpm);
	const arpeggioNoteSpacingSec = $derived(beatDuration / 1000);

	const MAX_RANGE_SEMITONES = 18; // 1.5 octaves — max offset above floor for the chord’s lowest note
	const MAX_MIDI = 127;

	const minMidiFromLowest = $derived(
		Math.round(Tone.Frequency(settings.current.lowestNote).toMidi())
	);
	/** Top of the band where the chord root may be chosen (before MIDI safety clamp). */
	const rootRangeTopLabel = $derived(
		midiToNoteName(minMidiFromLowest + settings.current.rangeSemitones)
	);

	async function initAudio() {
		if (!isAudioInitialized) {
			await Tone.start();
			sampler = new Tone.Sampler({
				urls: {
					C4: 'C4.mp3',
					'D#4': 'Ds4.mp3',
					'F#4': 'Fs4.mp3'
				},
				release: 1,
				baseUrl: 'https://tonejs.github.io/audio/salamander/',
				onload: () => {
					samplerLoaded = true;
				}
			}).toDestination();
			isAudioInitialized = true;
		}
	}

	$effect(() => {
		if (!isAudioInitialized) void initAudio();
	});

	function stopSoundEngine() {
		if (sampler) {
			try {
				sampler.dispose();
			} catch {
				/* ignore */
			}
			samplerLoaded = false;
		}
		isAudioInitialized = false;
	}

	$effect(() => {
		return () => {
			stopGame();
			stopSoundEngine();
		};
	});

	function toggleInterval(semitones: number) {
		const cur = settings.current.selectedSemitones;
		settings.current.selectedSemitones = cur.includes(semitones)
			? cur.filter((s: number) => s !== semitones)
			: [...cur, semitones].sort((a, b) => a - b);
	}

	function toggleAllIntervals() {
		const cur = settings.current.selectedSemitones;
		if (cur.length === INTERVAL_OPTIONS.length) {
			settings.current.selectedSemitones = [];
		} else {
			settings.current.selectedSemitones = INTERVAL_OPTIONS.map((o) => o.semitones);
		}
	}

	function toggleTriad(id: string) {
		const cur = settings.current.selectedTriadIds;
		settings.current.selectedTriadIds = cur.includes(id)
			? cur.filter((x: string) => x !== id)
			: [...cur, id];
	}

	function toggleAllTriads() {
		const cur = settings.current.selectedTriadIds;
		if (cur.length === TRIAD_SHAPES.length) {
			settings.current.selectedTriadIds = [];
		} else {
			settings.current.selectedTriadIds = TRIAD_IDS.map((x) => x);
		}
	}

	function toggleSeventh(id: string) {
		const cur = settings.current.selectedSeventhIds;
		settings.current.selectedSeventhIds = cur.includes(id)
			? cur.filter((x: string) => x !== id)
			: [...cur, id];
	}

	function toggleAllSevenths() {
		const cur = settings.current.selectedSeventhIds;
		if (cur.length === SEVENTH_SHAPES.length) {
			settings.current.selectedSeventhIds = [];
		} else {
			settings.current.selectedSeventhIds = SEVENTH_IDS.map((x) => x);
		}
	}

	const selectionReady = $derived(
		settings.current.noteCount === 2
			? settings.current.selectedSemitones.length > 0
			: settings.current.noteCount === 3
				? settings.current.selectedTriadIds.length > 0
				: settings.current.selectedSeventhIds.length > 0
	);

	function pickQuestion(): { steps: number[]; answerLabel: string } {
		const nc = settings.current.noteCount;
		if (nc === 2) {
			const pool = settings.current.selectedSemitones;
			const stepsNeeded = 1;
			const out: number[] = [];
			for (let i = 0; i < stepsNeeded; i++) {
				out.push(pool[Math.floor(Math.random() * pool.length)]!);
			}
			return { steps: out, answerLabel: formatSteps(out) };
		}
		if (nc === 3) {
			const ids = settings.current.selectedTriadIds;
			const id = ids[Math.floor(Math.random() * ids.length)]!;
			const shape = TRIAD_SHAPES.find((s) => s.id === id)!;
			return { steps: [...shape.steps], answerLabel: shape.label };
		}
		const ids = settings.current.selectedSeventhIds;
		const id = ids[Math.floor(Math.random() * ids.length)]!;
		const shape = SEVENTH_SHAPES.find((s) => s.id === id)!;
		return { steps: [...shape.steps], answerLabel: shape.label };
	}

	function formatSteps(steps: number[]): string {
		return steps.map((s) => SEMITONE_TO_LABEL[s] ?? `${s}`).join(' → ');
	}

	function generateNewQuestion() {
		if (!selectionReady) {
			feedback =
				settings.current.noteCount === 2
					? 'Select at least one interval size.'
					: settings.current.noteCount === 3
						? 'Select at least one triad voicing.'
						: 'Select at least one seventh chord voicing.';
			return;
		}
		if (toneRevealTimeoutId !== null) {
			Tone.getContext().clearTimeout(toneRevealTimeoutId);
			toneRevealTimeoutId = null;
		}
		if (toneNextQuestionTimeoutId !== null) {
			Tone.getContext().clearTimeout(toneNextQuestionTimeoutId);
			toneNextQuestionTimeoutId = null;
		}

		currentLowestNoteName = '';
		feedback = 'Listen…';

		let { steps, answerLabel } = pickQuestion();
		let key = `${answerLabel}|${steps.join('-')}`;
		let guard = 0;
		while (lastStepsKey !== null && key === lastStepsKey && guard < 12) {
			const q = pickQuestion();
			steps = q.steps;
			answerLabel = q.answerLabel;
			key = `${answerLabel}|${steps.join('-')}`;
			guard++;
		}
		lastStepsKey = key;

		const floor = minMidiFromLowest;
		const totalSpan = steps.reduce((a, b) => a + b, 0);
		const desiredRootMax = floor + settings.current.rangeSemitones;
		const maxRoot = Math.min(desiredRootMax, MAX_MIDI - totalSpan);
		if (maxRoot < floor) {
			feedback = 'These intervals are too wide for the playable range; try smaller intervals.';
			return;
		}

		questionCount++;

		const rootMidi = floor + Math.floor(Math.random() * (maxRoot - floor + 1));
		const midiNotes: number[] = [rootMidi];
		for (const s of steps) {
			midiNotes.push(midiNotes[midiNotes.length - 1]! + s);
		}
		const notes = midiNotes.map(midiToNoteName);
		currentLowestNoteName = notes[0].slice(0, -1) ?? '';

		if (!isAudioInitialized || !sampler || !samplerLoaded) {
			feedback = 'Audio not ready.';
			currentLowestNoteName = '';
			return;
		}

		const harmLen = Tone.Time('2n').toSeconds();
		const arpLen = Tone.Time('8n').toSeconds();
		
		const harmStart = Tone.now() + 0.18;

		for (const n of notes) {
			sampler.triggerAttackRelease(n, '2n', harmStart);
		}
		/** When the harmonic ends — start of “pause after tonic” before arpeggios; reveal answer here. */
		const revealTime = harmStart + harmLen;
		let t = harmStart + harmLen + settings.current.pauseAfterHarmonicMs / 1000;
		

		if (settings.current.playAscending) {
			notes.forEach((n, i) => {
				sampler.triggerAttackRelease(n, '8n', t + i * arpeggioNoteSpacingSec);
			});
			t += (notes.length > 0 ? (notes.length - 1) * arpeggioNoteSpacingSec + arpLen : 0);
		}

		if (settings.current.playDescending) {
			if (settings.current.playAscending) {
				t += settings.current.gapBetweenAscDescMs / 1000;
			}
			const rev = [...notes].reverse();
			rev.forEach((n, i) => {
				sampler.triggerAttackRelease(n, '8n', t + i * arpeggioNoteSpacingSec);
			});
			t += (rev.length > 0 ? (rev.length - 1) * arpeggioNoteSpacingSec + arpLen : 0);
		}

		const endTime = t;

		const revealDelaySec = Math.max(0, revealTime - Tone.now()) + settings.current.pauseAfterHarmonicMs/1000;
		toneRevealTimeoutId = Tone.getContext().setTimeout(() => {
			toneRevealTimeoutId = null;
			feedback = answerLabel;
		}, revealDelaySec);

		const nextQuestionDelaySec =
			Math.max(0, endTime - Tone.now()) + 0.12 + settings.current.answerPauseMs / 1000;
		toneNextQuestionTimeoutId = Tone.getContext().setTimeout(() => {
			toneNextQuestionTimeoutId = null;
			generateNewQuestion();
		}, nextQuestionDelaySec);
	}

	function startGame() {
		void initAudio().then(() => {
			if (!selectionReady) {
				feedback =
					settings.current.noteCount === 2
						? 'Select at least one interval size.'
						: settings.current.noteCount === 3
							? 'Select at least one triad voicing.'
							: 'Select at least one seventh chord voicing.';
				return;
			}
			questionCount = 0;
			lastStepsKey = null;
			gameStarted = true;
			generateNewQuestion();
		});
	}

	function stopGame() {
		if (toneRevealTimeoutId !== null) {
			Tone.getContext().clearTimeout(toneRevealTimeoutId);
			toneRevealTimeoutId = null;
		}
		if (toneNextQuestionTimeoutId !== null) {
			Tone.getContext().clearTimeout(toneNextQuestionTimeoutId);
			toneNextQuestionTimeoutId = null;
		}
		gameStarted = false;
		feedback = '';
		currentLowestNoteName = '';
		lastStepsKey = null;
	}
</script>

<div class="flex flex-col items-center p-6">
	<h1 class="mb-8 text-3xl font-bold">Interval Exercise</h1>

	<div class="mx-0 mb-8 w-full max-w-2xl rounded-lg bg-gray-50 p-1 md:p-6 dark:bg-gray-800">
		<h2 class="mb-4 text-xl font-semibold">Settings</h2>

		<p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
			The lowest tone of each question is chosen between your floor note and the root range below; other notes are that
			root plus stacked intervals (no separate ceiling). Harmonic first, then silence and arpeggios when enabled.
			Settings are saved in this browser.
		</p>

		<div class="mb-4 flex flex-wrap items-center gap-4">
			<span class="text-sm font-medium">Notes (harmonic size):</span>
			<div class="flex gap-2">
				{#each [2, 3, 4] as n}
					<button
						type="button"
						class="rounded border-2 px-3 py-1 text-sm font-bold transition-colors"
						class:bg-blue-600={settings.current.noteCount === n}
						class:text-white={settings.current.noteCount === n}
						class:border-blue-600={settings.current.noteCount === n}
						class:bg-gray-200={settings.current.noteCount !== n}
						class:text-gray-700={settings.current.noteCount !== n}
						class:border-gray-300={settings.current.noteCount !== n}
						onclick={() => {
							settings.current.noteCount = n as 2 | 3 | 4;
						}}
					>
						{n}
					</button>
				{/each}
			</div>
		</div>

		<div class="mb-4 flex items-center gap-4">
			<span class="text-sm font-medium">Lowest note (floor):</span>
			<select
				bind:value={settings.current.lowestNote}
				class="rounded border border-gray-300 bg-white px-3 py-1 text-sm dark:bg-gray-700 dark:text-white"
			>
				<option value="B1">B1 (Bass)</option>
				<option value="C2">C2 (Low Bass)</option>
				<option value="D2">D2 (Bass)</option>
				<option value="E2">E2 (Bass)</option>
				<option value="F2">F2 (Bass)</option>
				<option value="G2">G2 (Bass)</option>
				<option value="A2">A2 (Bass)</option>
				<option value="B2">B2 (Bass)</option>
				<option value="C3">C3 (Baritone)</option>
				<option value="D3">D3 (Baritone)</option>
				<option value="E3">E3 (Baritone)</option>
				<option value="F3">F3 (Baritone)</option>
				<option value="G3">G3 (Baritone/Tenor)</option>
				<option value="A3">A3 (Tenor)</option>
				<option value="B3">B3 (Tenor)</option>
				<option value="C4">C4 (Tenor/Alto)</option>
			</select>
		</div>

		<div class="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
			<span class="shrink-0 text-sm font-medium">Root range above floor:</span>
			<div class="flex min-w-0 flex-1 flex-wrap items-center gap-3">
				<input
					type="range"
					min="1"
					max={MAX_RANGE_SEMITONES}
					step="1"
					bind:value={settings.current.rangeSemitones}
					class="h-2 w-full min-w-[12rem] max-w-xs accent-blue-500"
				/>
				<span class="text-sm text-gray-700 dark:text-gray-300">
					Up to +{settings.current.rangeSemitones} half step{settings.current.rangeSemitones === 1 ? '' : 's'} (max {MAX_RANGE_SEMITONES} = 1.5 oct); highest
					root ≈ {rootRangeTopLabel}
				</span>
			</div>
		</div>
		<p class="mb-4 text-xs text-gray-500 dark:text-gray-400">
			For 3 or 4 notes, voicings follow real chord shapes (triads and sevenths, including inversions). The bass is still
			picked in your root range; upper notes follow that voicing.
		</p>

		<div class="mb-4 flex flex-wrap items-center gap-1 md:gap-4">
			<span class="text-sm font-medium">Tempo (arpeggio spacing):</span>
			<input
				type="range"
				min="40"
				max="240"
				step="1"
				bind:value={settings.current.bpm}
				class="w-48 accent-blue-500"
			/>
			<span class="text-sm">{settings.current.bpm} BPM</span>
		</div>

		<div class="mb-4 flex flex-wrap items-center gap-1 md:gap-4">
			<span class="text-sm font-medium">Pause after harmonic:</span>
			<input
				type="range"
				min="0"
				max={PAUSE_AFTER_HARMONIC_MAX_DS}
				step="1"
				value={msToDs(settings.current.pauseAfterHarmonicMs)}
				aria-valuetext={formatSecondsLabel(settings.current.pauseAfterHarmonicMs)}
				oninput={(e) => setPauseAfterHarmonicDs(Number((e.currentTarget as HTMLInputElement).value))}
				class="w-48 accent-blue-500"
			/>
			<span class="text-sm tabular-nums">{formatSecondsLabel(settings.current.pauseAfterHarmonicMs)}</span>
		</div>

		<div class="mb-4 flex flex-wrap gap-6">
			<label class="flex cursor-pointer select-none items-center gap-2">
				<input type="checkbox" bind:checked={settings.current.playAscending} class="accent-blue-500" />
				<span class="text-sm">Ascending arpeggio</span>
			</label>
			<label class="flex cursor-pointer select-none items-center gap-2">
				<input type="checkbox" bind:checked={settings.current.playDescending} class="accent-blue-500" />
				<span class="text-sm">Descending arpeggio</span>
			</label>
		</div>

		<div class="mb-4 flex flex-wrap items-center gap-1 md:gap-4">
			<span class="text-sm font-medium">Gap before descending:</span>
			<input
				type="range"
				min="0"
				max={GAP_MAX_DS}
				step="1"
				value={msToDs(settings.current.gapBetweenAscDescMs)}
				aria-valuetext={formatSecondsLabel(settings.current.gapBetweenAscDescMs)}
				oninput={(e) => setGapBetweenAscDescDs(Number((e.currentTarget as HTMLInputElement).value))}
				class="w-48 accent-blue-500"
				disabled={!settings.current.playAscending || !settings.current.playDescending}
			/>
			<span class="text-sm tabular-nums">{formatSecondsLabel(settings.current.gapBetweenAscDescMs)}</span>
		</div>

		<div class="mb-4 flex flex-wrap items-center gap-1 md:gap-4">
			<span class="text-sm font-medium">Pause before next question:</span>
			<input
				type="range"
				min={ANSWER_PAUSE_MIN_DS}
				max={ANSWER_PAUSE_MAX_DS}
				step="1"
				value={msToDs(settings.current.answerPauseMs)}
				aria-valuetext={formatSecondsLabel(settings.current.answerPauseMs)}
				oninput={(e) => setAnswerPauseDs(Number((e.currentTarget as HTMLInputElement).value))}
				class="w-48 accent-blue-500"
			/>
			<span class="text-sm tabular-nums">{formatSecondsLabel(settings.current.answerPauseMs)}</span>
		</div>

		{#if settings.current.noteCount === 2}
			<div class="mb-4">
				<span class="mb-2 block text-sm font-medium">Single interval (between two notes):</span>
				<div class="flex flex-wrap gap-2">
					<button
						type="button"
						onclick={toggleAllIntervals}
						class="rounded border-2 border-gray-400 bg-gray-100 px-3 py-1 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-100"
					>
						{settings.current.selectedSemitones.length === INTERVAL_OPTIONS.length ? 'None' : 'All'}
					</button>
					{#each INTERVAL_OPTIONS as opt}
						<button
							type="button"
							onclick={() => toggleInterval(opt.semitones)}
							class="rounded border-2 px-3 py-1 text-sm font-bold transition-colors"
							class:bg-blue-600={settings.current.selectedSemitones.includes(opt.semitones)}
							class:text-white={settings.current.selectedSemitones.includes(opt.semitones)}
							class:border-blue-600={settings.current.selectedSemitones.includes(opt.semitones)}
							class:bg-gray-200={!settings.current.selectedSemitones.includes(opt.semitones)}
							class:text-gray-700={!settings.current.selectedSemitones.includes(opt.semitones)}
							class:border-gray-300={!settings.current.selectedSemitones.includes(opt.semitones)}
						>
							{opt.label}
						</button>
					{/each}
				</div>
			</div>
		{:else if settings.current.noteCount === 3}
			<div class="mb-4">
				<span class="mb-2 block text-sm font-medium">Triad voicings (close position, random from selection):</span>
				<div class="flex flex-wrap gap-2">
					<button
						type="button"
						onclick={toggleAllTriads}
						class="rounded border-2 border-gray-400 bg-gray-100 px-3 py-1 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-100"
					>
						{settings.current.selectedTriadIds.length === TRIAD_SHAPES.length ? 'None' : 'All'}
					</button>
					{#each TRIAD_SHAPES as shape}
						<button
							type="button"
							onclick={() => toggleTriad(shape.id)}
							class="rounded border-2 px-2 py-1 text-xs font-bold transition-colors sm:text-sm"
							class:bg-blue-600={settings.current.selectedTriadIds.includes(shape.id)}
							class:text-white={settings.current.selectedTriadIds.includes(shape.id)}
							class:border-blue-600={settings.current.selectedTriadIds.includes(shape.id)}
							class:bg-gray-200={!settings.current.selectedTriadIds.includes(shape.id)}
							class:text-gray-700={!settings.current.selectedTriadIds.includes(shape.id)}
							class:border-gray-300={!settings.current.selectedTriadIds.includes(shape.id)}
						>
							{shape.label}
						</button>
					{/each}
				</div>
			</div>
		{:else}
			<div class="mb-4">
				<span class="mb-2 block text-sm font-medium">Seventh chords (close position, random from selection):</span>
				<div class="flex flex-wrap gap-2">
					<button
						type="button"
						onclick={toggleAllSevenths}
						class="rounded border-2 border-gray-400 bg-gray-100 px-3 py-1 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-100"
					>
						{settings.current.selectedSeventhIds.length === SEVENTH_SHAPES.length ? 'None' : 'All'}
					</button>
					{#each SEVENTH_SHAPES as shape}
						<button
							type="button"
							onclick={() => toggleSeventh(shape.id)}
							class="rounded border-2 px-2 py-1 text-xs font-bold transition-colors sm:text-sm"
							class:bg-blue-600={settings.current.selectedSeventhIds.includes(shape.id)}
							class:text-white={settings.current.selectedSeventhIds.includes(shape.id)}
							class:border-blue-600={settings.current.selectedSeventhIds.includes(shape.id)}
							class:bg-gray-200={!settings.current.selectedSeventhIds.includes(shape.id)}
							class:text-gray-700={!settings.current.selectedSeventhIds.includes(shape.id)}
							class:border-gray-300={!settings.current.selectedSeventhIds.includes(shape.id)}
						>
							{shape.label}
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<div class="mb-8 flex flex-col items-center gap-4">
		{#if !gameStarted}
			<button
				type="button"
				onclick={startGame}
				disabled={!selectionReady || !samplerLoaded}
				class="rounded bg-blue-500 px-6 py-3 text-lg font-semibold text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-400"
			>
				Start interval exercise
			</button>
			{#if !samplerLoaded}
				<div class="mt-2 text-xs text-gray-500">Loading piano sounds…</div>
			{/if}
		{:else}
			<button
				type="button"
				onclick={stopGame}
				class="rounded bg-red-500 px-4 py-2 text-white transition-colors hover:bg-red-600"
			>
				Stop
			</button>
		{/if}
	</div>

	{#if gameStarted}
		<div class="mb-8 text-center">
			<div class="mb-4 text-xl font-semibold text-gray-800 dark:text-gray-200">
				{feedback}
			</div>
			{#if currentLowestNoteName}
				<div class="mb-2 text-lg tabular-nums text-gray-600 dark:text-gray-400">
					Lowest note: <span class="font-semibold text-gray-800 dark:text-gray-200">{currentLowestNoteName}</span>
				</div>
			{/if}
			<div class="text-lg text-gray-600 dark:text-gray-400">Round {questionCount}</div>
		</div>
	{/if}

	<div class="max-w-2xl text-center text-gray-600 dark:text-gray-400">
		<h3 class="mb-2 text-lg font-semibold">How it works</h3>
		<ol class="list-inside list-decimal space-y-1 text-sm text-left">
			<li>
				Set your floor note, then how far above it the lowest tone of each question may be (1–18 half steps, up to 1.5
				octaves). The chord’s top note follows from the intervals.
			</li>
			<li>Choose 2, 3, or 4 notes per harmonic.</li>
			<li>
				For 2 notes, pick which interval sizes are allowed. For 3 or 4 notes, pick triad or seventh chord voicings
				(major, minor, diminished, augmented, dom7, maj7, m7, half-dim, etc., including inversions).
			</li>
			<li>Adjust the pause after the harmonic block and the tempo for the arpeggios.</li>
			<li>
				After the harmonic, the answer appears when the pause after tonic begins (before any arpeggio). The next round
				starts after the arpeggios and the pause before next question.
			</li>
		</ol>
	</div>
</div>
