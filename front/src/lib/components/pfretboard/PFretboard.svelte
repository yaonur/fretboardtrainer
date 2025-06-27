<script lang="ts">
	import * as Tone from 'tone';
	import { exercises } from './practices';

	// Only support guitar
	const tuning = ['E', 'B', 'G', 'D', 'A', 'E']; // Standard tuning from high E to low E
	const numStrings = 6;
	const numFrets = 15;
	const degreeButtons = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
	const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

	// Audio setup
	let sampler: Tone.Sampler;
	let isAudioInitialized = false;
	let isAudioLoading = false;

	async function initAudio() {
		console.log("initing audio")
		if (isAudioLoading) return; // Prevent multiple simultaneous loads
		if (isAudioInitialized) return;
		
		isAudioLoading = true;
		try {
			sampler = new Tone.Sampler({
				urls: {
					C4: 'C4.mp3',
					
				},
				release: 1,
				baseUrl: 'https://tonejs.github.io/audio/salamander/'
			}).toDestination();
			await Tone.start();
			
			// Give the sampler a moment to load
			await new Promise(resolve => setTimeout(resolve, 100));
			
			isAudioInitialized = true;
			isAudioLoading = false;
		} catch (error) {
			isAudioLoading = false;
			console.error('Failed to initialize audio:', error);
			throw error;
		}
	}

	function getBestOctave(noteName: string): number {
		const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
		const lowestNoteName = lowestNote.slice(0, -1);
		const lowestOctave = parseInt(lowestNote.slice(-1));
		const targetNoteIndex = noteNames.indexOf(noteName);
		const lowestNoteIndex = noteNames.indexOf(lowestNoteName);
		if (targetNoteIndex === -1 || lowestNoteIndex === -1) return 4;
		if (targetNoteIndex < lowestNoteIndex) return lowestOctave + 1;
		return lowestOctave;
	}

	function playNote(note: string, stringIdx?: number, fretIdx?: number) {
		if (!isAudioInitialized || !sampler) {
			console.warn('Audio not initialized, cannot play note');
			return;
		}
		
		let noteToPlay: string;
		
		if (playInVocalRange) {
			// Play in vocal range
			const bestOctave = getBestOctave(note);
			noteToPlay = note + bestOctave;
		} else {
			// Play at actual fretboard position
			if (stringIdx !== undefined && fretIdx !== undefined) {
				// Calculate the actual octave based on string and fret position
				const openNote = tuning[stringIdx];
				const openNoteIndex = notes.indexOf(openNote);
				const actualNoteIndex = (openNoteIndex + fretIdx) % notes.length;
				const actualNote = notes[actualNoteIndex];
				
				// Calculate octave based on string (standard guitar tuning)
				let baseOctave: number;
				if (stringIdx === 0) baseOctave = 4; // Treble E (E4)
				else if (stringIdx === 1) baseOctave = 3; // B (B3)
				else if (stringIdx === 2) baseOctave = 3; // G (G3)
				else if (stringIdx === 3) baseOctave = 3; // D (D3)
				else if (stringIdx === 4) baseOctave = 2; // A (A2)
				else if (stringIdx === 5) baseOctave = 2; // Bass E (E2)
				else baseOctave = 3; // fallback
				
				// Calculate the total semitones from the open string
				// We need to account for the fact that the note might have wrapped around the octave
				const totalSemitones = openNoteIndex + fretIdx;
				const octaveOffset = Math.floor(totalSemitones / 12);
				const finalOctave = baseOctave + octaveOffset;
				
				noteToPlay = actualNote + finalOctave;
			} else {
				// Fallback to vocal range if no position provided
				const bestOctave = getBestOctave(note);
				noteToPlay = note + bestOctave;
			}
		}
		
		try {
			sampler.triggerAttackRelease(noteToPlay, getNoteDuration());
		} catch (error) {
			console.error('Failed to play note:', noteToPlay, error);
		}
	}

	const fretboard = tuning.map((openNote) => {
		const openNoteIndex = notes.indexOf(openNote);
		const stringNotes: string[] = [];
		for (let fret = 0; fret <= numFrets; fret++) {
			const noteIndex = (openNoteIndex + fret) % notes.length;
			stringNotes.push(notes[noteIndex]);
		}
		return stringNotes;
	});

	// UI state
	let showNoteNameOnDot = $state(false);
	let showDegreeOnRedDots = $state(true);
	let showDegreeOnYellowDots = $state(true);
	let selectedTone = $state('C');
	let highlightedDegrees = $state<number[]>([1, 2, 3, 4, 5, 6, 7]);
	let selectedDegrees = $state<number[]>([1, 2, 3, 4, 5, 6, 7]); // Degrees to play in exercise
	let selectedExercise = $state('maj6/7 skipping');
	let selectedVocalRange = $state('Baritone/Tenor (G3)');
	let playInVocalRange = $state(false);

	// Exercise playing state
	let isPlaying = $state(false);
	let currentPosition = $state(0);
	let currentString = $state(0);
	let currentFret = $state(0);
	let currentShift = $state(0);
	let bpm = $state(120); // Beats per minute
	let stringDirection = $state('bass-to-treble'); // 'bass-to-treble', 'treble-to-bass', or 'both'
	let playBackwards = $state(false); // Play treble to bass instead of bass to treble
	let loopEnabled = $state(false); // Enable looping after finishing all degrees

	// Vocal range options
	const vocalRanges = [
		{ name: 'Bass', note: 'B1' },
		{ name: 'Low Bass', note: 'C2' },
		{ name: 'Bass', note: 'D2' },
		{ name: 'Bass', note: 'E2' },
		{ name: 'Bass', note: 'F2' },
		{ name: 'Bass', note: 'G2' },
		{ name: 'Bass', note: 'A2' },
		{ name: 'Bass', note: 'B2' },
		{ name: 'Baritone', note: 'C3' },
		{ name: 'Baritone', note: 'D3' },
		{ name: 'Baritone', note: 'E3' },
		{ name: 'Baritone', note: 'F3' },
		{ name: 'Baritone/Tenor', note: 'G3' },
		{ name: 'Tenor', note: 'A3' },
		{ name: 'Tenor', note: 'B3' },
		{ name: 'Tenor/Alto', note: 'C4' }
	];

	const lowestNote = $derived(selectedVocalRange.split('(')[1]?.split(')')[0] || 'G3');

	function toggleAllDegrees() {
		if (highlightedDegrees.length === degreeButtons.length) {
			highlightedDegrees = [];
		} else {
			highlightedDegrees = degreeButtons.map((_, i) => i + 1);
		}
	}

	function toggleSelectedDegrees() {
		if (selectedDegrees.length === degreeButtons.length) {
			selectedDegrees = [1]; // Keep at least 1 degree selected
		} else {
			selectedDegrees = degreeButtons.map((_, i) => i + 1);
		}
	}

	function toggleDegreeForPlaying(degree: number) {
		if (selectedDegrees.includes(degree)) {
			// Only allow removal if there's more than 1 degree selected
			if (selectedDegrees.length > 1) {
				selectedDegrees = selectedDegrees.filter(d => d !== degree);
			}
		} else {
			selectedDegrees = [...selectedDegrees, degree];
		}
	}

	// Major scale intervals (in semitones from root)
	const majorScaleIntervals = [0, 2, 4, 5, 7, 9, 11];

	// Add flat-to-sharp conversion helper
	function flatToSharp(note: string): string {
		const map: Record<string, string> = {
			'Db': 'C#',
			'Eb': 'D#',
			'Gb': 'F#',
			'Ab': 'G#',
			'Bb': 'A#',
		};
		return map[note] || note;
	}

	// Update getMajorScale to use flatToSharp
	function getMajorScale(root: string): string[] {
		const sharpRoot = flatToSharp(root);
		const rootIdx = notes.indexOf(sharpRoot);
		if (rootIdx === -1) return [];
		return majorScaleIntervals.map(i => notes[(rootIdx + i) % 12]);
	}

	const scaleNotes = $derived(getMajorScale(selectedTone));

	function shouldShowRedDot(stringIdx: number, fretIdx: number): boolean {
		if (highlightedDegrees.length === 0) return false;
		const note = fretboard[stringIdx][fretIdx];
		const degree = scaleNotes.indexOf(note) + 1;
		return highlightedDegrees.includes(degree) && degree > 0;
	}

	function shouldShowYellowDot(stringIdx: number, fretIdx: number): boolean {
		const exercise = exercises[selectedExercise as keyof typeof exercises];
		if (!exercise || !exercise.structure || !exercise.structure[stringIdx]) return false;
		
		const note = fretboard[stringIdx][fretIdx];
		const degree = scaleNotes.indexOf(note) + 1;
		
		// Show yellow dots only for the current shift being played
		const shiftedStructure = exercise.structure.map(stringDegrees => 
			stringDegrees.map(d => {
				if (d === 0) return 0;
				return ((d + currentShift - 1) % 7) + 1;
			})
		);
		
		const targetDegrees = shiftedStructure[5 - stringIdx];
		return targetDegrees && targetDegrees.includes(degree);
	}

	function shouldShowWhiteDot(stringIdx: number, fretIdx: number): boolean {
		return isPlaying && stringIdx === currentString && fretIdx === currentFret;
	}

	function getRedDotDegreeLabel(stringIdx: number, fretIdx: number): string {
		const note = fretboard[stringIdx][fretIdx];
		const degree = scaleNotes.indexOf(note) + 1;
		return degree > 0 ? degreeButtons[degree - 1] : '';
	}

	function getYellowDotDegreeLabel(stringIdx: number, fretIdx: number): string {
		const note = fretboard[stringIdx][fretIdx];
		const degree = scaleNotes.indexOf(note) + 1;
		return degree > 0 ? degreeButtons[degree - 1] : '';
	}

	function isRootString(stringIdx: number): boolean {
		const exercise = exercises[selectedExercise as keyof typeof exercises];
		return exercise && 'rootString' in exercise && (exercise.rootString-1) === stringIdx;
	}

	function isThirdString(stringIdx: number): boolean {
		const exercise = exercises[selectedExercise as keyof typeof exercises];
		return exercise && 'thirdString' in exercise && (exercise.thirdString-1) === stringIdx;
	}

	function isFifthString(stringIdx: number): boolean {
		const exercise = exercises[selectedExercise as keyof typeof exercises];
		return exercise && 'fifthString' in exercise && (exercise.fifthString-1) === stringIdx;
	}

	function isSeventhString(stringIdx: number): boolean {
		const exercise = exercises[selectedExercise as keyof typeof exercises];
		return exercise && 'seventhString' in exercise && (exercise.seventhString-1) === stringIdx;
	}

	// Find the best chord position that minimizes splits across all strings
	function findBestChordPosition(shiftedStructure: number[][]): { [stringIdx: number]: { [degree: number]: number } } {
		const exercise = exercises[selectedExercise as keyof typeof exercises];
		const bassString = exercise?.bassString || 5;
		
		// Get all the degrees that need to be played
		const degreesToPlay: Array<{stringIdx: number, degree: number}> = [];
		shiftedStructure.forEach((stringDegrees, exerciseIdx) => {
			const stringIdx = 5 - exerciseIdx;
			stringDegrees.forEach(degree => {
				if (degree > 0) {
					degreesToPlay.push({stringIdx, degree});
				}
			});
		});
		
		// Find all possible fret positions for each degree on each string
		const allPositions: { [stringIdx: number]: { [degree: number]: number[] } } = {};
		degreesToPlay.forEach(({stringIdx, degree}) => {
			if (!allPositions[stringIdx]) allPositions[stringIdx] = {};
			if (!allPositions[stringIdx][degree]) allPositions[stringIdx][degree] = [];
			
			for (let fret = 0; fret <= numFrets; fret++) {
				const note = fretboard[stringIdx][fret];
				const noteDegree = scaleNotes.indexOf(note) + 1;
				if (noteDegree === degree) {
					allPositions[stringIdx][degree].push(fret);
				}
			}
		});
		
		// Find the best combination that minimizes the spread
		let bestPositions: { [stringIdx: number]: { [degree: number]: number } } = {};
		let minSpread = Infinity;
		
		// Try different combinations of positions
		function tryCombinations(currentPositions: { [stringIdx: number]: { [degree: number]: number } }, remainingDegrees: Array<{stringIdx: number, degree: number}>) {
			if (remainingDegrees.length === 0) {
				// Calculate the spread of this combination
				const allFrets: number[] = [];
				Object.values(currentPositions).forEach(degreePositions => {
					Object.values(degreePositions).forEach(fret => {
						allFrets.push(fret);
					});
				});
				
				if (allFrets.length === 0) return;
				
				const minFret = Math.min(...allFrets);
				const maxFret = Math.max(...allFrets);
				const spread = maxFret - minFret;
				
				// Prefer positions that keep the bass string in lower frets if it's the bass string
				let score = spread;
				if (currentPositions[bassString]) {
					const bassFrets = Object.values(currentPositions[bassString]);
					const maxBassFret = Math.max(...bassFrets);
					if (maxBassFret > 8) {
						score += 10; // Penalty for high bass position
					}
				}
				
				if (score < minSpread) {
					minSpread = score;
					bestPositions = JSON.parse(JSON.stringify(currentPositions)); // Deep copy
				}
				return;
			}
			
			const {stringIdx, degree} = remainingDegrees[0];
			const positions = allPositions[stringIdx][degree];
			
			for (const fret of positions) {
				if (!currentPositions[stringIdx]) currentPositions[stringIdx] = {};
				currentPositions[stringIdx][degree] = fret;
				tryCombinations(currentPositions, remainingDegrees.slice(1));
			}
		}
		
		tryCombinations({}, degreesToPlay);
		return bestPositions;
	}

	// Find the fret position for a given degree on a given string
	function findFretForDegree(stringIdx: number, degree: number): number {
		// This function will be updated to use the chord-aware positioning
		const exercise = exercises[selectedExercise as keyof typeof exercises];
		const bassString = exercise?.bassString || 5;
		
		// For now, use a simple approach that prefers reasonable positions
		for (let fret = 0; fret <= numFrets; fret++) {
			const note = fretboard[stringIdx][fret];
			const noteDegree = scaleNotes.indexOf(note) + 1;
			if (noteDegree === degree) {
				// Prefer positions that are not too extreme
				if (fret <= 12 || (stringIdx === bassString && fret <= 8)) {
					return fret;
				}
			}
		}
		
		// Fallback to any position
		for (let fret = 0; fret <= numFrets; fret++) {
			const note = fretboard[stringIdx][fret];
			const noteDegree = scaleNotes.indexOf(note) + 1;
			if (noteDegree === degree) {
				return fret;
			}
		}
		
		return 0;
	}

	// --- Key Cycle State ---
	let keyCycleEnabled = $state(false);
	type KeyCycleDirection = 'forward' | 'backward';
	let keyCycleDirection = $state<KeyCycleDirection>('forward');

	const circleOfFifths = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];

	function getCurrentKeyIndex() {
		return circleOfFifths.indexOf(selectedTone);
	}
	function nextKey() {
		const idx = getCurrentKeyIndex();
		selectedTone = circleOfFifths[(idx + 1) % circleOfFifths.length];
	}
	function prevKey() {
		const idx = getCurrentKeyIndex();
		selectedTone = circleOfFifths[(idx - 1 + circleOfFifths.length) % circleOfFifths.length];
	}

	// Add state for number of cycles before changing key
	let keyCycleNumCycles = $state(1); // default 1

	// Restore the original startExercise function
	async function startExercise() {
		if (isPlaying) return;
		try {
			await initAudio();
		} catch (error) {
			console.error('Failed to initialize audio for exercise:', error);
			alert('Failed to load audio. Please try again.');
			return;
		}
		isPlaying = true;
		currentPosition = 0;
		const exercise = exercises[selectedExercise as keyof typeof exercises];
		if (!exercise) return;
		do {
			const degreesToPlay = selectedDegrees;
			for (let shiftIndex = 0; shiftIndex < degreesToPlay.length; shiftIndex++) {
				if (!isPlaying) break;
				const shift = degreesToPlay[shiftIndex] - 1;
				currentShift = shift;
				const shiftedStructure = exercise.structure.map(stringDegrees => 
					stringDegrees.map(degree => {
						if (degree === 0) return 0;
						return ((degree + shift - 1) % 7) + 1;
					})
				);
				const bestPositions = findBestChordPosition(shiftedStructure);
				const sequence: Array<{stringIdx: number, degree: number}> = [];
				shiftedStructure.forEach((degrees, exerciseIdx) => {
					const stringIdx = 5 - exerciseIdx;
					degrees.forEach((degree) => {
						if (degree > 0) {
							sequence.push({stringIdx, degree});
						}
					});
				});
				if (stringDirection === 'bass-to-treble' || stringDirection === 'both') {
					for (let i = 0; i < sequence.length; i++) {
						if (!isPlaying) break;
						const {stringIdx, degree} = sequence[i];
						currentString = stringIdx;
						currentFret = bestPositions[stringIdx][degree] || findFretForDegree(stringIdx, degree);
						currentPosition = shiftIndex * 100 + i;
						const note = fretboard[stringIdx][currentFret];
						playNote(note, stringIdx, currentFret);
						const beatDuration = 60 / bpm;
						const waitTime = beatDuration * 1000;
						await new Promise(resolve => setTimeout(resolve, waitTime));
					}
				}
				if (stringDirection === 'treble-to-bass' || stringDirection === 'both') {
					for (let i = sequence.length - 1; i >= 0; i--) {
						if (!isPlaying) break;
						const {stringIdx, degree} = sequence[i];
						currentString = stringIdx;
						currentFret = bestPositions[stringIdx][degree] || findFretForDegree(stringIdx, degree);
						currentPosition = shiftIndex * 100 + sequence.length + (sequence.length - 1 - i);
						const note = fretboard[stringIdx][currentFret];
						playNote(note, stringIdx, currentFret);
						const beatDuration = 60 / bpm;
						const waitTime = beatDuration * 1000;
						await new Promise(resolve => setTimeout(resolve, waitTime));
					}
				}
			}
		} while (isPlaying && loopEnabled);
		isPlaying = false;
		currentPosition = 0;
		currentShift = 0;
	}

	// Re-add startExerciseWithKeyCycle for key auto-cycle
	async function startExerciseWithKeyCycle() {
		await initAudio();
		isPlaying = true;
		currentPosition = 0;
		const exercise = exercises[selectedExercise as keyof typeof exercises];
		if (!exercise) return;
		let cyclesDone = 0;
		do {
			const degreesToPlay = selectedDegrees;
			for (let shiftIndex = 0; shiftIndex < degreesToPlay.length; shiftIndex++) {
				if (!isPlaying) break;
				const shift = degreesToPlay[shiftIndex] - 1;
				currentShift = shift;
				const shiftedStructure = exercise.structure.map(stringDegrees => 
					stringDegrees.map(degree => {
						if (degree === 0) return 0;
						return ((degree + shift - 1) % 7) + 1;
					})
				);
				const bestPositions = findBestChordPosition(shiftedStructure);
				const sequence: Array<{stringIdx: number, degree: number}> = [];
				shiftedStructure.forEach((degrees, exerciseIdx) => {
					const stringIdx = 5 - exerciseIdx;
					degrees.forEach((degree) => {
						if (degree > 0) {
							sequence.push({stringIdx, degree});
						}
					});
				});
				if (stringDirection === 'bass-to-treble' || stringDirection === 'both') {
					for (let i = 0; i < sequence.length; i++) {
						if (!isPlaying) break;
						const {stringIdx, degree} = sequence[i];
						currentString = stringIdx;
						currentFret = bestPositions[stringIdx][degree] || findFretForDegree(stringIdx, degree);
						currentPosition = shiftIndex * 100 + i;
						const note = fretboard[stringIdx][currentFret];
						playNote(note, stringIdx, currentFret);
						const beatDuration = 60 / bpm;
						const waitTime = beatDuration * 1000;
						await new Promise(resolve => setTimeout(resolve, waitTime));
					}
				}
				if (stringDirection === 'treble-to-bass' || stringDirection === 'both') {
					for (let i = sequence.length - 1; i >= 0; i--) {
						if (!isPlaying) break;
						const {stringIdx, degree} = sequence[i];
						currentString = stringIdx;
						currentFret = bestPositions[stringIdx][degree] || findFretForDegree(stringIdx, degree);
						currentPosition = shiftIndex * 100 + sequence.length + (sequence.length - 1 - i);
						const note = fretboard[stringIdx][currentFret];
						playNote(note, stringIdx, currentFret);
						const beatDuration = 60 / bpm;
						const waitTime = beatDuration * 1000;
						await new Promise(resolve => setTimeout(resolve, waitTime));
					}
				}
			}
			cyclesDone++;
			if (cyclesDone >= keyCycleNumCycles) {
				if (keyCycleDirection === 'forward') nextKey();
				else prevKey();
				cyclesDone = 0;
			}
		} while (isPlaying && loopEnabled);
		isPlaying = false;
		currentPosition = 0;
		currentShift = 0;
	}

	function stopExercise() {
		isPlaying = false;
		currentPosition = 0;
		currentShift = 0;
	}

	// Calculate note duration from BPM (quarter note = 1 beat)
	function getNoteDuration(): string {
		// Convert BPM to duration in seconds
		const beatDuration = 60 / bpm; // seconds per beat
		const noteDuration = beatDuration * 0.5; // half note duration
		return noteDuration.toString();
	}
