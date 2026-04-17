<script lang="ts">
	import * as Tone from 'tone';

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

	let lowestNote = $state<string>('G3');
	let noteCount = $state<2 | 3 | 4>(2);
	let selectedSemitones = $state<number[]>([3, 4, 5, 7]);
	let pauseAfterHarmonicMs = $state(1500);
	let playAscending = $state(true);
	let playDescending = $state(true);
	let gapBetweenAscDescMs = $state(0);
	let bpm = $state(120);
	let answerPauseMs = $state(2000);

	let feedback = $state('');
	let questionCount = $state(0);
	let gameStarted = $state(false);
	let isAudioInitialized = $state(false);
	let sampler: Tone.Sampler;
	let samplerLoaded = $state(false);
	let questionTimeout: ReturnType<typeof setTimeout> | null = null;
	let lastStepsKey = $state<string | null>(null);

	const beatDuration = $derived(60000 / bpm);
	const arpeggioNoteSpacingSec = $derived(beatDuration / 1000);

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

	function midiToNoteName(midi: number): string {
		const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
		const pc = ((midi % 12) + 12) % 12;
		const octave = Math.floor(midi / 12) - 1;
		return `${names[pc]}${octave}`;
	}

	function toggleInterval(semitones: number) {
		selectedSemitones = selectedSemitones.includes(semitones)
			? selectedSemitones.filter((s) => s !== semitones)
			: [...selectedSemitones, semitones].sort((a, b) => a - b);
	}

	function toggleAllIntervals() {
		if (selectedSemitones.length === INTERVAL_OPTIONS.length) {
			selectedSemitones = [];
		} else {
			selectedSemitones = INTERVAL_OPTIONS.map((o) => o.semitones);
		}
	}

	function pickSteps(): number[] {
		const stepsNeeded = noteCount - 1;
		const pool = selectedSemitones;
		const out: number[] = [];
		for (let i = 0; i < stepsNeeded; i++) {
			out.push(pool[Math.floor(Math.random() * pool.length)]!);
		}
		return out;
	}

	function formatSteps(steps: number[]): string {
		return steps.map((s) => SEMITONE_TO_LABEL[s] ?? `${s}`).join(' → ');
	}

	function generateNewQuestion() {
		if (selectedSemitones.length === 0) {
			feedback = 'Select at least one interval size.';
			return;
		}
		if (questionTimeout) {
			clearTimeout(questionTimeout);
			questionTimeout = null;
		}

		feedback = 'Listen…';

		let steps = pickSteps();
		let key = steps.join('-');
		let guard = 0;
		while (lastStepsKey !== null && key === lastStepsKey && guard < 12) {
			steps = pickSteps();
			key = steps.join('-');
			guard++;
		}
		lastStepsKey = key;

		const minMidi = Math.round(Tone.Frequency(lowestNote).toMidi());
		const maxMidi = 83;
		const totalSpan = steps.reduce((a, b) => a + b, 0);
		const lowBound = minMidi;
		const highBound = maxMidi - totalSpan;
		if (highBound < lowBound) {
			feedback = 'Lowest note is too high for this interval stack. Lower settings or widen range.';
			return;
		}

		questionCount++;

		const rootMidi = lowBound + Math.floor(Math.random() * (highBound - lowBound + 1));
		const midiNotes: number[] = [rootMidi];
		for (const s of steps) {
			midiNotes.push(midiNotes[midiNotes.length - 1]! + s);
		}
		const notes = midiNotes.map(midiToNoteName);

		if (!isAudioInitialized || !sampler || !samplerLoaded) {
			feedback = 'Audio not ready.';
			return;
		}

		const harmLen = Tone.Time('2n').toSeconds();
		const arpLen = Tone.Time('8n').toSeconds();
		let t = Tone.now() + 0.18;

		for (const n of notes) {
			sampler.triggerAttackRelease(n, '2n', t);
		}
		t += harmLen + pauseAfterHarmonicMs / 1000;

		if (playAscending) {
			notes.forEach((n, i) => {
				sampler.triggerAttackRelease(n, '8n', t + i * arpeggioNoteSpacingSec);
			});
			t += (notes.length > 0 ? (notes.length - 1) * arpeggioNoteSpacingSec + arpLen : 0);
		}

		if (playDescending) {
			if (playAscending) {
				t += gapBetweenAscDescMs / 1000;
			}
			const rev = [...notes].reverse();
			rev.forEach((n, i) => {
				sampler.triggerAttackRelease(n, '8n', t + i * arpeggioNoteSpacingSec);
			});
			t += (rev.length > 0 ? (rev.length - 1) * arpeggioNoteSpacingSec + arpLen : 0);
		}

		const endTime = t;
		const delayMs = Math.max(0, (endTime - Tone.now()) * 1000) + 120;

		questionTimeout = setTimeout(() => {
			feedback = formatSteps(steps);
			questionTimeout = setTimeout(() => {
				generateNewQuestion();
			}, answerPauseMs);
		}, delayMs);
	}

	function startGame() {
		void initAudio().then(() => {
			if (selectedSemitones.length === 0) {
				feedback = 'Select at least one interval size.';
				return;
			}
			questionCount = 0;
			lastStepsKey = null;
			gameStarted = true;
			generateNewQuestion();
		});
	}

	function stopGame() {
		if (questionTimeout) {
			clearTimeout(questionTimeout);
			questionTimeout = null;
		}
		gameStarted = false;
		feedback = '';
		lastStepsKey = null;
	}
</script>

