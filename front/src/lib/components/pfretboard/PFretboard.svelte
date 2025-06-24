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
		if (isAudioLoading) return; // Prevent multiple simultaneous loads
		if (isAudioInitialized) return;
		
		isAudioLoading = true;
		try {
			await Tone.start();
			sampler = new Tone.Sampler({
				urls: {
					C4: 'C4.mp3',
					'D#4': 'Ds4.mp3',
					'F#4': 'Fs4.mp3'
				},
				release: 1,
				baseUrl: 'https://tonejs.github.io/audio/salamander/'
			}).toDestination();
			
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
			sampler.triggerAttackRelease(noteToPlay, '8n');
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
	let showNoteNameOnDot = $state(true);
	let showDegreeOnRedDots = $state(true);
	let showDegreeOnYellowDots = $state(true);
	let selectedTone = $state('C');
	let highlightedDegrees = $state<number[]>([1, 2, 3, 4, 5, 6, 7]);
	let selectedExercise = $state('maj6/7');
	let selectedVocalRange = $state('Baritone/Tenor (G3)');
	let playInVocalRange = $state(false);

	// Exercise playing state
	let isPlaying = $state(false);
	let currentPosition = $state(0);
	let currentString = $state(0);
	let currentFret = $state(0);

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

	// Major scale intervals (in semitones from root)
	const majorScaleIntervals = [0, 2, 4, 5, 7, 9, 11];

	// Compute the major scale notes for the selected key
	function getMajorScale(root: string): string[] {
		const rootIdx = notes.indexOf(root);
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
		if (!exercise || !exercise[stringIdx]) return false;
		
		const note = fretboard[stringIdx][fretIdx];
		const degree = scaleNotes.indexOf(note) + 1;
		const targetDegrees = exercise[5 - stringIdx];
		
		return targetDegrees.includes(degree);
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

	// Find the fret position for a given degree on a given string
	function findFretForDegree(stringIdx: number, degree: number): number {
		for (let fret = 0; fret <= numFrets; fret++) {
			const note = fretboard[stringIdx][fret];
			const noteDegree = scaleNotes.indexOf(note) + 1;
			if (noteDegree === degree) {
				return fret;
			}
		}
		return 0; // fallback to open string
	}

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
		
		// Flatten the exercise into a sequence of [stringIdx, degree] pairs
		const sequence: Array<{stringIdx: number, degree: number}> = [];
		exercise.forEach((degrees, exerciseIdx) => {
			const stringIdx = 5 - exerciseIdx; // Reverse the indexing
			degrees.forEach(degree => {
				sequence.push({stringIdx, degree});
			});
		});
		
		// Play the sequence
		for (let i = 0; i < sequence.length; i++) {
			if (!isPlaying) break; // Stop if exercise was stopped
			
			const {stringIdx, degree} = sequence[i];
			currentString = stringIdx;
			currentFret = findFretForDegree(stringIdx, degree);
			currentPosition = i;
			
			// Play the note
			const note = fretboard[stringIdx][currentFret];
			playNote(note, stringIdx, currentFret);
			
			// Wait 1 second
			await new Promise(resolve => setTimeout(resolve, 1000));
		}
		
		// Exercise finished
		isPlaying = false;
		currentPosition = 0;
	}

	function stopExercise() {
		isPlaying = false;
		currentPosition = 0;
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
		<select bind:value={selectedTone} class="rounded w-14 dark:text-black border px-2 py-1 text-sm">
			{#each notes as note}
				<option value={note}>{note}</option>
			{/each}
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
	<!-- Play controls -->
	<div class="mb-4 flex gap-2">
		<button
			onclick={startExercise}
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
	<!-- Feedback placeholder -->
	<div class="h-8 text-2xl font-semibold"></div>
	<div class="w-11/12 lg:w-10/12">
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
							class="absolute text-slate-800 flex h-[16px] z-10 w-[16px] items-center justify-center rounded-full border-2 border-yellow-600 bg-yellow-400 text-xs font-bold  sm:h-[20px] sm:w-[20px] md:h-[24px] md:w-[24px] lg:h-[28px] lg:w-[28px]"
							style:top="calc({stringIdx} * 30px - 10px)"
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
							style:top="calc({stringIdx} * 30px - 10px)"
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
	<div class="mt-6">
		<button class="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600" disabled>
			Restart
		</button>
	</div>
</div>
