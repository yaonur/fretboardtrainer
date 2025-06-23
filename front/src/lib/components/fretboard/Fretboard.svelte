<script lang="ts">
	import UiSelect from '../UiSelect.svelte';
	import * as Tone from 'tone';
	import { fretboardPresetsStore, type FretboardPreset } from '$lib/stores/fretboardStore.svelte';

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
	const numStrings = $derived(
		instruments[selectedInstrument as keyof typeof instruments].numStrings
	);
	const numFrets = 15;
	const degreeButtons = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

	// Audio setup
	let sampler: Tone.Sampler;
	let isAudioInitialized = $state(false);

	// Initialize audio on user interaction
	async function initAudio() {
		console.log('audio init');
		if (!isAudioInitialized) {
			console.log('initing---------');
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
	let gameMode = $state<'find-degree' | 'find-note'>('find-degree'); // find-degree: note -> degree, find-note: degree -> note
	let targetDegree = $state<number | null>(null); // For find-note mode

	// --- Anchor Mode Settings ---
	let anchorModeEnabled = $state(false);
	let anchorDegree = $state<number>(1); // Default to I degree
	let anchorFrequency = $state<number>(2); // How many questions to skip before anchor (default: every 2nd question)
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
		return () => {
			if (sampler) {
				sampler.dispose();
			}
		};
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

	let lastNote = '';
	let lastDegree: number | null = null;
	function getRootIndex() {
		if (isFlatOrSharp() === 'isFlat') return notes.indexOf(convertToSharp(selectedKey));
		return notes.indexOf(selectedKey);
	}
	function generateNewQuestion() {
		feedback = '';
		questionCount++;

		if (gameMode === 'find-degree') {
			let targetDegree: number;
			const rootNoteIndex = getRootIndex();
			const scaleIntervals = scales.major;
			const scaleNotes = scaleIntervals.map(
				(interval) => notes[(rootNoteIndex + interval) % notes.length]
			);

			if (anchorModeEnabled && questionCount % anchorFrequency === 0) {
				// Only ask anchor degree on the Nth question
				targetDegree = anchorDegree;
			} else {
				// Only random degrees, excluding anchor degree and lastDegree
				let availableDegrees = [1, 2, 3, 4, 5, 6, 7].filter(
					(degree) => degree !== lastDegree && (!anchorModeEnabled || degree !== anchorDegree)
				);
				// Filter out degrees that have no valid positions in the current range
				availableDegrees = availableDegrees.filter((degree) => {
					const targetNote = scaleNotes[degree - 1];
					for (let string = stringRangeStartIndex; string <= stringRangeEndIndex; string++) {
						for (let fret = fretRangeStart; fret <= fretRangeEnd; fret++) {
							if (fretboard[string] && fretboard[string][fret] === targetNote) {
								return true;
							}
						}
					}
					return false;
				});
				if (availableDegrees.length === 0) {
					feedback = 'No valid non-anchor degrees in the current range. Please adjust your range.';
					return;
				}
				targetDegree = availableDegrees[Math.floor(Math.random() * availableDegrees.length)];
			}

			// Find a note that corresponds to the target degree
			const targetNote = scaleNotes[targetDegree - 1];

			// Find all positions where this note appears in the practice range
			const validPositions: Array<{ string: number; fret: number }> = [];
			for (let string = stringRangeStartIndex; string <= stringRangeEndIndex; string++) {
				for (let fret = fretRangeStart; fret <= fretRangeEnd; fret++) {
					if (fretboard[string] && fretboard[string][fret]) {
						const note = fretboard[string][fret];
						if (note === targetNote) {
							validPositions.push({ string, fret });
						}
					}
				}
			}

			if (validPositions.length === 0) {
				feedback =
					'No valid positions for the selected degree in the current range. Please adjust your range.';
				return;
			}

			const randomPosition = validPositions[Math.floor(Math.random() * validPositions.length)];

			if (
				fretboard[randomPosition.string] &&
				fretboard[randomPosition.string][randomPosition.fret]
			) {
				const note = fretboard[randomPosition.string][randomPosition.fret];
				if (lastNote === note && validPositions.length > 1) {
					generateNewQuestion();
					return;
				}

				lastNote = note;
				lastDegree = targetDegree;
				activeString = randomPosition.string;
				activeFret = randomPosition.fret;
				correctAnswer = targetDegree;
			} else {
				generateNewQuestion();
			}
		} else {
			// New mode: find the note for a given degree
			// If anchor mode is enabled, alternate between anchor degree and random degree
			let degreeToFind: number;
			if (anchorModeEnabled && questionCount % anchorFrequency === 0) {
				// This should be an anchor question
				degreeToFind = anchorDegree;
			} else {
				// This should be a random question (excluding anchor degree if anchor mode is enabled)
				let availableDegrees = [1, 2, 3, 4, 5, 6, 7];
				if (anchorModeEnabled) {
					// Remove the anchor degree from available options for random questions
					availableDegrees = availableDegrees.filter((degree) => degree !== anchorDegree);
				}
				degreeToFind = availableDegrees[Math.floor(Math.random() * availableDegrees.length)];
			}

			targetDegree = degreeToFind;
			correctAnswer = null; // Will be set when user clicks on fretboard
		}
	}

	function handleAnswer(selectedDegree: number) {
		if (correctAnswer === null) {
			feedback = 'Start the game';
			return;
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
			const isAnchorQuestion = anchorModeEnabled && questionCount % anchorFrequency === 0;
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
			const isAnchorQuestion = anchorModeEnabled && questionCount % anchorFrequency === 0;
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

	function toggleAllDegrees() {
		if (highlightedDegrees.length === degreeButtons.length) {
			highlightedDegrees = [];
		} else {
			highlightedDegrees = degreeButtons.map((_, i) => i + 1);
		}
	}

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
			highlightedDegrees.includes(degree) &&
			!(stringIdx === activeString && fretIdx === activeFret && correctAnswer !== null)
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

	let presets = $state<FretboardPreset[]>([]);
	let newPresetName = $state('');
	let loadedPresetName = $state<string | null>(null);

	$effect(() => {
		presets = fretboardPresetsStore.presets;
	});

	async function saveCurrentPreset() {
		if (!newPresetName.trim()) return;
		const preset: FretboardPreset = {
			name: newPresetName.trim(),
			selectedInstrument,
			selectedKey,
			lowestNote,
			stringRangeStart,
			stringRangeEnd,
			fretRangeStart,
			fretRangeEnd,
			anchorModeEnabled,
			anchorDegree,
			anchorFrequency,
			highlightedDegrees: [...highlightedDegrees]
		};
		await fretboardPresetsStore.savePreset(preset);
		loadedPresetName = newPresetName.trim();
		newPresetName = '';
	}

	async function applyPreset(preset: FretboardPreset) {
		selectedInstrument = preset.selectedInstrument;
		selectedKey = preset.selectedKey;
		lowestNote = preset.lowestNote;
		stringRangeStart = preset.stringRangeStart;
		stringRangeEnd = preset.stringRangeEnd;
		fretRangeStart = preset.fretRangeStart;
		fretRangeEnd = preset.fretRangeEnd;
		anchorModeEnabled = preset.anchorModeEnabled;
		anchorDegree = preset.anchorDegree;
		anchorFrequency = preset.anchorFrequency;
		highlightedDegrees = preset.highlightedDegrees || [1, 2, 3, 4, 5, 6, 7];
		loadedPresetName = preset.name;
	}

	async function deletePreset(name: string) {
		if (confirm(`Are you sure you want to delete the preset "${name}"?`)) {
			await fretboardPresetsStore.deletePreset(name);
			// If the deleted preset was the loaded one, clear the loadedPresetName
			if (loadedPresetName === name) {
				loadedPresetName = null;
			}
		}
	}

	async function updatePreset(name: string) {
		const preset: FretboardPreset = {
			name,
			selectedInstrument,
			selectedKey,
			lowestNote,
			stringRangeStart,
			stringRangeEnd,
			fretRangeStart,
			fretRangeEnd,
			anchorModeEnabled,
			anchorDegree,
			anchorFrequency,
			highlightedDegrees: [...highlightedDegrees]
		};
		await fretboardPresetsStore.savePreset(preset);
	}

	function handleFretboardClick(stringIdx: number, fretIdx: number) {
		if (gameMode === 'find-note' && targetDegree !== null) {
			// Check if the clicked note matches the target degree
			const rootNoteIndex = getRootIndex();
			const scaleIntervals = scales.major;
			const scaleNotes = scaleIntervals.map(
				(interval) => notes[(rootNoteIndex + interval) % notes.length]
			);

			const clickedNote = fretboard[stringIdx][fretIdx];
			const clickedDegree = scaleNotes.indexOf(clickedNote) + 1;
			debugger

			if (clickedDegree === targetDegree) {
				// Correct! Play the note and provide feedback
				playNote(clickedNote);
				feedback = 'Correct!';
				setTimeout(() => generateNewQuestion(), 1000);
			} else {
				// Incorrect! Play the wrong note and provide feedback
				playNote(clickedNote);
				const correctNote = scaleNotes[targetDegree - 1];
				const degreeLabel = clickedDegree > 0 ? `(${degreeButtons[clickedDegree - 1]})` : '';
				feedback = `Incorrect. You clicked ${getNoteNameWithAccidental(clickedNote)} ${degreeLabel}`;
			}
		} else if (gameMode === 'find-degree') {
			// Original mode: play and next
			playAndNext();
		}
	}

	function countUniqueDegreesInRange(): { count: number; hasAnchor: boolean } {
		const rootNoteIndex = getRootIndex();
		const scaleIntervals = scales.major;
		const scaleNotes = scaleIntervals.map(
			(interval) => notes[(rootNoteIndex + interval) % notes.length]
		);
		const foundDegrees = new Set<number>();
		let hasAnchor = false;
		for (let string = stringRangeStartIndex; string <= stringRangeEndIndex; string++) {
			for (let fret = fretRangeStart; fret <= fretRangeEnd; fret++) {
				if (fretboard[string] && fretboard[string][fret]) {
					let note = fretboard[string][fret];

					const degree = scaleNotes.indexOf(note) + 1;
					if (degree > 0) foundDegrees.add(degree);
					if (degree === anchorDegree) hasAnchor = true;
				}
			}
		}
		return { count: foundDegrees.size, hasAnchor };
	}

	const uniqueDegreesInfo = $derived(countUniqueDegreesInRange());
	const uniqueDegreesCount = $derived(uniqueDegreesInfo.count);
	const hasAnchorDegree = $derived(uniqueDegreesInfo.hasAnchor);
	const canGenerateQuestion = $derived(
		uniqueDegreesCount >= 3 && (!anchorModeEnabled || hasAnchorDegree)
	);

	$effect(() => {
		if (anchorModeEnabled && !hasAnchorDegree) {
			alert(
				`Anchor degree (${degreeButtons[anchorDegree - 1]}) is not present in the selected range. Please adjust your range or anchor degree.`
			);
		}
	});
</script>

<div class="flex flex-col items-center">
	<!-- Preset Management UI -->
	<div class="mb-4 w-full max-w-xl rounded-lg bg-gray-50 p-4 dark:bg-gray-900/40">
		<h3 class="mb-2 text-lg font-semibold">Presets</h3>
		<div class="mb-2 flex flex-wrap gap-2">
			{#each presets as preset}
				<div class="flex items-center gap-1 rounded bg-gray-200 px-2 py-1 dark:bg-gray-700">
					<span class="font-medium">{preset.name}</span>
					<button
						class="ml-1 text-xs text-blue-600 hover:underline"
						onclick={() => applyPreset(preset)}>Apply</button
					>
					{#if loadedPresetName === preset.name}
						<button
							class="ml-1 text-xs text-green-600 hover:underline"
							onclick={() => updatePreset(preset.name)}>Update</button
						>
					{/if}
					<button
						class="ml-1 text-xs text-red-600 hover:underline"
						onclick={() => deletePreset(preset.name)}>Delete</button
					>
				</div>
			{/each}
		</div>
		<div class="mt-2 flex gap-2">
			<input
				type="text"
				placeholder="Preset name"
				bind:value={newPresetName}
				class="flex-1 rounded border border-gray-300 px-2 py-1 text-sm dark:bg-gray-800 dark:text-white"
			/>
			<button
				class="rounded bg-blue-500 px-3 py-1 text-sm text-white hover:bg-blue-600"
				onclick={saveCurrentPreset}>Save Preset</button
			>
		</div>
	</div>

	<!-- Game Info -->
	<div class="my-4 text-center">
		{#if anchorModeEnabled && correctAnswer !== null}
			<div class="mt-2 text-sm">
				<span
					class="rounded px-2 py-1 text-white"
					class:bg-blue-500={questionCount % anchorFrequency === 0}
					class:bg-gray-500={questionCount % anchorFrequency !== 0}
				>
					{questionCount % anchorFrequency === 0
						? `Anchor: ${degreeButtons[anchorDegree - 1]}`
						: 'Random'}
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
		</div>
		<div class="mt-2 flex items-center gap-2">
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
		{#if uniqueDegreesCount < 3}
			<div class="mt-2 text-sm text-red-600 dark:text-red-400">
				⚠️ Not enough unique degrees in selected range. Found {uniqueDegreesCount}. Select a wider
				range (at least 3 degrees).
			</div>
		{/if}
		{#if anchorModeEnabled && !hasAnchorDegree}
			<div class="mt-2 text-sm text-red-600 dark:text-red-400">
				⚠️ Selected range must include the anchor degree ({degreeButtons[anchorDegree - 1]}).
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
			<div class="flex items-center gap-2">
				<span class="text-sm">Every</span>
				<input
					type="number"
					bind:value={anchorFrequency}
					min="1"
					max="10"
					class="w-16 rounded border border-slate-200 bg-transparent px-2 py-1 text-center text-sm text-slate-700 shadow-sm transition duration-300 placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-400 focus:shadow-md focus:outline-none dark:text-slate-100"
				/>
				<span class="text-sm">questions</span>
			</div>
			<div class="text-xs text-gray-600 dark:text-gray-400">
				Every {anchorFrequency} question{anchorFrequency !== 1 ? 's' : ''} will be {degreeButtons[
					anchorDegree - 1
				]} degree
			</div>
		{/if}
	</div>

	<div class="mb-2 flex justify-center gap-2">
		<button
			onclick={toggleAllDegrees}
			class="rounded border-2 border-gray-400 bg-gray-100 px-2 py-0 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-200"
		>
			{highlightedDegrees.length === degreeButtons.length ? 'None' : 'All'}
		</button>
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
	<div>
		<div class="mt-2 flex justify-center gap-2">
			<button
				onclick={async () => {
					await initAudio();
					gameMode = 'find-degree';
					generateNewQuestion();
				}}
				class="rounded px-3 py-1 text-sm transition-colors"
				class:bg-blue-500={gameMode === 'find-degree'}
				class:text-white={gameMode === 'find-degree'}
				class:bg-gray-200={gameMode !== 'find-degree'}
				class:text-gray-700={gameMode !== 'find-degree'}
			>
				Note → Degree
			</button>
			<button
				onclick={async () => {
					await initAudio();
					gameMode = 'find-note';
					generateNewQuestion();
				}}
				class="rounded px-3 py-1 text-sm transition-colors"
				class:bg-blue-500={gameMode === 'find-note'}
				class:text-white={gameMode === 'find-note'}
				class:bg-gray-200={gameMode !== 'find-note'}
				class:text-gray-700={gameMode !== 'find-note'}
			>
				Degree → Note
			</button>
		</div>
		<h2 class="text-2xl font-semibold">
			{gameMode === 'find-degree'
				? `Find the note's degree in ${selectedKey} Major`
				: `Find the ${degreeButtons[targetDegree! - 1]} degree note in ${selectedKey} Major`}
		</h2>
	</div>
	<!-- Feedback -->
	<div class=" h-8 text-2xl font-semibold">{feedback}</div>

	<div class="w-11/12 lg:w-10/12">
		<!-- fretboard main -->
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (because of reasons) -->
		<div
			class="relative mt-12 border-l-[5px] border-r-[5px] border-gray-400"
			style:height="{(numStrings - 1) * 30}px"
			onclick={gameMode === 'find-degree'
				? () => {
						if (canGenerateQuestion) playAndNext();
					}
				: undefined}
		>
			<!-- Fret Markers -->
			<div
				class="pointer-events-none absolute left-0 top-0 w-full"
				style:height="{(numStrings - 1) * 30}px"
			>
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
						class:border-blue-500={anchorModeEnabled && questionCount % anchorFrequency === 0}
						class:bg-blue-100={anchorModeEnabled && questionCount % anchorFrequency === 0}
						class:border-black={!(anchorModeEnabled && questionCount % anchorFrequency === 0)}
						class:bg-white={!(anchorModeEnabled && questionCount % anchorFrequency === 0)}
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

			<!-- Clickable fret positions for find-note mode -->
			{#if gameMode === 'find-note'}
				<div
					class="absolute left-0 top-[-15px] z-10 w-full opacity-0"
					style:height="{(numStrings - 1) * 30}px"
				>
					{#each Array(numStrings) as _, stringIdx}
						{#each Array(numFrets) as _, fretIdx}
							<div
								class="absolute cursor-pointer border border-transparent hover:border-blue-300 hover:bg-blue-100/20"
								class:bg-red-100={true}
								style:top="calc({stringIdx} * 30px)"
								style:left="calc({fretIdx} * (100% / {numFrets}))"
								style:width="calc(100% / {numFrets})"
								style:height="30px"
								onclick={() => {
									if (canGenerateQuestion) {
										handleFretboardClick(stringIdx, fretIdx+1);
									}
								}}
							></div>
						{/each}
					{/each}
				</div>
			{/if}

			<!-- frets wrap -->
			<div
				class="absolute left-0 top-0 flex w-full justify-between"
				style:height="{(numStrings - 1) * 30}px"
			>
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
	{#if gameMode === 'find-degree'}
		<div
			class="ml-6 mt-10 flex w-11/12 flex-col gap-2 place-self-start md:place-self-center lg:ml-0 lg:w-10/12"
		>
			<!-- First row: I to VII -->
			<div class="flex justify-start gap-2 lg:justify-center">
				{#each degreeButtons as degree, i}
					<button
						onclick={() => handleAnswer(i + 1)}
						disabled={!canGenerateQuestion}
						class="w-10 rounded-lg bg-gray-200 px-1 text-lg font-bold transition-colors hover:bg-gray-300 disabled:cursor-not-allowed disabled:bg-gray-400 sm:text-2xl dark:bg-gray-700 dark:hover:bg-gray-600"
					>
						{degree}
					</button>
				{/each}
			</div>

			<!-- Second row: VII to I (reverse order) -->
			<div class="flex justify-start gap-2 lg:justify-center">
				{#each degreeButtons.slice().reverse() as degree, i}
					<button
						onclick={() => handleAnswer(degreeButtons.length - i)}
						disabled={!canGenerateQuestion}
						class="w-10 rounded-lg bg-gray-200 px-1 text-lg font-bold transition-colors hover:bg-gray-300 disabled:cursor-not-allowed disabled:bg-gray-400 sm:text-2xl dark:bg-gray-700 dark:hover:bg-gray-600"
					>
						{degree}
					</button>
				{/each}
			</div>
		</div>
	{/if}
	<div class="h-36 w-full"></div>
</div>
