<script lang="ts">
	import * as Tone from 'tone';

	const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
	const circleOfFifths = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
	const degreeButtons = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

	// Game state
	let selectedKey = $state('C');
	let lowestNote = $state<string>('G3'); // User's lowest note as reference
	let selectedDegrees = $state<number[]>([1, 2, 3, 4, 5, 6, 7]);
	let correctAnswer = $state<number | null>(null);
	let feedback = $state('');
	let questionCount = $state(0);
	let gameStarted = $state(false);
	let isAudioInitialized = $state(false);
	let sampler: Tone.Sampler;

	// Audio setup
	async function initAudio() {
		if (!isAudioInitialized) {
			await Tone.start();
			
			// Create a sampler with piano-like samples
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

	// Generate major scale for any key
	function generateMajorScale(rootNote: string): string[] {
		const majorScaleIntervals = [0, 2, 4, 5, 7, 9, 11];
		const allNotes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

		let startIndex = allNotes.indexOf(rootNote);
		if (startIndex === -1) {
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

		const chromaticScale: string[] = [];
		for (let i = 0; i < 12; i++) {
			const noteIndex = (startIndex + i) % 12;
			chromaticScale.push(allNotes[noteIndex]);
		}

		return majorScaleIntervals.map((interval: number) => chromaticScale[interval]);
	}

	// Get the major scale for the current key
	const currentScale = $derived(generateMajorScale(selectedKey));

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
			sampler.triggerAttackRelease(note + bestOctave, '2n');
		}
	}

	// Generate a new question
	function generateNewQuestion() {
		if (selectedDegrees.length === 0) {
			feedback = 'Please select at least one degree to practice.';
			return;
		}

		feedback = '';
		questionCount++;

		// Select a random degree from the selected degrees
		const randomDegreeIndex = Math.floor(Math.random() * selectedDegrees.length);
		const targetDegree = selectedDegrees[randomDegreeIndex];
		correctAnswer = targetDegree;

		// Get the note for this degree
		const targetNote = currentScale[targetDegree - 1];
		
		// Play the note
		setTimeout(() => {
			playNote(targetNote);
		}, 500);

		feedback = `Question ${questionCount}: Listen to the note and identify its degree in ${selectedKey} Major...`;
	}

	// Handle answer
	function handleAnswer(selectedDegree: number) {
		if (correctAnswer === null) {
			feedback = 'Start the game first.';
			return;
		}

		if (selectedDegree === correctAnswer) {
			feedback = `Correct! That was the ${degreeButtons[correctAnswer - 1]} degree (${currentScale[correctAnswer - 1]}) in ${selectedKey} Major.`;
		} else {
			feedback = `Incorrect. That was the ${degreeButtons[correctAnswer - 1]} degree (${currentScale[correctAnswer - 1]}) in ${selectedKey} Major.`;
		}

		// Play the correct note again
		const correctNote = currentScale[correctAnswer - 1];
		setTimeout(() => {
			playNote(correctNote);
		}, 1000);

		// Generate new question after a delay
		setTimeout(() => {
			generateNewQuestion();
		}, 3000);
	}

	// Toggle all degrees
	function toggleAllDegrees() {
		if (selectedDegrees.length === degreeButtons.length) {
			selectedDegrees = [];
		} else {
			selectedDegrees = degreeButtons.map((_, i) => i + 1);
		}
	}

	// Navigate to previous/next key
	function prevKey() {
		const idx = circleOfFifths.indexOf(selectedKey);
		selectedKey = circleOfFifths[(idx - 1 + circleOfFifths.length) % circleOfFifths.length];
	}

	function nextKey() {
		const idx = circleOfFifths.indexOf(selectedKey);
		selectedKey = circleOfFifths[(idx + 1) % circleOfFifths.length];
	}

	// Start the game
	async function startGame() {
		await initAudio();
		questionCount = 0;
		generateNewQuestion();
		gameStarted = true;
	}

	// Replay the current note
	async function replayNote() {
		if (correctAnswer !== null) {
			await initAudio();
			const correctNote = currentScale[correctAnswer - 1];
			playNote(correctNote);
		}
	}
</script>

<div class="flex flex-col items-center p-6">
	<h1 class="mb-8 text-3xl font-bold">Listening Practice</h1>
	
	<!-- Settings Panel -->
	<div class="mb-8 w-full max-w-2xl rounded-lg bg-gray-50 p-6 dark:bg-gray-800">
		<h2 class="mb-4 text-xl font-semibold">Settings</h2>
		
		<!-- Key Selection -->
		<div class="mb-4 flex items-center gap-4">
			<label class="text-sm font-medium">Key:</label>
			<button
				title="Previous Key"
				class="rounded border px-2 py-1 text-sm font-bold hover:bg-gray-200 dark:hover:bg-gray-700"
				onclick={prevKey}>&lt;</button
			>
			<select
				bind:value={selectedKey}
				class="rounded border border-gray-300 bg-white px-3 py-1 text-sm dark:bg-gray-700 dark:text-white"
			>
				{#each circleOfFifths as note}
					<option value={note}>{note}</option>
				{/each}
			</select>
			<button
				title="Next Key"
				class="rounded border px-2 py-1 text-sm font-bold hover:bg-gray-200 dark:hover:bg-gray-700"
				onclick={nextKey}>&gt;</button
			>
		</div>

		<!-- Lowest Note Selection -->
		<div class="mb-4 flex items-center gap-4">
			<label class="text-sm font-medium">Lowest Note:</label>
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

		<!-- Degree Selection -->
		<div class="mb-4">
			<label class="mb-2 block text-sm font-medium">Degrees to Practice:</label>
			<div class="flex flex-wrap gap-2">
				<button
					onclick={toggleAllDegrees}
					class="rounded border-2 border-gray-400 bg-gray-100 px-3 py-1 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-200"
				>
					{selectedDegrees.length === degreeButtons.length ? 'None' : 'All'}
				</button>
				{#each degreeButtons as degree, i}
					<button
						onclick={() => {
							selectedDegrees = selectedDegrees.includes(i + 1)
								? selectedDegrees.filter((d) => d !== i + 1)
								: [...selectedDegrees, i + 1];
						}}
						class="rounded border-2 px-3 py-1 text-lg font-bold transition-colors"
						class:bg-blue-600={selectedDegrees.includes(i + 1)}
						class:text-white={selectedDegrees.includes(i + 1)}
						class:border-blue-600={selectedDegrees.includes(i + 1)}
						class:bg-gray-200={!selectedDegrees.includes(i + 1)}
						class:text-gray-700={!selectedDegrees.includes(i + 1)}
						class:border-gray-300={!selectedDegrees.includes(i + 1)}
					>
						{degree}
					</button>
				{/each}
			</div>
		</div>

		<!-- Scale Display -->
		<div class="mb-4">
			<label class="mb-2 block text-sm font-medium">{selectedKey} Major Scale:</label>
			<div class="flex gap-2">
				{#each currentScale as note, i}
					<div class="flex flex-col items-center">
						<div class="rounded bg-blue-100 px-2 py-1 text-sm font-bold text-blue-800 dark:bg-blue-900 dark:text-blue-200">
							{degreeButtons[i]}
						</div>
						<div class="text-xs text-gray-600 dark:text-gray-400">{note}</div>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<!-- Game Controls -->
	<div class="mb-8 flex flex-col items-center gap-4">
		{#if !gameStarted}
			<button
				onclick={startGame}
				disabled={selectedDegrees.length === 0}
				class="rounded bg-blue-500 px-6 py-3 text-lg font-semibold text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-400"
			>
				Start Listening Practice
			</button>
		{:else}
			<div class="flex gap-4">
				<button
					onclick={replayNote}
					disabled={correctAnswer === null}
					class="rounded bg-green-500 px-4 py-2 text-white transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:bg-gray-400"
				>
					🔊 Replay Note
				</button>
				<button
					onclick={() => {
						gameStarted = false;
						correctAnswer = null;
						feedback = '';
						questionCount = 0;
					}}
					class="rounded bg-red-500 px-4 py-2 text-white transition-colors hover:bg-red-600"
				>
					Stop Game
				</button>
			</div>
		{/if}
	</div>

	<!-- Question Display -->
	{#if gameStarted}
		<div class="mb-8 text-center">
			<div class="mb-4 text-xl font-semibold text-gray-800 dark:text-gray-200">
				{feedback}
			</div>
			{#if correctAnswer !== null}
				<div class="text-lg text-gray-600 dark:text-gray-400">
					Question {questionCount}
				</div>
			{/if}
		</div>

		<!-- Answer Buttons -->
		<div class="mb-8 flex flex-col gap-4">
			<!-- First row: I to VII -->
			<div class="flex justify-center gap-3">
				{#each degreeButtons as degree, i}
					<button
						onclick={() => handleAnswer(i + 1)}
						class="w-16 rounded-lg bg-gray-200 px-4 py-3 text-2xl font-bold transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
					>
						{degree}
					</button>
				{/each}
			</div>

			<!-- Second row: VII to I (reverse order) -->
			<div class="flex justify-center gap-3">
				{#each degreeButtons.slice().reverse() as degree, i}
					<button
						onclick={() => handleAnswer(degreeButtons.length - i)}
						class="w-16 rounded-lg bg-gray-200 px-4 py-3 text-2xl font-bold transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
					>
						{degree}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Instructions -->
	<div class="max-w-2xl text-center text-gray-600 dark:text-gray-400">
		<h3 class="mb-2 text-lg font-semibold">How to Play:</h3>
		<ol class="list-decimal list-inside space-y-1 text-sm">
			<li>Select your preferred key and lowest note</li>
			<li>Choose which degrees you want to practice</li>
			<li>Click "Start Listening Practice"</li>
			<li>Listen to the note that plays</li>
			<li>Identify which degree of the scale it is</li>
			<li>Click the corresponding degree button</li>
			<li>The correct answer will be shown and the note will play again</li>
		</ol>
	</div>
</div> 