<div class="flex flex-col items-center p-6">
	<h1 class="mb-8 text-3xl font-bold">Interval Exercise</h1>

	<div class="mx-0 mb-8 w-full max-w-2xl rounded-lg bg-gray-50 p-1 md:p-6 dark:bg-gray-800">
		<h2 class="mb-4 text-xl font-semibold">Settings</h2>

		<p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
			Harmonic block first, then silence, then ascending and descending arpeggios (when enabled). The
			intervals between adjacent chord tones are shown after each round.
		</p>

		<div class="mb-4 flex flex-wrap items-center gap-4">
			<span class="text-sm font-medium">Notes (harmonic size):</span>
			<div class="flex gap-2">
				{#each [2, 3, 4] as n}
					<button
						type="button"
						class="rounded border-2 px-3 py-1 text-sm font-bold transition-colors"
						class:bg-blue-600={noteCount === n}
						class:text-white={noteCount === n}
						class:border-blue-600={noteCount === n}
						class:bg-gray-200={noteCount !== n}
						class:text-gray-700={noteCount !== n}
						class:border-gray-300={noteCount !== n}
						onclick={() => {
							noteCount = n as 2 | 3 | 4;
						}}
					>
						{n}
					</button>
				{/each}
			</div>
		</div>

		<div class="mb-4 flex items-center gap-4">
			<span class="text-sm font-medium">Lowest note:</span>
			<select
				bind:value={lowestNote}
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

		<div class="mb-4 flex flex-wrap items-center gap-1 md:gap-4">
			<span class="text-sm font-medium">Tempo (arpeggio spacing):</span>
			<input
				type="range"
				min="40"
				max="240"
				step="1"
				bind:value={bpm}
				class="w-48 accent-blue-500"
			/>
			<span class="text-sm">{bpm} BPM</span>
		</div>

		<div class="mb-4 flex flex-wrap items-center gap-1 md:gap-4">
			<span class="text-sm font-medium">Pause after harmonic:</span>
			<input
				type="range"
				min="0"
				max="5000"
				step="100"
				bind:value={pauseAfterHarmonicMs}
				class="w-48 accent-blue-500"
			/>
			<span class="text-sm">{pauseAfterHarmonicMs} ms</span>
		</div>

		<div class="mb-4 flex flex-wrap gap-6">
			<label class="flex cursor-pointer select-none items-center gap-2">
				<input type="checkbox" bind:checked={playAscending} class="accent-blue-500" />
				<span class="text-sm">Ascending arpeggio</span>
			</label>
			<label class="flex cursor-pointer select-none items-center gap-2">
				<input type="checkbox" bind:checked={playDescending} class="accent-blue-500" />
				<span class="text-sm">Descending arpeggio</span>
			</label>
		</div>

		<div class="mb-4 flex flex-wrap items-center gap-1 md:gap-4">
			<span class="text-sm font-medium">Gap before descending:</span>
			<input
				type="range"
				min="0"
				max="2000"
				step="50"
				bind:value={gapBetweenAscDescMs}
				class="w-48 accent-blue-500"
				disabled={!playAscending || !playDescending}
			/>
			<span class="text-sm">{gapBetweenAscDescMs} ms</span>
		</div>

		<div class="mb-4 flex flex-wrap items-center gap-1 md:gap-4">
			<span class="text-sm font-medium">Pause before next question:</span>
			<input
				type="range"
				min="500"
				max="8000"
				step="100"
				bind:value={answerPauseMs}
				class="w-48 accent-blue-500"
			/>
			<span class="text-sm">{answerPauseMs} ms</span>
		</div>

		<div class="mb-4">
			<span class="mb-2 block text-sm font-medium">Intervals between adjacent notes (random from selection):</span>
			<div class="flex flex-wrap gap-2">
				<button
					type="button"
					onclick={toggleAllIntervals}
					class="rounded border-2 border-gray-400 bg-gray-100 px-3 py-1 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-100"
				>
					{selectedSemitones.length === INTERVAL_OPTIONS.length ? 'None' : 'All'}
				</button>
				{#each INTERVAL_OPTIONS as opt}
					<button
						type="button"
						onclick={() => toggleInterval(opt.semitones)}
						class="rounded border-2 px-3 py-1 text-sm font-bold transition-colors"
						class:bg-blue-600={selectedSemitones.includes(opt.semitones)}
						class:text-white={selectedSemitones.includes(opt.semitones)}
						class:border-blue-600={selectedSemitones.includes(opt.semitones)}
						class:bg-gray-200={!selectedSemitones.includes(opt.semitones)}
						class:text-gray-700={!selectedSemitones.includes(opt.semitones)}
						class:border-gray-300={!selectedSemitones.includes(opt.semitones)}
					>
						{opt.label}
					</button>
				{/each}
			</div>
		</div>
	</div>

	<div class="mb-8 flex flex-col items-center gap-4">
		{#if !gameStarted}
			<button
				type="button"
				onclick={startGame}
				disabled={selectedSemitones.length === 0 || !samplerLoaded}
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
			<div class="text-lg text-gray-600 dark:text-gray-400">Round {questionCount}</div>
		</div>
	{/if}

	<div class="max-w-2xl text-center text-gray-600 dark:text-gray-400">
		<h3 class="mb-2 text-lg font-semibold">How it works</h3>
		<ol class="list-inside list-decimal space-y-1 text-sm text-left">
			<li>Set your lowest comfortable note (same idea as Listening and Dictation).</li>
			<li>Choose 2, 3, or 4 notes for each harmonic.</li>
			<li>Pick which interval sizes can appear between adjacent notes.</li>
			<li>Adjust the pause after the harmonic block and the tempo for the arpeggios.</li>
			<li>After the sequence, the interval names are shown, then the next round starts automatically.</li>
		</ol>
	</div>
</div>
