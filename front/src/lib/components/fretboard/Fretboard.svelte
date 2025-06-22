<script lang="ts">
	import UiSelect from '../UiSelect.svelte';
	import * as Tone from 'tone';

	const notes = ['E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C', 'C#', 'D', 'D#'];
	const circleOfFifths = ['C', 'G', 'D', 'A', 'E', 'B', 'F#/Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
	
	// Instrument configurations
	const instruments = {
		guitar: {
			name: 'Guitar',
			tuning: ['E', 'B', 'G', 'D', 'A', 'E'], // Standard tuning from high E to low E
			numStrings: 6
		},
		bass4: {
			name: '4-String Bass',
			tuning: ['G', 'D', 'A', 'E'], // Standard bass tuning from high G to low E
			numStrings: 4
		},
		bass5: {
			name: '5-String Bass',
			tuning: ['G', 'D', 'A', 'E', 'B'], // 5-string bass tuning with low B
			numStrings: 5
		},
		bass6: {
			name: '6-String Bass',
			tuning: ['C', 'G', 'D', 'A', 'E', 'B'], // 6-string bass tuning with high C and low B
			numStrings: 6
		}
	};
	
	let selectedInstrument = $state('guitar');
	const tuning = $derived(instruments[selectedInstrument as keyof typeof instruments].tuning);
	const numStrings = $derived(instruments[selectedInstrument as keyof typeof instruments].numStrings);
	const numFrets = 15;
	const degreeButtons = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

	// Audio setup
	let sampler: Tone.Sampler;
	let isAudioInitialized = $state(false);

	// Initialize audio on user interaction
	async function initAudio() {
		if (!isAudioInitialized) {
			await Tone.start();

			// Create a sampler with guitar-like samples
			sampler = new Tone.Sampler({
				urls: {
					C4: 'C4.mp3',
					'D#4': 'Ds4.mp3',
					'F#4': 'Fs4.mp3'
				},
				release: 1,
				baseUrl: 'https://tonejs.github.io/audio/salamander/'
			}).toDestination();

			isAudioInitialized = true;
		}
	}

	// Calculate the best octave for a note based on user's lowest note
	function getBestOctave(noteName: string): number {
		const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

		// Parse the lowest note (e.g., "G3" -> note: "G", octave: 3)
		const lowestNoteName = lowestNote.slice(0, -1);
		const lowestOctave = parseInt(lowestNote.slice(-1));

		// Get note indices
		const targetNoteIndex = noteNames.indexOf(noteName);
		const lowestNoteIndex = noteNames.indexOf(lowestNoteName);

		if (targetNoteIndex === -1 || lowestNoteIndex === -1) {
			return 4; // Fallback to middle octave
		}

		// If target note is lower than lowest note, go up one octave
		if (targetNoteIndex < lowestNoteIndex) {
			return lowestOctave + 1;
		}

		// Otherwise, stay in the same octave as lowest note
		return lowestOctave;
	}

	// Play a note
	function playNote(note: string) {
		if (isAudioInitialized && sampler) {
			const bestOctave = getBestOctave(note);
			sampler.triggerAttackRelease(note + bestOctave, '8n');
		}
	}

	const fretboard = $derived(
		tuning.map((openNote) => {
			const openNoteIndex = notes.indexOf(openNote);
			const stringNotes: string[] = [];
			for (let fret = 0; fret <= numFrets; fret++) {
				const noteIndex = (openNoteIndex + fret) % notes.length;
				stringNotes.push(notes[noteIndex]);
			}
			return stringNotes;
		})
	);

	// --- Game State ---
	let activeString = $state<number>(0);
	let activeFret = $state<number>(1);
	let selectedKey = $state('C');
	let correctAnswer = $state<number | null>(null);
	let feedback = $state('');
	let lowestNote = $state<string>('G3'); // User's lowest note as reference

	// --- Anchor Mode Settings ---
	let anchorModeEnabled = $state(false);
	let anchorDegree = $state<number>(1); // Default to I degree
	let questionCount = $state<number>(0); // Track question count for anchor logic

	// --- Practice Range Settings ---
	let stringRangeStart = $state<number>(1);
	let stringRangeEnd = $state<number>(6);
	let fretRangeStart = $state<number>(1);
	let fretRangeEnd = $state<number>(12);

	// Convert 1-based string indexing to 0-based for fretboard logic
	const stringRangeStartIndex = $derived(stringRangeStart - 1);
	const stringRangeEndIndex = $derived(stringRangeEnd - 1);

	// Update string range when instrument changes
	$effect(() => {
		if (stringRangeEnd > numStrings) {
			stringRangeEnd = numStrings;
		}
		if (stringRangeStart > numStrings) {
			stringRangeStart = 1;
		}
	});

	// Update lowest note when instrument changes
	$effect(() => {
		
		// Reset active position when instrument changes
		activeString = 0;
		activeFret = 1;
		correctAnswer = null;
		feedback = '';
		lastNote = '';
		questionCount = 0;
	});

	const scales = {
		major: [0, 2, 4, 5, 7, 9, 11] // Major scale intervals
	};

	function checkValidNotesInRange(): number {
		const rootNoteIndex = notes.indexOf(selectedKey);
		const scaleIntervals = scales.major;
		const scaleNotes = scaleIntervals.map(
			(interval) => notes[(rootNoteIndex + interval) % notes.length]
		);

		let validNotes = 0;
		for (let string = stringRangeStartIndex; string <= stringRangeEndIndex; string++) {
			for (let fret = fretRangeStart; fret <= fretRangeEnd; fret++) {
				// Add bounds checking
				if (fretboard[string] && fretboard[string][fret]) {
					const note = fretboard[string][fret];
					if (scaleNotes.includes(note)) {
						validNotes++;
					}
				}
			}
		}
		return validNotes;
	}

	const validNotesCount = $derived(checkValidNotesInRange());
	const canGenerateQuestion = $derived(validNotesCount >= 2);

	let lastNote = '';
	function getRootIndex() {
		if (isFlatOrSharp() === 'isFlat') return notes.indexOf(convertToSharp(selectedKey));
		return notes.indexOf(selectedKey);
	}
	function generateNewQuestion() {
		feedback = '';
		questionCount++;

		// If anchor mode is enabled, alternate between anchor degree and random degree
		let targetDegree: number;
		if (anchorModeEnabled && questionCount % 2 === 0) {
			// This should be an anchor question
			targetDegree = anchorDegree;
		} else {
			// This should be a random question
			targetDegree = Math.floor(Math.random() * 7) + 1; // Random degree 1-7
		}

		// Find a note that corresponds to the target degree
		const rootNoteIndex = getRootIndex();
		const scaleIntervals = scales.major;
		const scaleNotes = scaleIntervals.map(
			(interval) => notes[(rootNoteIndex + interval) % notes.length]
		);

		// Get the target note for the degree (convert to 0-based index)
		const targetNote = scaleNotes[targetDegree - 1];

		// Find all positions where this note appears in the practice range
		const validPositions: Array<{ string: number; fret: number }> = [];
		for (let string = stringRangeStartIndex; string <= stringRangeEndIndex; string++) {
			for (let fret = fretRangeStart; fret <= fretRangeEnd; fret++) {
				// Add bounds checking
				if (fretboard[string] && fretboard[string][fret]) {
					const note = fretboard[string][fret];
					if (note === targetNote) {
						validPositions.push({ string, fret });
					}
				}
			}
		}

		// If no valid positions found, try to generate a random question instead
		if (validPositions.length === 0) {
			if (anchorModeEnabled && questionCount % 2 === 0) {
				// If this was supposed to be an anchor question but failed, try random
				questionCount--; // Decrement to retry
				generateNewQuestion();
				return;
			} else {
				// Fallback to original random logic
				const newString =
					Math.floor(Math.random() * (stringRangeEndIndex - stringRangeStartIndex + 1)) +
					stringRangeStartIndex;
				const newFret =
					Math.floor(Math.random() * (fretRangeEnd - fretRangeStart + 1)) + fretRangeStart;

				// Add bounds checking
				if (fretboard[newString] && fretboard[newString][newFret]) {
					const note = fretboard[newString][newFret];
					const degree = scaleNotes.indexOf(note);

					if (degree === -1 || lastNote === note) {
						generateNewQuestion();
					} else {
						lastNote = note;
						activeString = newString;
						activeFret = newFret;
						correctAnswer = degree + 1; // 1-indexed degree
					}
				} else {
					// If bounds check fails, try again
					generateNewQuestion();
				}
				return;
			}
		}

		// Select a random position from valid positions
		const randomPosition = validPositions[Math.floor(Math.random() * validPositions.length)];

		// Check if this position has the same note as last time
		if (fretboard[randomPosition.string] && fretboard[randomPosition.string][randomPosition.fret]) {
			const note = fretboard[randomPosition.string][randomPosition.fret];
			if (lastNote === note && validPositions.length > 1) {
				// Try again with a different position
				generateNewQuestion();
				return;
			}

			lastNote = note;
			activeString = randomPosition.string;
			activeFret = randomPosition.fret;
			correctAnswer = targetDegree;
		} else {
			// If bounds check fails, try again
			generateNewQuestion();
		}
	}

	function handleAnswer(selectedDegree: number) {
		if (correctAnswer === null) {
			feedback = "Start the game"
			return 
		}
		
		if (selectedDegree === correctAnswer) {
			// Play the correct note when answer is right
			if (correctAnswer !== null) {
				// Add bounds checking
				if (fretboard[activeString] && fretboard[activeString][activeFret]) {
					const currentNote = fretboard[activeString][activeFret];
					playNote(currentNote);
				}
			}
			
			// Check if this was an anchor question
			const isAnchorQuestion = anchorModeEnabled && questionCount % 2 === 0;
			feedback = isAnchorQuestion ? 'Correct! (Anchor question)' : 'Correct!';

			setTimeout(() => generateNewQuestion(), 100);
		} else {
			// Play the note corresponding to the wrong degree selected
			const rootNoteIndex = getRootIndex();
			const scaleIntervals = scales.major;
			const wrongDegreeIndex = selectedDegree - 1; // Convert to 0-based index
			const wrongNote = notes[(rootNoteIndex + scaleIntervals[wrongDegreeIndex]) % notes.length];
			playNote(wrongNote);

			// Check if this was an anchor question
			const isAnchorQuestion = anchorModeEnabled && questionCount % 2 === 0;
			const anchorIndicator = isAnchorQuestion ? ' (Anchor question)' : '';
			feedback = `Incorrect. It's ${degreeButtons[correctAnswer! - 1]}.${anchorIndicator}`;
		}
	}

	// Play current note
	function playCurrentNote() {
		if (correctAnswer !== null) {
			// Add bounds checking
			if (fretboard[activeString] && fretboard[activeString][activeFret]) {
				const currentNote = fretboard[activeString][activeFret];
				playNote(currentNote);
			}
		}
	}

	// Play current note and go to next question
	function playAndNext() {
		if (correctAnswer !== null) {
			// Add bounds checking
			if (fretboard[activeString] && fretboard[activeString][activeFret]) {
				const currentNote = fretboard[activeString][activeFret];
				playNote(currentNote);
			}
			// Go to next question after a short delay
			setTimeout(() => generateNewQuestion(), 100);
		}
	}

	// Initial question
	// $effect(generateNewQuestion);
	$effect(() => {});

	function isFlatOrSharp() {
		const sharpKeys = ['G', 'D', 'A', 'E', 'B', 'F#'];
		const flatKeys = ['F', 'Bb', 'Eb', 'Ab', 'Db'];

		// Check if current key uses sharps or flats
		const usesSharps = sharpKeys.includes(selectedKey);
		const usesFlats = flatKeys.includes(selectedKey);
		if (usesFlats) {
			return 'isFlat';
		}

		// If key uses sharps and note has a flat, convert to sharp
		if (usesSharps) {
			return 'isSharp';
		}
		return 'Natural';
	}
	// Get the proper note name with correct accidental for the current key
	function convertToFlat(note: string): string {
		const sharpToFlat: Record<string, string> = {
			'C#': 'Db',
			'D#': 'Eb',
			'F#': 'Gb',
			'G#': 'Ab',
			'A#': 'Bb'
		};
		if (sharpToFlat[note]) {
			return sharpToFlat[note];
		}
		return note;
	}
	function convertToSharp(note: string): string {
		const flatToSharp: Record<string, string> = {
			Db: 'C#',
			Eb: 'D#',
			Gb: 'F#',
			Ab: 'G#',
			Bb: 'A#'
		};
		if (flatToSharp[note]) {
			return flatToSharp[note];
		}
		return note;
	}
	function getNoteNameWithAccidental(noteName: string): string {
		// Define which keys use sharps vs flats
		const accidentalType = isFlatOrSharp();

		// Map enharmonic equivalents

		// If key uses flats and note has a sharp, convert to flat
		if (accidentalType === 'isFlat') {
			return convertToFlat(noteName);
		}

		// If key uses sharps and note has a flat, convert to sharp
		if (accidentalType === 'isSharp') {
			return convertToSharp(noteName);
		}

		// Otherwise return the original note name
		return noteName;
	}

	let showNoteNameOnDot = $state(true);
	let highlightedDegrees = $state<number[]>([1, 2, 3, 4, 5, 6, 7]);
	let showDegreeOnRedDots = $state(false);

	function shouldShowRedDot(stringIdx: number, fretIdx: number): boolean {
		if (highlightedDegrees.length === 0) return false;
		const rootNoteIndex = getRootIndex();
		const scaleIntervals = scales.major;
		const scaleNotes = scaleIntervals.map(
			(interval) => notes[(rootNoteIndex + interval) % notes.length]
		);
		const note = fretboard[stringIdx][fretIdx];
		const degree = scaleNotes.indexOf(note) + 1;
		return (
			highlightedDegrees.includes(degree) && !(stringIdx === activeString && fretIdx === activeFret && correctAnswer !== null)
		);
	}

	function getRedDotDegreeLabel(stringIdx: number, fretIdx: number): string {
		const rootNoteIndex = getRootIndex();
		const scaleIntervals = scales.major;
		const scaleNotes = scaleIntervals.map(
			(interval) => notes[(rootNoteIndex + interval) % notes.length]
		);
		const note = fretboard[stringIdx][fretIdx];
		const degree = scaleNotes.indexOf(note) + 1;
		return degree > 0 ? degreeButtons[degree - 1] : '';
	}
</script>

<div class="flex flex-col items-center">
	<!-- Game Info -->
	<div class="my-4 text-center">
		<h2 class="text-2xl font-semibold">Find the note's degree in {selectedKey} Major</h2>
		{#if anchorModeEnabled && correctAnswer !== null}
			<div class="mt-2 text-sm">
				<span
					class="rounded px-2 py-1 text-white"
					class:bg-blue-500={questionCount % 2 === 0}
					class:bg-gray-500={questionCount % 2 !== 0}
				>
					{questionCount % 2 === 0 ? `Anchor: ${degreeButtons[anchorDegree - 1]}` : 'Random'}
				</span>
			</div>
		{/if}
		<div class="mt-4 flex justify-center gap-4">
			<div class="flex items-center gap-2">
				<p class="text-sm font-medium">Instrument:</p>
				<select
					bind:value={selectedInstrument}
					class="ease w-full cursor-pointer appearance-none rounded border border-slate-200 bg-transparent py-2 pl-3 pr-8 text-sm text-slate-700 shadow-sm transition duration-300 placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-400 focus:shadow-md focus:outline-none dark:text-slate-100"
				>
					{#each Object.entries(instruments) as [key, instrument]}
						<option class="px-2 dark:bg-slate-700" value={key}>{instrument.name}</option>
					{/each}
				</select>
			</div>
			<div class="flex items-center gap-2">
				<p class="text-sm font-medium">Key:</p>
				<select
					bind:value={selectedKey}
					class="ease w-full cursor-pointer appearance-none rounded border border-slate-200 bg-transparent py-2 pl-3 pr-8 text-sm text-slate-700 shadow-sm transition duration-300 placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-400 focus:shadow-md focus:outline-none dark:text-slate-100"
				>
					{#each circleOfFifths as note}
						<option class="px-2 dark:bg-slate-700" value={note}>{note}</option>
					{/each}
				</select>
			</div>
			<div class="flex items-center gap-2">
				<p class="text-sm font-medium">Lowest Note:</p>
				<select
					bind:value={lowestNote}
					class="ease w-full cursor-pointer appearance-none rounded border border-slate-200 bg-transparent py-2 pl-3 pr-8 text-sm text-slate-700 shadow-sm transition duration-300 placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-400 focus:shadow-md focus:outline-none dark:text-slate-100"
				>
					<option class="px-2 dark:bg-slate-700" value="B1">B1 (Bass)</option>
					<option class="px-2 dark:bg-slate-700" value="C2">C2 (Low Bass)</option>
					<option class="px-2 dark:bg-slate-700" value="D2">D2 (Bass)</option>
					<option class="px-2 dark:bg-slate-700" value="E2">E2 (Bass)</option>
					<option class="px-2 dark:bg-slate-700" value="F2">F2 (Bass)</option>
					<option class="px-2 dark:bg-slate-700" value="G2">G2 (Bass)</option>
					<option class="px-2 dark:bg-slate-700" value="A2">A2 (Bass)</option>
					<option class="px-2 dark:bg-slate-700" value="B2">B2 (Bass)</option>
					<option class="px-2 dark:bg-slate-700" value="C3">C3 (Baritone)</option>
					<option class="px-2 dark:bg-slate-700" value="D3">D3 (Baritone)</option>
					<option class="px-2 dark:bg-slate-700" value="E3">E3 (Baritone)</option>
					<option class="px-2 dark:bg-slate-700" value="F3">F3 (Baritone)</option>
					<option class="px-2 dark:bg-slate-700" value="G3">G3 (Baritone/Tenor)</option>
					<option class="px-2 dark:bg-slate-700" value="A3">A3 (Tenor)</option>
					<option class="px-2 dark:bg-slate-700" value="B3">B3 (Tenor)</option>
					<option class="px-2 dark:bg-slate-700" value="C4">C4 (Tenor/Alto)</option>
				</select>
			</div>
		</div>
		<div class="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
			Tuning: {tuning.join(' - ')} (from highest to lowest string)
		</div>
		<button
			onclick={async () => {
				await initAudio();
				questionCount = 0; // Reset question count for new session
				generateNewQuestion();
			}}
			disabled={!canGenerateQuestion}
			class="mt-2 rounded bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-400"
		>
			New Question
		</button>
		{#if correctAnswer !== null}
			<button
				onclick={async () => {
					await initAudio();
					playAndNext();
				}}
				class="ml-2 mt-2 rounded bg-green-500 px-4 py-2 text-white transition-colors hover:bg-green-600"
			>
				🔊 Play Note
			</button>
		{/if}
		{#if !canGenerateQuestion}
			<div class="mt-2 text-sm text-red-600 dark:text-red-400">
				⚠️ Not enough valid notes in selected range. Found {validNotesCount} note{validNotesCount !==
				1
					? 's'
					: ''}. Change the range.
			</div>
		{/if}
	</div>

	<!-- Practice Range Controls -->
	<div
		class="mb-6 w-10/12 rounded-lg bg-gray-100 p-4 md:w-5/6 dark:bg-gray-800 dark:text-slate-500"
	>
		<h3 class="mb-3 text-lg font-semibold">Practice Range</h3>
		<div class="flex flex-wrap justify-center gap-4">
			<div class="flex items-center gap-2">
				<UiSelect bind:value={stringRangeStart} length={numStrings} start={1} label="Strings:" />
				<span>to</span>
				<UiSelect bind:value={stringRangeEnd} length={numStrings} start={1} />
			</div>
			<div class="flex items-center gap-2">
				<UiSelect bind:value={fretRangeStart} length={numFrets} start={1} label="Frets:" />
				<span>to</span>
				<UiSelect bind:value={fretRangeEnd} length={numFrets} start={1} />
			</div>
		</div>
		<div class="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
			Currently practicing: Strings {stringRangeStart}-{stringRangeEnd}, Frets {fretRangeStart}-{fretRangeEnd}
			<br />
			<span class:text-green-600={validNotesCount >= 2} class:text-red-600={validNotesCount < 2}>
				Found {validNotesCount} valid note{validNotesCount !== 1 ? 's' : ''} in {selectedKey} Major
			</span>
		</div>
	</div>

	<!-- Toggle for note name on dot -->
	<div class="mb-2 flex justify-center">
		<label class="flex cursor-pointer select-none items-center gap-2">
			<input type="checkbox" bind:checked={showNoteNameOnDot} class="accent-blue-500" />
			<span class="text-sm">Show note name on dot</span>
		</label>
	</div>

	<!-- Toggle for degree name on red dots -->
	<div class="mb-2 flex justify-center">
		<label class="flex cursor-pointer select-none items-center gap-2">
			<input type="checkbox" bind:checked={showDegreeOnRedDots} class="accent-red-500" />
			<span class="text-sm">Show degree name in red dots</span>
		</label>
	</div>

	<!-- Anchor Mode Controls -->
	<div class="mb-4 flex flex-col items-center gap-2 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
		<div class="flex items-center gap-2">
			<label class="flex cursor-pointer select-none items-center gap-2">
				<input type="checkbox" bind:checked={anchorModeEnabled} class="accent-blue-500" />
				<span class="text-sm font-medium">Enable Anchor Mode</span>
			</label>
		</div>
		{#if anchorModeEnabled}
			<div class="flex items-center gap-2">
				<span class="text-sm">Anchor Degree:</span>
				<select
					bind:value={anchorDegree}
					class="ease w-full cursor-pointer appearance-none rounded border border-slate-200 bg-transparent py-1 pl-2 pr-6 text-sm text-slate-700 shadow-sm transition duration-300 placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-400 focus:shadow-md focus:outline-none dark:text-slate-100"
				>
					{#each degreeButtons as degree, i}
						<option class="px-2 dark:bg-slate-700" value={i + 1}>{degree}</option>
					{/each}
				</select>
			</div>
			<div class="text-xs text-gray-600 dark:text-gray-400">
				Every other question will be {degreeButtons[anchorDegree - 1]} degree
			</div>
		{/if}
	</div>

	<div class="mb-2 flex justify-center gap-2">
		{#each degreeButtons as degree, i}
			<button
				onclick={() => {
					highlightedDegrees = highlightedDegrees.includes(i + 1)
						? highlightedDegrees.filter((d) => d !== i + 1)
						: [...highlightedDegrees, i + 1];
				}}
				class="rounded border-2 px-2 py-0 text-lg font-bold transition-colors"
				class:bg-red-600={highlightedDegrees.includes(i + 1)}
				class:text-white={highlightedDegrees.includes(i + 1)}
				class:border-red-600={highlightedDegrees.includes(i + 1)}
				class:bg-gray-200={!highlightedDegrees.includes(i + 1)}
				class:text-red-600={!highlightedDegrees.includes(i + 1)}
				class:border-gray-300={!highlightedDegrees.includes(i + 1)}
			>
				{degree}
			</button>
		{/each}
	</div>

	<div class="w-10/12 md:w-5/6">
		<!-- fretboard main -->
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (because of reasons) -->
		<div
			class="relative mt-12 border-l-[5px] border-r-[5px] border-gray-400"
			style:height="{(numStrings - 1) * 30}px"
			onclick={playAndNext}
		>
			<!-- Fret Markers -->
			<div class="pointer-events-none absolute left-0 top-0 w-full" style:height="{(numStrings - 1) * 30}px">
				{#each [3, 5, 7, 9, 12, 15] as fret}
					<div
						class="absolute h-[8px] w-[8px] rounded-full bg-gray-400"
						style:left="calc(({fret} - 0.5) * (100% / {numFrets}) - 4px)"
						style:top="calc(50% - 4px)"
					></div>
				{/each}
			</div>

			<!-- Note Dot -->
			<div
				class="pointer-events-none absolute left-[2px] top-[3px] w-full sm:left-[-2px] sm:top-[1px] md:left-[-3px] md:top-[-3px] lg:left-[-5px] lg:top-[-4px]"
				style:height="{(numStrings - 1) * 30}px"
			>
				<!-- Red dots for highlighted degrees -->
				{#each Array(tuning.length) as _, stringIdx}
					{#each Array(numFrets + 1) as _, fretIdx}
						{#if shouldShowRedDot(stringIdx, fretIdx)}
							<div
								class="absolute flex h-[16px] w-[16px] items-center justify-center rounded-full border-2 border-red-600 bg-red-500 text-xs font-bold text-white opacity-80 sm:h-[20px] sm:w-[20px] md:h-[24px] md:w-[24px] lg:h-[28px] lg:w-[28px]"
								style:top="calc({stringIdx} * 30px - 10px)"
								style:left="calc(({fretIdx} - 0.5) * (100% / {numFrets}) - 8px)"
							>
								{showDegreeOnRedDots ? getRedDotDegreeLabel(stringIdx, fretIdx) : ''}
							</div>
						{/if}
					{/each}
				{/each}
				<!-- Main question dot -->
				{#if correctAnswer !== null}
					<div
						class="absolute flex h-[20px] w-[20px] items-center justify-center rounded-full border-2 text-xs font-bold text-black sm:h-[25px] sm:w-[25px] md:h-[30px] md:w-[30px] lg:h-[35px] lg:w-[35px]"
						class:border-blue-500={anchorModeEnabled && questionCount % 2 === 0}
						class:bg-blue-100={anchorModeEnabled && questionCount % 2 === 0}
						class:border-black={!(anchorModeEnabled && questionCount % 2 === 0)}
						class:bg-white={!(anchorModeEnabled && questionCount % 2 === 0)}
						style:top="calc({activeString} * 30px - 12.5px)"
						style:left="calc(({activeFret} - 0.5) * (100% / {numFrets}) - 12.5px)"
						style:transition="all 0.3s"
					>
						{#if showNoteNameOnDot}
							<span class="mb-[1px] text-sm sm:text-lg md:text-xl lg:text-2xl">
								{getNoteNameWithAccidental(fretboard[activeString][activeFret])}
							</span>
						{/if}
					</div>
				{/if}
			</div>
			<!-- strings wrap -->
			<div>
				{#each { length: numStrings - 1 } as _, i}
					<div class="h-[30px] border-b border-gray-400" class:border-t={i === 0}></div>
				{/each}

				<!-- notes wrap -->
				<!-- <div
									class="absolute sm:left-[-26px] md:left-[-32px] lg:left-[-40px] xl:left-[-43px] 2xl:left-[-60px] left-[-20px] top-[-14px] flex h-[180px] w-[30px] flex-col justify-between"
				>
					{#each tuning as note}
						<div class="h-[30px] text-2xl leading-none">{note}</div>
					{/each}
				</div> -->
			</div>
			<!-- frets wrap -->
			<div class="absolute left-0 top-0 flex w-full justify-between" style:height="{(numStrings - 1) * 30}px">
				{#each { length: numFrets } as _, i}
					<div
						class="flex flex-1 items-end justify-center border-r-2 border-gray-500 last:border-r-0"
						style:height="{(numStrings - 1) * 30}px"
					>
						{#if [3, 5, 7, 9, 12, 15].includes(i + 1)}
							<div class="translate-y-[150%] text-xl">{i + 1}</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	</div>

	<!-- Answer buttons -->
	<div class="mt-10 flex flex-col gap-2">
		<!-- First row: I to VII -->
		<div class="flex justify-center gap-2">
			{#each degreeButtons as degree, i}
				<button
					onclick={() => handleAnswer(i + 1)}
					class="w-10 rounded-lg bg-gray-200 px-1 text-lg font-bold transition-colors hover:bg-gray-300 sm:text-2xl dark:bg-gray-700 dark:hover:bg-gray-600"
				>
					{degree}
				</button>
			{/each}
		</div>

		<!-- Second row: VII to I (reverse order) -->
		<div class="flex justify-center gap-2">
			{#each degreeButtons.slice().reverse() as degree, i}
				<button
					onclick={() => handleAnswer(degreeButtons.length - i)}
					class="w-10 rounded-lg bg-gray-200 px-1 text-lg font-bold transition-colors hover:bg-gray-300 sm:text-2xl dark:bg-gray-700 dark:hover:bg-gray-600"
				>
					{degree}
				</button>
			{/each}
		</div>
	</div>

	<!-- Feedback -->
	<div class="mt-4 h-8 text-2xl font-semibold">{feedback}</div>
</div>
