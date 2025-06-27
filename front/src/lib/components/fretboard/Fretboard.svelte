<script lang="ts">
	import UiSelect from '../UiSelect.svelte';
	import * as Tone from 'tone';
	import { fretboardPresetsStore, type FretboardPreset } from '$lib/stores/fretboardStore.svelte';

	const notes = ['E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C', 'C#', 'D', 'D#'];
	const circleOfFifths = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];

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
			const openNoteIndex = notes.indexOf(convertToSharp(openNote));
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
	let fragmentModeEnabled = $state(false); // Track if fragment mode is enabled
	let betaFragmentModeEnabled = $state(false); // Track if beta fragment mode is enabled
	let deltaFragmentModeEnabled = $state(false); // Track if delta fragment mode is enabled
	let epsilonFragmentModeEnabled = $state(false); // Track if epsilon fragment mode is enabled
	let geminiFragmentModeEnabled = $state(false); // Track if gemini fragment mode is enabled
	// --- Shape Mode State ---
	let aShapeModeEnabled = $state(false);
	let cShapeModeEnabled = $state(false);
	let dShapeModeEnabled = $state(false);
	let eShapeModeEnabled = $state(false);
	let gShapeModeEnabled = $state(false);

	// Store user's last known settings
	let lastUserStringStart = $state<number>(1);
	let lastUserStringEnd = $state<number>(6);
	let lastUserFretStart = $state<number>(1);
	let lastUserFretEnd = $state<number>(12);

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

	// Update fragment drill area when key changes
	$effect(() => {
		if (fragmentModeEnabled) {
			// Recalculate fragment area when key changes
			const fragmentFretRange = calculateFragmentFretRange('alpha');
			fretRangeStart = fragmentFretRange.start;
			fretRangeEnd = fragmentFretRange.end;
		}
		if (betaFragmentModeEnabled) {
			// Recalculate beta fragment area when key changes
			const betaFragmentFretRange = calculateFragmentFretRange('beta');
			fretRangeStart = betaFragmentFretRange.start;
			fretRangeEnd = betaFragmentFretRange.end;
		}
		if (deltaFragmentModeEnabled) {
			// Recalculate delta fragment area when key changes
			const deltaFragmentFretRange = calculateFragmentFretRange('delta');
			fretRangeStart = deltaFragmentFretRange.start;
			fretRangeEnd = deltaFragmentFretRange.end;
		}
		if (epsilonFragmentModeEnabled) {
			// Recalculate epsilon fragment area when key changes
			const epsilonFragmentFretRange = calculateFragmentFretRange('epsilon');
			fretRangeStart = epsilonFragmentFretRange.start;
			fretRangeEnd = epsilonFragmentFretRange.end;
		}
		if (geminiFragmentModeEnabled) {
			// Recalculate gemini fragment area when key changes
			const geminiFragmentFretRange = calculateFragmentFretRange('gemini');
			fretRangeStart = geminiFragmentFretRange.start;
			fretRangeEnd = geminiFragmentFretRange.end;
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

	// Function to generate the correct major scale for any key
	function generateMajorScale(rootNote: string): string[] {
		// Define the major scale intervals (semitones from root)
		const majorScaleIntervals = [0, 2, 4, 5, 7, 9, 11];

		// Create a chromatic scale starting from the root note
		const chromaticScale: string[] = [];
		const allNotes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

		// Find the starting index
		let startIndex = allNotes.indexOf(rootNote);
		if (startIndex === -1) {
			// Handle flat notes by converting to sharp equivalents
			const flatToSharp: Record<string, string> = {
				Db: 'C#',
				Eb: 'D#',
				Gb: 'F#',
				Ab: 'G#',
				Bb: 'A#'
			};
			const sharpNote = flatToSharp[rootNote];
			if (sharpNote) {
				startIndex = allNotes.indexOf(sharpNote);
			}
		}

		if (startIndex === -1) {
			console.error(`Could not find note: ${rootNote}`);
			return [];
		}

		// Build chromatic scale starting from root
		for (let i = 0; i < 12; i++) {
			const noteIndex = (startIndex + i) % 12;
			chromaticScale.push(allNotes[noteIndex]);
		}

		// Apply major scale intervals
		const scale = majorScaleIntervals.map((interval: number) => chromaticScale[interval]);

		// Convert notes to proper enharmonic equivalents based on the key
		return scale.map((note) => getNoteNameWithAccidental(note));
	}

	// Get the major scale for the current key
	const currentScale = $derived(generateMajorScale(selectedKey));

	function checkValidNotesInRange(): number {
		const scaleNotes = currentScale;

		let validNotes = 0;
		for (let string = stringRangeStartIndex; string <= stringRangeEndIndex; string++) {
			for (let fret = fretRangeStart; fret <= fretRangeEnd; fret++) {
				// Add bounds checking
				if (fretboard[string] && fretboard[string][fret]) {
					const note = fretboard[string][fret];
					if (scaleNotes.includes(getNoteNameWithAccidental(note))) {
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
		// Always convert to sharp for indexOf
		return notes.indexOf(convertToSharp(selectedKey));
	}

	// Fragment cycling state
	let fragmentCycleEnabled = $state(false);
	let fragmentCycleCount = $state(5); // default cycle length
	let fragmentCycleCurrent = $state(0);
	let fragmentCycleIndex = $state(0);
	let fragmentCycleOrderType = $state<'default' | 'custom'>('default');
	const defaultFragmentCycleOrder = ['alpha', 'beta', 'delta', 'epsilon', 'gemini'];
	const customFragmentCycleOrder = ['alpha', 'delta', 'gemini', 'beta', 'epsilon'];

	function getCurrentFragmentCycleOrder() {
		return fragmentCycleOrderType === 'custom'
			? customFragmentCycleOrder
			: defaultFragmentCycleOrder;
	}

	const fragmentCycleOrder = $derived(getCurrentFragmentCycleOrder());

	function startFragmentCycle() {
		// Disable shape cycle and all shape modes
		shapeCycleEnabled = false;
		aShapeModeEnabled = false;
		cShapeModeEnabled = false;
		dShapeModeEnabled = false;
		eShapeModeEnabled = false;
		gShapeModeEnabled = false;
		fragmentCycleEnabled = true;
		fragmentCycleCurrent = 0;
		fragmentCycleIndex = 0;
		activateFragmentDrill(
			fragmentCycleOrder[fragmentCycleIndex] as 'alpha' | 'beta' | 'delta' | 'epsilon' | 'gemini'
		);
	}

	function stopFragmentCycle() {
		fragmentCycleEnabled = false;
		fragmentModeEnabled = false;
		betaFragmentModeEnabled = false;
		deltaFragmentModeEnabled = false;
		epsilonFragmentModeEnabled = false;
		geminiFragmentModeEnabled = false;
	}

	function nextFragmentCycle() {
		fragmentCycleCurrent = 0;
		fragmentCycleIndex = (fragmentCycleIndex + 1) % fragmentCycleOrder.length;
		activateFragmentDrill(
			fragmentCycleOrder[fragmentCycleIndex] as 'alpha' | 'beta' | 'delta' | 'epsilon' | 'gemini'
		);
	}

	function generateNewQuestion() {
		feedback = '';
		questionCount++;

		if (fragmentCycleEnabled) {
			fragmentCycleCurrent++;
			if (fragmentCycleCurrent > fragmentCycleCount) {
				nextFragmentCycle();
			}
		}
		if (shapeCycleEnabled) {
			shapeCycleCurrent++;
			if (shapeCycleCurrent > shapeCycleCount) {
				nextShapeCycle();
			}
		}

		if (gameMode === 'find-degree') {
			let targetDegree: number;
			const scaleNotes = currentScale;

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
							if (
								fretboard[string] &&
								convertToSharp(fretboard[string][fret]) === convertToSharp(targetNote)
							) {
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
					if (
						fretboard[string] &&
						convertToSharp(fretboard[string][fret]) === convertToSharp(targetNote)
					) {
						validPositions.push({ string, fret });
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
			const scaleNotes = currentScale;
			const wrongDegreeIndex = selectedDegree - 1; // Convert to 0-based index
			const wrongNote = scaleNotes[wrongDegreeIndex];

			// Find a valid fretboard position for the wrong note in the current practice range
			let played = false;
			for (let string = stringRangeStartIndex; string <= stringRangeEndIndex; string++) {
				for (let fret = fretRangeStart; fret <= fretRangeEnd; fret++) {
					if (
						fretboard[string] &&
						convertToSharp(fretboard[string][fret]) === convertToSharp(wrongNote)
					) {
						playNote(fretboard[string][fret]);
						played = true;
						break;
					}
				}
				if (played) break;
			}
			if (!played) {
				// fallback: play the note name (may have wrong octave)
				playNote(wrongNote);
			}

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

	let showNoteNameOnDot = $state(false);
	let highlightedDegrees = $state<number[]>([1, 2, 3, 4, 5, 6, 7]);
	let redDotDisplayMode = $state<'degrees' | 'notes' | 'empty'>('degrees');
	let showFragmentDots = $state(true); // NEW: toggle for yellow fragment dots
	let showFragmentDegrees = $state(false);

	function toggleAllDegrees() {
		if (highlightedDegrees.length === degreeButtons.length) {
			highlightedDegrees = [];
		} else {
			highlightedDegrees = degreeButtons.map((_, i) => i + 1);
		}
	}

	function shouldShowRedDot(stringIdx: number, fretIdx: number): boolean {
		if (highlightedDegrees.length === 0) return false;
		const scaleNotes = currentScale;
		const note = fretboard[stringIdx][fretIdx];
		const degree = scaleNotes.indexOf(getNoteNameWithAccidental(note)) + 1;
		return (
			highlightedDegrees.includes(degree) &&
			!(stringIdx === activeString && fretIdx === activeFret && correctAnswer !== null)
		);
	}

	function getRedDotDegreeLabel(stringIdx: number, fretIdx: number): string {
		if (redDotDisplayMode === 'empty') return '';
		if (redDotDisplayMode === 'degrees') {
			const scaleNotes = currentScale;
			const note = fretboard[stringIdx][fretIdx];
			const degree = scaleNotes.indexOf(getNoteNameWithAccidental(note)) + 1;
			return degree > 0 ? degreeButtons[degree - 1] : '';
		}
		return '';
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
			const scaleNotes = currentScale;

			const clickedNote = fretboard[stringIdx][fretIdx];
			const clickedDegree = scaleNotes.indexOf(convertToSharp(clickedNote)) + 1;

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
		const scaleNotes = currentScale;
		const foundDegrees = new Set<number>();
		let hasAnchor = false;
		for (let string = stringRangeStartIndex; string <= stringRangeEndIndex; string++) {
			for (let fret = fretRangeStart; fret <= fretRangeEnd; fret++) {
				if (fretboard[string] && fretboard[string][fret]) {
					let note = fretboard[string][fret];

					const degree = scaleNotes.indexOf(getNoteNameWithAccidental(note)) + 1;
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

	// Add fragment drill activation
	function activateFragmentDrill(fragmentName: 'alpha' | 'beta' | 'delta' | 'epsilon' | 'gemini') {
		// Disable all shape modes and shape cycle
		shapeCycleEnabled = false;
		aShapeModeEnabled = false;
		cShapeModeEnabled = false;
		dShapeModeEnabled = false;
		eShapeModeEnabled = false;
		gShapeModeEnabled = false;
		const isAlpha = fragmentName === 'alpha';
		const isBeta = fragmentName === 'beta';
		const isdelta = fragmentName === 'delta';
		const isEpsilon = fragmentName === 'epsilon';
		const isGemini = fragmentName === 'gemini';

		if (
			(isAlpha && fragmentModeEnabled) ||
			(isBeta && betaFragmentModeEnabled) ||
			(isdelta && deltaFragmentModeEnabled) ||
			(isEpsilon && epsilonFragmentModeEnabled) ||
			(isGemini && geminiFragmentModeEnabled)
		) {
			// Disable fragment mode - restore user's last known settings
			fragmentModeEnabled = false;
			betaFragmentModeEnabled = false;
			deltaFragmentModeEnabled = false;
			epsilonFragmentModeEnabled = false;
			geminiFragmentModeEnabled = false;
			stringRangeStart = lastUserStringStart;
			stringRangeEnd = lastUserStringEnd;
			fretRangeStart = lastUserFretStart;
			fretRangeEnd = lastUserFretEnd;
		} else {
			// Enable fragment mode - save current settings and set to fragment area
			fragmentModeEnabled = isAlpha;
			betaFragmentModeEnabled = isBeta;
			deltaFragmentModeEnabled = isdelta;
			epsilonFragmentModeEnabled = isEpsilon;
			geminiFragmentModeEnabled = isGemini;
			lastUserStringStart = stringRangeStart;
			lastUserStringEnd = stringRangeEnd;
			lastUserFretStart = fretRangeStart;
			lastUserFretEnd = fretRangeEnd;

			// Calculate fragment area based on current key
			// The fragment degrees should appear in strings 1-6, but frets vary by key
			stringRangeStart = 1;
			stringRangeEnd = 6;

			// Calculate the fret range where the fragment degrees appear for this key
			const fragmentFretRange = calculateFragmentFretRange(fragmentName);
			fretRangeStart = fragmentFretRange.start;
			fretRangeEnd = fragmentFretRange.end;
		}
	}

	// Calculate the fret range where the fragment degrees appear for the current key
	function calculateFragmentFretRange(
		fragmentName: 'alpha' | 'beta' | 'delta' | 'epsilon' | 'gemini'
	): { start: number; end: number } {
		// Hardcoded fret ranges for fragments in different keys
		// These are the specific areas where each fragment appears
		const alphaKeyFretRanges: Record<string, { start: number; end: number }> = {
			C: { start: 4, end: 6 },
			Db: { start: 5, end: 7 },
			D: { start: 6, end: 8 },
			Eb: { start: 7, end: 9 },
			E: { start: 8, end: 10 },
			F: { start: 9, end: 11 },
			'F#': { start: 10, end: 12 },
			G: { start: 11, end: 13 },
			Ab: { start: 12, end: 14 },
			A: { start: 1, end: 3 },
			Bb: { start: 2, end: 4 },
			B: { start: 3, end: 5 }
		};

		const betaKeyFretRanges: Record<string, { start: number; end: number }> = {
			C: { start: 7, end: 8 },
			Db: { start: 8, end: 9 },
			D: { start: 9, end: 10 },
			Eb: { start: 10, end: 11 },
			E: { start: 11, end: 12 },
			F: { start: 12, end: 13 },
			'F#': { start: 13, end: 14 },
			G: { start: 2, end: 3 },
			Ab: { start: 3, end: 4 },
			A: { start: 4, end: 5 },
			Bb: { start: 5, end: 6 },
			B: { start: 6, end: 7 }
		};

		const deltaKeyFretRanges: Record<string, { start: number; end: number }> = {
			C: { start: 9, end: 10 },
			Db: { start: 10, end: 11 },
			D: { start: 11, end: 12 },
			Eb: { start: 12, end: 13 },
			E: { start: 13, end: 14 },
			F: { start: 2, end: 3 },
			'F#': { start: 3, end: 4 },
			G: { start: 4, end: 5 },
			Ab: { start: 5, end: 6 },
			A: { start: 6, end: 7 },
			Bb: { start: 7, end: 8 },
			B: { start: 8, end: 9 }
		};

		const epsilonKeyFretRanges: Record<string, { start: number; end: number }> = {
			C: { start: 12, end: 13 },
			Db: { start: 1, end: 2 },
			D: { start: 2, end: 3 },
			Eb: { start: 3, end: 4 },
			E: { start: 4, end: 5 },
			F: { start: 5, end: 6 },
			'F#': { start: 6, end: 7 },
			G: { start: 7, end: 8 },
			Ab: { start: 8, end: 9 },
			A: { start: 9, end: 10 },
			Bb: { start: 10, end: 11 },
			B: { start: 11, end: 12 }
		};

		const geminiKeyFretRanges: Record<string, { start: number; end: number }> = {
			C: { start: 2, end: 3 },
			Db: { start: 3, end: 4 },
			D: { start: 4, end: 5 },
			Eb: { start: 5, end: 6 },
			E: { start: 6, end: 7 },
			F: { start: 7, end: 8 },
			'F#': { start: 8, end: 9 },
			G: { start: 9, end: 10 },
			Ab: { start: 10, end: 11 },
			A: { start: 11, end: 12 },
			Bb: { start: 12, end: 13 },
			B: { start: 1, end: 2 }
		};

		// Get the fret range for the current key
		const keyName = selectedKey.includes('/') ? selectedKey.split('/')[0] : selectedKey;
		const keyFretRanges =
			fragmentName === 'alpha'
				? alphaKeyFretRanges
				: fragmentName === 'beta'
					? betaKeyFretRanges
					: fragmentName === 'delta'
						? deltaKeyFretRanges
						: fragmentName === 'epsilon'
							? epsilonKeyFretRanges
							: geminiKeyFretRanges;
		const defaultRange =
			fragmentName === 'alpha'
				? { start: 4, end: 6 }
				: fragmentName === 'beta'
					? { start: 7, end: 8 }
					: fragmentName === 'delta'
						? { start: 9, end: 10 }
						: fragmentName === 'epsilon'
							? { start: 12, end: 13 }
							: { start: 2, end: 3 };
		const fretRange = keyFretRanges[keyName] || defaultRange;

		return fretRange;
	}

	// Add function to determine which fragment type a position belongs to
	function getFragmentType(
		stringIdx: number,
		fretIdx: number
	): 'alpha' | 'beta' | 'delta' | 'epsilon' | 'gemini' | 'a' | 'c' | 'd' | 'e' | 'g' | null {
		if (
			!fragmentModeEnabled &&
			!betaFragmentModeEnabled &&
			!deltaFragmentModeEnabled &&
			!epsilonFragmentModeEnabled &&
			!geminiFragmentModeEnabled &&
			!aShapeModeEnabled &&
			!cShapeModeEnabled &&
			!dShapeModeEnabled &&
			!eShapeModeEnabled &&
			!gShapeModeEnabled
		)
			return null;

		const inDrillArea =
			stringIdx + 1 >= stringRangeStart &&
			stringIdx + 1 <= stringRangeEnd &&
			fretIdx >= fretRangeStart &&
			fretIdx <= fretRangeEnd;
		if (!inDrillArea) return null;

		const scaleNotes = currentScale;
		const note = fretboard[stringIdx][fretIdx];
		const displayNote = getNoteNameWithAccidental(note);

		const fragmentDegrees = [6, 2, 5, 7, 1, 3, 4, 6];
		const betaFragmentDegrees = [7, 3, 6, 1, 2, 4, 5, 7];
		const deltaFragmentDegrees = [1, 2, 3, 4, 5, 6, 7, 1];
		const epsilonFragmentDegrees = [2, 3, 4, 5, 6, 7, 1, 2];
		const geminiFragmentDegrees = [1, 2, 3, 4, 5, 6, 7, 1];

		const fragmentNotes = fragmentDegrees.map((degree) => scaleNotes[degree - 1]);
		const betaFragmentNotes = betaFragmentDegrees.map((degree) => scaleNotes[degree - 1]);
		const deltaFragmentNotes = deltaFragmentDegrees.map((degree) => scaleNotes[degree - 1]);
		const epsilonFragmentNotes = epsilonFragmentDegrees.map((degree) => scaleNotes[degree - 1]);
		const geminiFragmentNotes = geminiFragmentDegrees.map((degree) => scaleNotes[degree - 1]);

		if (fragmentModeEnabled && fragmentNotes.includes(displayNote)) return 'alpha';
		if (betaFragmentModeEnabled && betaFragmentNotes.includes(displayNote)) return 'beta';
		if (deltaFragmentModeEnabled && deltaFragmentNotes.includes(displayNote)) return 'delta';
		if (epsilonFragmentModeEnabled && epsilonFragmentNotes.includes(displayNote)) return 'epsilon';
		if (geminiFragmentModeEnabled && geminiFragmentNotes.includes(displayNote)) return 'gemini';

		// Shape logic: highlight if in either fragment's notes
		if (aShapeModeEnabled && (fragmentNotes.includes(displayNote) || betaFragmentNotes.includes(displayNote))) return 'a';
		if (cShapeModeEnabled && (betaFragmentNotes.includes(displayNote) || deltaFragmentNotes.includes(displayNote))) return 'c';
		if (dShapeModeEnabled && (deltaFragmentNotes.includes(displayNote) || epsilonFragmentNotes.includes(displayNote))) return 'd';
		if (eShapeModeEnabled && (epsilonFragmentNotes.includes(displayNote) || geminiFragmentNotes.includes(displayNote))) return 'e';
		if (gShapeModeEnabled && (geminiFragmentNotes.includes(displayNote) || fragmentNotes.includes(displayNote))) return 'g';

		return null;
	}

	// Add a single global highlightedFragmentDegrees state:
	let highlightedFragmentDegrees = $state<number[]>([1, 2, 3, 4, 5, 6, 7]);

	function toggleAllFragmentDegrees() {
		if (highlightedFragmentDegrees.length === degreeButtons.length) {
			highlightedFragmentDegrees = [];
		} else {
			highlightedFragmentDegrees = degreeButtons.map((_, i) => i + 1);
		}
	}

	// Update shouldShowYellowDot to use highlightedFragmentDegrees
	function shouldShowYellowDot(stringIdx: number, fretIdx: number): boolean {
		if (!showFragmentDots) return false;
		if (
			!fragmentModeEnabled &&
			!betaFragmentModeEnabled &&
			!deltaFragmentModeEnabled &&
			!epsilonFragmentModeEnabled &&
			!geminiFragmentModeEnabled &&
			!aShapeModeEnabled &&
			!cShapeModeEnabled &&
			!dShapeModeEnabled &&
			!eShapeModeEnabled &&
			!gShapeModeEnabled
		)
			return false;
		const inDrillArea =
			stringIdx + 1 >= stringRangeStart &&
			stringIdx + 1 <= stringRangeEnd &&
			fretIdx >= fretRangeStart &&
			fretIdx <= fretRangeEnd;
		if (!inDrillArea) return false;
		const scaleNotes = currentScale;
		const note = fretboard[stringIdx][fretIdx];
		const displayNote = getNoteNameWithAccidental(note);
		const fragmentDegrees = [6, 2, 5, 7, 1, 3, 4, 6];
		const betaFragmentDegrees = [7, 3, 6, 1, 2, 4, 5, 7];
		const deltaFragmentDegrees = [1, 2, 3, 4, 5, 6, 7, 1];
		const epsilonFragmentDegrees = [2, 3, 4, 5, 6, 7, 1, 2];
		const geminiFragmentDegrees = [1, 2, 3, 4, 5, 6, 7, 1];
		const fragmentNotes = fragmentDegrees.map((degree) => scaleNotes[degree - 1]);
		const betaFragmentNotes = betaFragmentDegrees.map((degree) => scaleNotes[degree - 1]);
		const deltaFragmentNotes = deltaFragmentDegrees.map((degree) => scaleNotes[degree - 1]);
		const epsilonFragmentNotes = epsilonFragmentDegrees.map((degree) => scaleNotes[degree - 1]);
		const geminiFragmentNotes = geminiFragmentDegrees.map((degree) => scaleNotes[degree - 1]);
		if (fragmentModeEnabled) {
			return fragmentNotes.some(
				(n, i) =>
					displayNote === n &&
					highlightedFragmentDegrees.includes(((fragmentDegrees[i] - 1 + 7) % 7) + 1)
			);
		}
		if (betaFragmentModeEnabled) {
			return betaFragmentNotes.some(
				(n, i) =>
					displayNote === n &&
					highlightedFragmentDegrees.includes(((betaFragmentDegrees[i] - 1 + 7) % 7) + 1)
			);
		}
		if (deltaFragmentModeEnabled) {
			return deltaFragmentNotes.some(
				(n, i) =>
					displayNote === n &&
					highlightedFragmentDegrees.includes(((deltaFragmentDegrees[i] - 1 + 7) % 7) + 1)
			);
		}
		if (epsilonFragmentModeEnabled) {
			return epsilonFragmentNotes.some(
				(n, i) =>
					displayNote === n &&
					highlightedFragmentDegrees.includes(((epsilonFragmentDegrees[i] - 1 + 7) % 7) + 1)
			);
		}
		if (geminiFragmentModeEnabled) {
			return geminiFragmentNotes.some(
				(n, i) =>
					displayNote === n &&
					highlightedFragmentDegrees.includes(((geminiFragmentDegrees[i] - 1 + 7) % 7) + 1)
			);
		}
		// Shape logic: highlight if in either fragment's notes
		if (aShapeModeEnabled) {
			return (
				fragmentNotes.some((n, i) => displayNote === n && highlightedFragmentDegrees.includes(((fragmentDegrees[i] - 1 + 7) % 7) + 1)) ||
				betaFragmentNotes.some((n, i) => displayNote === n && highlightedFragmentDegrees.includes(((betaFragmentDegrees[i] - 1 + 7) % 7) + 1))
			);
		}
		if (cShapeModeEnabled) {
			return (
				betaFragmentNotes.some((n, i) => displayNote === n && highlightedFragmentDegrees.includes(((betaFragmentDegrees[i] - 1 + 7) % 7) + 1)) ||
				deltaFragmentNotes.some((n, i) => displayNote === n && highlightedFragmentDegrees.includes(((deltaFragmentDegrees[i] - 1 + 7) % 7) + 1))
			);
		}
		if (dShapeModeEnabled) {
			return (
				deltaFragmentNotes.some((n, i) => displayNote === n && highlightedFragmentDegrees.includes(((deltaFragmentDegrees[i] - 1 + 7) % 7) + 1)) ||
				epsilonFragmentNotes.some((n, i) => displayNote === n && highlightedFragmentDegrees.includes(((epsilonFragmentDegrees[i] - 1 + 7) % 7) + 1))
			);
		}
		if (eShapeModeEnabled) {
			return (
				epsilonFragmentNotes.some((n, i) => displayNote === n && highlightedFragmentDegrees.includes(((epsilonFragmentDegrees[i] - 1 + 7) % 7) + 1)) ||
				geminiFragmentNotes.some((n, i) => displayNote === n && highlightedFragmentDegrees.includes(((geminiFragmentDegrees[i] - 1 + 7) % 7) + 1))
			);
		}
		if (gShapeModeEnabled) {
			return (
				geminiFragmentNotes.some((n, i) => displayNote === n && highlightedFragmentDegrees.includes(((geminiFragmentDegrees[i] - 1 + 7) % 7) + 1)) ||
				fragmentNotes.some((n, i) => displayNote === n && highlightedFragmentDegrees.includes(((fragmentDegrees[i] - 1 + 7) % 7) + 1))
			);
		}
		return false;
	}

	// Add a getFragmentDotDegreeLabel function:
	function getFragmentDotDegreeLabel(stringIdx: number, fretIdx: number): string {
		if (!showFragmentDegrees) return '';
		const scaleNotes = currentScale;
		const note = fretboard[stringIdx][fretIdx];
		const displayNote = getNoteNameWithAccidental(note);
		let fragmentDegrees: number[] = [];
		if (fragmentModeEnabled) fragmentDegrees = [6, 2, 5, 7, 1, 3, 4, 6];
		else if (betaFragmentModeEnabled) fragmentDegrees = [7, 3, 6, 1, 2, 4, 5, 7];
		else if (deltaFragmentModeEnabled) fragmentDegrees = [1, 2, 3, 4, 5, 6, 7, 1];
		else if (epsilonFragmentModeEnabled) fragmentDegrees = [2, 3, 4, 5, 6, 7, 1, 2];
		else if (geminiFragmentModeEnabled) fragmentDegrees = [1, 2, 3, 4, 5, 6, 7, 1];
		else if (aShapeModeEnabled) fragmentDegrees = [6, 2, 5, 7, 1, 3, 4, 6, 7, 3, 6, 1, 2, 4, 5, 7];
		else if (cShapeModeEnabled) fragmentDegrees = [7, 3, 6, 1, 2, 4, 5, 7, 1, 2, 3, 4, 5, 6, 7, 1];
		else if (dShapeModeEnabled) fragmentDegrees = [1, 2, 3, 4, 5, 6, 7, 1, 2, 3, 4, 5, 6, 7, 1, 2];
		else if (eShapeModeEnabled) fragmentDegrees = [2, 3, 4, 5, 6, 7, 1, 2, 1, 2, 3, 4, 5, 6, 7, 1];
		else if (gShapeModeEnabled) fragmentDegrees = [1, 2, 3, 4, 5, 6, 7, 1, 6, 2, 5, 7, 1, 3, 4, 6];
		const fragmentNotes = fragmentDegrees.map((degree) => scaleNotes[degree - 1]);
		for (let i = 0; i < fragmentNotes.length; i++) {
			if (displayNote === fragmentNotes[i]) {
				const degreeIdx = ((fragmentDegrees[i] - 1 + 7) % 7);
				return degreeButtons[degreeIdx];
			}
		}
		return '';
	}

	// Auto-next question feature
	let autoNextEnabled = $state(false);
	let autoNextDelay = $state(2000); // ms, default 2 seconds
	let autoNextTimeout: ReturnType<typeof setTimeout> | null = null;
	let autoNextRunning = $state(false); // NEW: running state

	function clearAutoNextTimer() {
		if (autoNextTimeout) {
			clearTimeout(autoNextTimeout);
			autoNextTimeout = null;
		}
	}

	function startAutoNextTimer() {
		clearAutoNextTimer();
		if (autoNextEnabled && autoNextRunning) {
			autoNextTimeout = setTimeout(() => {
				autoNextPlayAndNext();
			}, autoNextDelay) as unknown as ReturnType<typeof setTimeout>;
		}
	}

	function handleAutoNextStartStop() {
		autoNextRunning = !autoNextRunning;
		if (autoNextRunning) {
			startAutoNextTimer();
		} else {
			clearAutoNextTimer();
		}
	}

	// Clear timer on destroy
	import { onDestroy } from 'svelte';
	onDestroy(() => {
		clearAutoNextTimer();
	});

	// Patch generateNewQuestion and playAndNext to use timer
	function autoNextGenerateNewQuestion() {
		clearAutoNextTimer();
		generateNewQuestion();
		startAutoNextTimer();
	}

	function autoNextPlayAndNext() {
		clearAutoNextTimer();
		playAndNext();
		startAutoNextTimer();
	}

	$effect(() => {
		if (!autoNextEnabled && autoNextRunning) {
			autoNextRunning = false;
			clearAutoNextTimer();
		}
	});

	// Add shape drill activation
	function activateShapeDrill(shapeName: 'a' | 'c' | 'd' | 'e' | 'g') {
		// Disable all fragment modes and fragment cycle
		fragmentCycleEnabled = false;
		fragmentModeEnabled = false;
		betaFragmentModeEnabled = false;
		deltaFragmentModeEnabled = false;
		epsilonFragmentModeEnabled = false;
		geminiFragmentModeEnabled = false;
		const isA = shapeName === 'a';
		const isC = shapeName === 'c';
		const isD = shapeName === 'd';
		const isE = shapeName === 'e';
		const isG = shapeName === 'g';

		if (
			(isA && aShapeModeEnabled) ||
			(isC && cShapeModeEnabled) ||
			(isD && dShapeModeEnabled) ||
			(isE && eShapeModeEnabled) ||
			(isG && gShapeModeEnabled)
		) {
			// Disable shape mode - restore user's last known settings
			aShapeModeEnabled = false;
			cShapeModeEnabled = false;
			dShapeModeEnabled = false;
			eShapeModeEnabled = false;
			gShapeModeEnabled = false;
			stringRangeStart = lastUserStringStart;
			stringRangeEnd = lastUserStringEnd;
			fretRangeStart = lastUserFretStart;
			fretRangeEnd = lastUserFretEnd;
		} else {
			// Enable shape mode - save current settings and set to shape area
			aShapeModeEnabled = isA;
			cShapeModeEnabled = isC;
			dShapeModeEnabled = isD;
			eShapeModeEnabled = isE;
			gShapeModeEnabled = isG;
			lastUserStringStart = stringRangeStart;
			lastUserStringEnd = stringRangeEnd;
			lastUserFretStart = fretRangeStart;
			lastUserFretEnd = fretRangeEnd;

			// Shapes always use all 6 strings
			stringRangeStart = 1;
			stringRangeEnd = 6;

			// Calculate the fret range for the shape
			const shapeFretRange = calculateShapeFretRange(shapeName);
			fretRangeStart = shapeFretRange.start;
			fretRangeEnd = shapeFretRange.end;
		}
	}

	// Calculate the fret range for a shape (union of two fragments)
	function calculateShapeFretRange(shapeName: 'a' | 'c' | 'd' | 'e' | 'g'): { start: number; end: number } {
		const frag = {
			alpha: calculateFragmentFretRange('alpha'),
			beta: calculateFragmentFretRange('beta'),
			delta: calculateFragmentFretRange('delta'),
			epsilon: calculateFragmentFretRange('epsilon'),
			gemini: calculateFragmentFretRange('gemini'),
		};
		if (shapeName === 'a') {
			// Alpha + Beta
			return { start: Math.min(frag.alpha.start, frag.beta.start), end: Math.max(frag.alpha.end, frag.beta.end) };
		} else if (shapeName === 'c') {
			// Beta + Delta
			return { start: Math.min(frag.beta.start, frag.delta.start), end: Math.max(frag.beta.end, frag.delta.end) };
		} else if (shapeName === 'd') {
			// Delta + Epsilon
			return { start: Math.min(frag.delta.start, frag.epsilon.start), end: Math.max(frag.delta.end, frag.epsilon.end) };
		} else if (shapeName === 'e') {
			// Epsilon + Gemini
			return { start: Math.min(frag.epsilon.start, frag.gemini.start), end: Math.max(frag.epsilon.end, frag.gemini.end) };
		} else if (shapeName === 'g') {
			// Gemini + Alpha
			return { start: Math.min(frag.gemini.start, frag.alpha.start), end: Math.max(frag.gemini.end, frag.alpha.end) };
		}
		return { start: 1, end: 3 };
	}

	// --- Shape Cycle State ---
	let shapeCycleEnabled = $state(false);
	let shapeCycleCount = $state(5); // default cycle length
	let shapeCycleCurrent = $state(0);
	let shapeCycleIndex = $state(0);
	const shapeCycleOrder = ['a', 'c', 'd', 'e', 'g'];

	function startShapeCycle() {
		// Disable fragment cycle and all fragment modes
		fragmentCycleEnabled = false;
		fragmentModeEnabled = false;
		betaFragmentModeEnabled = false;
		deltaFragmentModeEnabled = false;
		epsilonFragmentModeEnabled = false;
		geminiFragmentModeEnabled = false;
		shapeCycleEnabled = true;
		shapeCycleCurrent = 0;
		shapeCycleIndex = 0;
		activateShapeDrill(shapeCycleOrder[shapeCycleIndex] as 'a' | 'c' | 'd' | 'e' | 'g');
	}

	function stopShapeCycle() {
		shapeCycleEnabled = false;
		aShapeModeEnabled = false;
		cShapeModeEnabled = false;
		dShapeModeEnabled = false;
		eShapeModeEnabled = false;
		gShapeModeEnabled = false;
	}

	function nextShapeCycle() {
		shapeCycleCurrent = 0;
		shapeCycleIndex = (shapeCycleIndex + 1) % shapeCycleOrder.length;
		activateShapeDrill(shapeCycleOrder[shapeCycleIndex] as 'a' | 'c' | 'd' | 'e' | 'g');
	}

	// Helper to determine current mode
	function getCurrentMode() {
		if (aShapeModeEnabled || cShapeModeEnabled || dShapeModeEnabled || eShapeModeEnabled || gShapeModeEnabled) return 'shape';
		if (fragmentModeEnabled || betaFragmentModeEnabled || deltaFragmentModeEnabled || epsilonFragmentModeEnabled || geminiFragmentModeEnabled) return 'fragment';
		return 'none';
	}

	function handleAutoCycle() {
		const mode = getCurrentMode();
		if (mode === 'shape') {
			startShapeCycle();
		} else {
			startFragmentCycle();
		}
	}

	// Add derived variable and setter for cycle count input
	let autoCycleCount = $derived(fragmentCycleEnabled ? fragmentCycleCount : shapeCycleCount);
	function setAutoCycleCount(val: number) {
		if (fragmentCycleEnabled) fragmentCycleCount = val;
		else shapeCycleCount = val;
	}
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
				autoNextGenerateNewQuestion();
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
					autoNextPlayAndNext();
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
	{#if !fragmentModeEnabled && !betaFragmentModeEnabled && !deltaFragmentModeEnabled && !epsilonFragmentModeEnabled && !geminiFragmentModeEnabled}
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
	{/if}

	<!-- Toggle for note name on dot -->
	<div class="mb-2 flex justify-center">
		<label class="flex cursor-pointer select-none items-center gap-2">
			<input type="checkbox" bind:checked={showNoteNameOnDot} class="accent-blue-500" />
			<span class="text-sm">Show note name on dot</span>
		</label>
	</div>

	<!-- Red dot display options -->
	<div class="mb-2 flex justify-center gap-4">
		<label class="flex cursor-pointer select-none items-center gap-2">
			<input type="radio" bind:group={redDotDisplayMode} value="degrees" class="accent-red-500" />
			<span class="text-sm">Show degrees</span>
		</label>
		<label class="flex cursor-pointer select-none items-center gap-2">
			<input type="radio" bind:group={redDotDisplayMode} value="notes" class="accent-red-500" />
			<span class="text-sm">Show notes</span>
		</label>
		<label class="flex cursor-pointer select-none items-center gap-2">
			<input type="radio" bind:group={redDotDisplayMode} value="empty" class="accent-red-500" />
			<span class="text-sm">Show empty</span>
		</label>
	</div>
	<!-- Toggle for yellow fragment dots -->
	<div class="mb-2 flex justify-center">
		<label class="flex cursor-pointer select-none items-center gap-2">
			<input type="checkbox" bind:checked={showFragmentDegrees} class="accent-yellow-500" />
			<span class="text-sm">Show yellow fragment Degrees</span>
		</label>
	</div>
	<!-- Auto-next question toggle and delay -->
	<div class="mb-2 flex justify-center gap-4 items-center">
		<label class="flex cursor-pointer select-none items-center gap-2">
			<input type="checkbox" bind:checked={autoNextEnabled} class="accent-blue-500" />
			<span class="text-sm">Auto Next Question</span>
		</label>
		<label class="flex items-center gap-2">
			<span class="text-sm">Delay:</span>
			<input 
				type="range" 
				min="300" 
				max="2000" 
				step="100" 
				bind:value={autoNextDelay} 
				class="w-32 accent-blue-500"
			/>
			<span class="text-sm font-medium w-12 text-center">{autoNextDelay}</span>
			<span class="text-sm">ms</span>
		</label>
		<button
			onclick={handleAutoNextStartStop}
			disabled={!autoNextEnabled}
			class="rounded bg-blue-500 px-3 py-1 text-white hover:bg-blue-600 disabled:bg-gray-400"
		>
			{autoNextRunning ? 'Stop' : 'Start'}
		</button>
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
					autoNextGenerateNewQuestion();
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
					autoNextGenerateNewQuestion();
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
						if (canGenerateQuestion) autoNextPlayAndNext();
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
								{#if redDotDisplayMode === 'degrees'}
									{getRedDotDegreeLabel(stringIdx, fretIdx)}
								{:else if redDotDisplayMode === 'notes'}
									{getNoteNameWithAccidental(fretboard[stringIdx][fretIdx])}
								{/if}
							</div>
						{/if}
					{/each}
				{/each}
				<!-- Yellow dots for fragment area -->
				{#each Array(tuning.length) as _, stringIdx}
					{#each Array(numFrets + 1) as _, fretIdx}
						{#if shouldShowYellowDot(stringIdx, fretIdx)}
							{@const fragmentType = getFragmentType(stringIdx, fretIdx)}
							<div
								class="absolute flex h-[16px] w-[16px] items-center justify-center rounded-full border-2 sm:h-[20px] sm:w-[20px] md:h-[24px] md:w-[24px] lg:h-[28px] lg:w-[28px]"
								class:border-yellow-600={fragmentType === 'alpha'}
								class:bg-yellow-500={fragmentType === 'alpha'}
								class:border-orange-400={fragmentType === 'beta'}
								class:bg-orange-600={fragmentType === 'beta'}
								class:border-green-600={fragmentType === 'delta'}
								class:bg-green-500={fragmentType === 'delta'}
								class:border-purple-600={fragmentType === 'epsilon'}
								class:bg-purple-500={fragmentType === 'epsilon'}
								class:border-teal-600={fragmentType === 'gemini'}
								class:bg-teal-500={fragmentType === 'gemini'}
								style:top="calc({stringIdx} * 30px - 10px)"
								style:left="calc(({fretIdx} - 0.5) * (100% / {numFrets}) - 8px)"
							>
								<span class="text-[12px] text-black">{getFragmentDotDegreeLabel(stringIdx, fretIdx)}</span>
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
										handleFretboardClick(stringIdx, fretIdx + 1);
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

	<div class="flex h-56 w-full flex-col items-center">
		<p>Quick Fragments</p>

		{#if gameMode === 'find-degree'}
			<div class="mt-2 flex justify-center gap-2">
				<button
					onclick={() => activateFragmentDrill('alpha')}
					class="rounded px-3 py-1 text-sm transition-colors"
					class:bg-yellow-500={fragmentModeEnabled}
					class:text-white={fragmentModeEnabled}
					class:bg-gray-200={!fragmentModeEnabled}
					class:text-gray-700={!fragmentModeEnabled}
					class:hover:bg-yellow-600={fragmentModeEnabled}
					class:hover:bg-gray-300={!fragmentModeEnabled}
				>
					Alpha
				</button>
				<button
					onclick={() => activateFragmentDrill('beta')}
					class="rounded px-3 py-1 text-sm transition-colors"
					class:bg-orange-500={betaFragmentModeEnabled}
					class:text-white={betaFragmentModeEnabled}
					class:bg-gray-200={!betaFragmentModeEnabled}
					class:text-gray-700={!betaFragmentModeEnabled}
					class:hover:bg-orange-600={betaFragmentModeEnabled}
					class:hover:bg-gray-300={!betaFragmentModeEnabled}
				>
					Beta
				</button>
				<button
					onclick={() => activateFragmentDrill('delta')}
					class="rounded px-3 py-1 text-sm transition-colors"
					class:bg-green-500={deltaFragmentModeEnabled}
					class:text-white={deltaFragmentModeEnabled}
					class:bg-gray-200={!deltaFragmentModeEnabled}
					class:text-gray-700={!deltaFragmentModeEnabled}
					class:hover:bg-green-600={deltaFragmentModeEnabled}
					class:hover:bg-gray-300={!deltaFragmentModeEnabled}
				>
					Delta
				</button>
				<button
					onclick={() => activateFragmentDrill('epsilon')}
					class="rounded px-3 py-1 text-sm transition-colors"
					class:bg-purple-500={epsilonFragmentModeEnabled}
					class:text-white={epsilonFragmentModeEnabled}
					class:bg-gray-200={!epsilonFragmentModeEnabled}
					class:text-gray-700={!epsilonFragmentModeEnabled}
					class:hover:bg-purple-600={epsilonFragmentModeEnabled}
					class:hover:bg-gray-300={!epsilonFragmentModeEnabled}
				>
					Epsilon
				</button>
				<button
					onclick={() => activateFragmentDrill('gemini')}
					class="rounded px-3 py-1 text-sm transition-colors"
					class:bg-teal-500={geminiFragmentModeEnabled}
					class:text-white={geminiFragmentModeEnabled}
					class:bg-gray-200={!geminiFragmentModeEnabled}
					class:text-gray-700={!geminiFragmentModeEnabled}
					class:hover:bg-teal-600={geminiFragmentModeEnabled}
					class:hover:bg-gray-300={!geminiFragmentModeEnabled}
				>
					Gemini
				</button>
			</div>
			<!-- Shape buttons -->
			<div class="mt-2 flex justify-center gap-2">
				<button
					onclick={() => activateShapeDrill('a')}
					class="rounded px-3 py-1 text-sm transition-colors"
					class:bg-pink-500={aShapeModeEnabled}
					class:text-white={aShapeModeEnabled}
					class:bg-gray-200={!aShapeModeEnabled}
					class:text-gray-700={!aShapeModeEnabled}
					class:hover:bg-pink-600={aShapeModeEnabled}
					class:hover:bg-gray-300={!aShapeModeEnabled}
				>
					A Shape
				</button>
				<button
					onclick={() => activateShapeDrill('c')}
					class="rounded px-3 py-1 text-sm transition-colors"
					class:bg-cyan-500={cShapeModeEnabled}
					class:text-white={cShapeModeEnabled}
					class:bg-gray-200={!cShapeModeEnabled}
					class:text-gray-700={!cShapeModeEnabled}
					class:hover:bg-cyan-600={cShapeModeEnabled}
					class:hover:bg-gray-300={!cShapeModeEnabled}
				>
					C Shape
				</button>
				<button
					onclick={() => activateShapeDrill('d')}
					class="rounded px-3 py-1 text-sm transition-colors"
					class:bg-lime-500={dShapeModeEnabled}
					class:text-white={dShapeModeEnabled}
					class:bg-gray-200={!dShapeModeEnabled}
					class:text-gray-700={!dShapeModeEnabled}
					class:hover:bg-lime-600={dShapeModeEnabled}
					class:hover:bg-gray-300={!dShapeModeEnabled}
				>
					D Shape
				</button>
				<button
					onclick={() => activateShapeDrill('e')}
					class="rounded px-3 py-1 text-sm transition-colors"
					class:bg-fuchsia-500={eShapeModeEnabled}
					class:text-white={eShapeModeEnabled}
					class:bg-gray-200={!eShapeModeEnabled}
					class:text-gray-700={!eShapeModeEnabled}
					class:hover:bg-fuchsia-600={eShapeModeEnabled}
					class:hover:bg-gray-300={!eShapeModeEnabled}
				>
					E Shape
				</button>
				<button
					onclick={() => activateShapeDrill('g')}
					class="rounded px-3 py-1 text-sm transition-colors"
					class:bg-indigo-500={gShapeModeEnabled}
					class:text-white={gShapeModeEnabled}
					class:bg-gray-200={!gShapeModeEnabled}
					class:text-gray-700={!gShapeModeEnabled}
					class:hover:bg-indigo-600={gShapeModeEnabled}
					class:hover:bg-gray-300={!gShapeModeEnabled}
				>
					G Shape
				</button>
			</div>
			<!-- Shape cycle controls -->
			<div class="mt-2 flex flex-wrap justify-center gap-2">
				<label class="flex items-center gap-2">
					<input type="checkbox" checked={fragmentCycleEnabled || shapeCycleEnabled} onchange={() => { if (!fragmentCycleEnabled && !shapeCycleEnabled) { handleAutoCycle(); } else { stopFragmentCycle(); stopShapeCycle(); } }} />
					<span class="text-sm">Auto Cycle</span>
				</label>
				<input
					type="number"
					min="1"
					bind:value={autoCycleCount}
					oninput={(e: Event) => setAutoCycleCount(Number((e.target as HTMLInputElement).value))}
					class="w-16 rounded border border-gray-400 px-2 py-1 text-sm dark:text-black"
					placeholder="Cycle N"
				/>
				<button
					onclick={handleAutoCycle}
					disabled={fragmentCycleEnabled || shapeCycleEnabled}
					class="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
				>
					Auto Cycle
				</button>
				{#if shapeCycleEnabled}
					<div class="ml-2 text-sm text-indigo-700 dark:text-indigo-300">
						Cycling: {shapeCycleOrder[shapeCycleIndex].toUpperCase()} Shape
						(shape {shapeCycleIndex + 1} of {shapeCycleOrder.length}), {shapeCycleCurrent}/{shapeCycleCount} questions
						<button
							onclick={stopShapeCycle}
							class="ml-2 rounded bg-red-500 px-2 py-1 text-xs text-white"
						>
							Stop
						</button>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Add fragment degree toggles below the fragment buttons -->
</div>