</script>

<div class="flex flex-col items-center">
	<h2 class="text-2xl font-semibold mb-4">Guitar Degree Practice</h2>
	<div class="mb-2 flex justify-center">
		<label class="flex cursor-pointer select-none items-center gap-2">
			<input type="checkbox" bind:checked={showNoteNameOnDot} class="accent-blue-500" />
			<span class="text-sm">Show note name (unchecked = show degree)</span>
		</label>
	</div>
	<!-- Degree label toggle -->
	<div class="mb-2 flex justify-center">
		<label class="flex cursor-pointer select-none items-center gap-2">
			<input type="checkbox" bind:checked={showDegreeOnRedDots} class="accent-red-500" />
			<span class="text-sm">Show degree name in red dots</span>
		</label>
	</div>
	<!-- Yellow dots degree label toggle -->
	<div class="mb-2 flex justify-center">
		<label class="flex cursor-pointer select-none items-center gap-2">
			<input type="checkbox" bind:checked={showDegreeOnYellowDots} class="accent-yellow-500" />
			<span class="text-sm">Show degree name in yellow dots</span>
		</label>
	</div>
	<!-- Exercise selection -->
	<div class="mb-4 flex items-center gap-2">
		<span class="text-sm">Exercise:</span>
		<select bind:value={selectedExercise} class="rounded w-42 dark:text-slate-800 border px-2 py-1 text-sm">
			{#each Object.keys(exercises) as exerciseKey}
				<option value={exerciseKey}>{exerciseKey}</option>
			{/each}
		</select>
	</div>
	<!-- Tone selection -->
	<div class="mb-4 flex items-center gap-2">
		<span class="text-sm">Select Key:</span>
		<button title="Previous Key" class="rounded border px-2 py-1 text-sm font-bold hover:bg-gray-200" onclick={prevKey}>&lt;</button>
		<select bind:value={selectedTone} class="rounded w-14 dark:text-black border px-2 py-1 text-sm">
			{#each circleOfFifths as note}
				<option value={note}>{note}</option>
			{/each}
		</select>
	</div>
	<div class="flex mb-2">
		<button
			onclick={() => { keyCycleEnabled = !keyCycleEnabled; }}
			class="rounded bg-blue-500 px-2 py-1 text-sm text-white hover:bg-blue-600 ml-2"
		>
			{keyCycleEnabled ? 'Stop Cycle' : 'Auto Cycle'}
		</button>
		<input
			type="range"
			min="1"
			max="30"
			step="1"
			bind:value={keyCycleNumCycles}
			class="w-24 accent-blue-500 ml-1"
			title="Cycles before key change"
		/>
		<span class="text-xs w-8 text-center">{keyCycleNumCycles}</span>
		<select bind:value={keyCycleDirection} class="rounded dark:text-slate-900 border w-10 px-1 py-1 text-xs ml-1">
			<option value={'forward'}>→</option>
			<option value={'backward'}>←</option>
		</select>
	</div>
	<!-- Vocal range selection -->
	<div class="mb-4  flex items-center gap-2">
		<span class="text-sm">Vocal Range:</span>
		<select bind:value={selectedVocalRange} class="dark:text-slate-800 rounded border px-2 py-1 text-sm">
			{#each vocalRanges as range}
				<option value="{range.name} ({range.note})">{range.name} ({range.note})</option>
			{/each}
		</select>
	</div>
	<!-- Play notes in vocal range toggle -->
	<div class="mb-4 flex items-center gap-2">
		<label class="flex cursor-pointer select-none items-center gap-2">
			<input type="checkbox" bind:checked={playInVocalRange} class="accent-green-500" />
			<span class="text-sm">Play notes in vocal range</span>
		</label>
	</div>
	<!-- BPM control -->
	<div class="mb-4 flex items-center gap-4">
		<span class="text-sm font-semibold">BPM:</span>
		<input 
			type="range" 
			min="40" 
			max="400" 
			step="5" 
			bind:value={bpm} 
			class="w-32 accent-blue-500"
		/>
		<input 
			type="number" 
			min="40" 
			max="400" 
			bind:value={bpm} 
			class="w-16 rounded border px-2 py-1 text-sm dark:text-slate-800"
		/>
	</div>
	<!-- Loop and direction controls -->
	<div class="mb-4 flex items-center gap-4">
		<span class="text-sm font-semibold">Direction</span>
		<select bind:value={stringDirection} class="rounded w-32 border px-2 py-1 text-sm dark:text-slate-800">
			<option value="bass-to-treble">Bass to Treble</option>
			<option value="treble-to-bass">Treble to Bass</option>
			<option value="both">Both Directions</option>
		</select>
		<label class="flex cursor-pointer select-none items-center gap-2">
			<input type="checkbox" bind:checked={loopEnabled} class="accent-green-500" />
			<span class="text-sm">Loop</span>
		</label>
	</div>
	<!-- Play controls -->
	<div class="mb-4 flex gap-2">
		<button
			onclick={keyCycleEnabled ? startExerciseWithKeyCycle : startExercise}
			disabled={isPlaying}
			class="rounded bg-green-500 px-4 py-2 text-white hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
		>
			{isPlaying ? 'Playing...' : 'Start Exercise'}
		</button>
		{#if isPlaying}
			<button
				onclick={stopExercise}
				class="rounded bg-red-500 px-4 py-2 text-white hover:bg-red-600"
			>
				Stop
			</button>
		{/if}
	</div>
	<!-- Red degree buttons -->
	<div class="mb-2 flex justify-center gap-2">
		<span class="text-sm font-semibold text-gray-700">Show Degrees:</span>
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
	<!-- Selected degrees for playing -->
	<div class="mb-2 flex justify-center gap-2">
		<span class="text-sm font-semibold text-gray-700">Play Degrees:</span>
		<button
			onclick={toggleSelectedDegrees}
			class="rounded border-2 border-blue-400 bg-blue-100 px-2 py-0 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-200"
		>
			{selectedDegrees.length === degreeButtons.length ? 'All' : `${selectedDegrees.length} selected`}
		</button>
		{#each degreeButtons as degree, i}
			<button
				onclick={() => toggleDegreeForPlaying(i + 1)}
				class="rounded border-2 px-2 py-0 text-lg font-bold transition-colors"
				class:bg-blue-600={selectedDegrees.includes(i + 1)}
				class:text-white={selectedDegrees.includes(i + 1)}
				class:border-blue-600={selectedDegrees.includes(i + 1)}
				class:bg-gray-200={!selectedDegrees.includes(i + 1)}
				class:text-blue-600={!selectedDegrees.includes(i + 1)}
				class:border-gray-300={!selectedDegrees.includes(i + 1)}
			>
				{degree}
			</button>
		{/each}
	</div>
	<!-- Color legend -->
	<div class="mb-4 flex justify-center gap-4 text-sm">
		<div class="flex items-center gap-2">
			<div class="h-4 w-4 rounded-full border-2 border-blue-600 bg-blue-400"></div>
			<span class="text-gray-700">Root</span>
		</div>
		<div class="flex items-center gap-2">
			<div class="h-4 w-4 rounded-full border-2 border-green-600 bg-green-400"></div>
			<span class="text-gray-700">Third</span>
		</div>
		<div class="flex items-center gap-2">
			<div class="h-4 w-4 rounded-full border-2 border-purple-600 bg-purple-400"></div>
			<span class="text-gray-700">Fifth</span>
		</div>
		<div class="flex items-center gap-2">
			<div class="h-4 w-4 rounded-full border-2 border-teal-600 bg-teal-400"></div>
			<span class="text-gray-700">Seventh</span>
		</div>
		<div class="flex items-center gap-2">
			<div class="h-4 w-4 rounded-full border-2 border-yellow-600 bg-yellow-400"></div>
			<span class="text-gray-700">Other</span>
		</div>
	</div>
	<!-- Feedback placeholder -->
	<div class="h-8 text-2xl font-semibold"></div>
	<div class="w-full flex justify-center mb-2">
		<span class="text-lg font-bold">Current Key: <span class="text-blue-700">{selectedTone}</span></span>
	</div>
	<div class="w-11/12 lg:w-10/12 h-64 ">
		<!-- Fretboard main -->
		<div
			class="relative mt-12 border-l-[5px] border-r-[5px] border-gray-400"
			style:height="{(numStrings - 1) * 30}px"
		>
			<!-- White dot for current playing note -->
			{#if isPlaying}
				<div
					class="absolute flex h-[20px] w-[20px] items-center justify-center rounded-full border-2 border-white bg-white text-xs font-bold text-black sm:h-[25px] sm:w-[25px] md:h-[30px] md:w-[30px] lg:h-[35px] lg:w-[35px] z-20"
					style:top="calc({currentString} * 30px - 12.5px)"
					style:left="calc(({currentFret} - 0.5) * (100% / {numFrets}) - 12.5px)"
				>
					<span class="text-sm sm:text-lg md:text-xl lg:text-2xl">
						{showNoteNameOnDot 
							? fretboard[currentString][currentFret]
							: (() => {
								const note = fretboard[currentString][currentFret];
								const degree = scaleNotes.indexOf(note) + 1;
								return degree > 0 ? degreeButtons[degree - 1] : '';
							})()
						}
					</span>
				</div>
			{/if}
			<!-- Yellow dots for exercise -->
			{#each Array(tuning.length) as _, stringIdx}
				{#each Array(numFrets + 1) as _, fretIdx}
					{#if shouldShowYellowDot(stringIdx, fretIdx)}
						<div
							class="absolute text-slate-800 flex h-[16px] z-10 w-[16px] items-center justify-center rounded-full border-2 text-xs font-bold sm:h-[20px] sm:w-[20px] md:h-[24px] md:w-[24px] lg:h-[28px] lg:w-[28px]"
							class:border-yellow-600={!isRootString(stringIdx) && !isThirdString(stringIdx) && !isFifthString(stringIdx) && !isSeventhString(stringIdx)}
							class:bg-yellow-400={!isRootString(stringIdx) && !isThirdString(stringIdx) && !isFifthString(stringIdx) && !isSeventhString(stringIdx)}
							class:border-blue-600={isRootString(stringIdx)}
							class:bg-blue-400={isRootString(stringIdx)}
							class:border-green-600={isThirdString(stringIdx)}
							class:bg-green-400={isThirdString(stringIdx)}
							class:border-purple-600={isFifthString(stringIdx)}
							class:bg-purple-400={isFifthString(stringIdx)}
							class:border-teal-600={isSeventhString(stringIdx)}
							class:bg-teal-400={isSeventhString(stringIdx)}
							style:top="calc({stringIdx} * 30px - 12.5px)"
							style:left="calc(({fretIdx} - 0.5) * (100% / {numFrets}) - 8px)"
						>
							{showDegreeOnYellowDots ? getYellowDotDegreeLabel(stringIdx, fretIdx) : ''}
						</div>
					{/if}
				{/each}
			{/each}
			<!-- Red dots for selected degrees in the selected key -->
			{#each Array(tuning.length) as _, stringIdx}
				{#each Array(numFrets + 1) as _, fretIdx}
					{#if shouldShowRedDot(stringIdx, fretIdx)}
						<div
							class="absolute flex h-[16px] w-[16px] items-center justify-center rounded-full border-2 border-red-600 bg-red-500 text-xs font-bold text-white opacity-80 sm:h-[20px] sm:w-[20px] md:h-[24px] md:w-[24px] lg:h-[28px] lg:w-[28px]"
							style:top="calc({stringIdx} * 30px - 12.5px)"
							style:left="calc(({fretIdx} - 0.5) * (100% / {numFrets}) - 8px)"
						>
							{showDegreeOnRedDots ? getRedDotDegreeLabel(stringIdx, fretIdx) : ''}
						</div>
					{/if}
				{/each}
			{/each}
			<!-- strings wrap -->
			<div>
				{#each { length: numStrings - 1 } as _, i}
					<div class="h-[30px] border-b border-gray-400" class:border-t={i === 0}></div>
				{/each}
			</div>
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
	<!-- Restart button placeholder -->
	
</div>
