<script lang="ts">
	import UiSelect from '../UiSelect.svelte';
	import * as Tone from 'tone';

	const notes = ['E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C', 'C#', 'D', 'D#'];
	const circleOfFifths = ['C', 'G', 'D', 'A', 'E', 'B', 'F#/Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
	const tuning = ['E', 'B', 'G', 'D', 'A', 'E']; // Standard tuning from high E to low E
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
					"C4": "C4.mp3",
					"D#4": "Ds4.mp3", 
					"F#4": "Fs4.mp3",
				},
				release: 1,
				baseUrl: "https://tonejs.github.io/audio/salamander/",
			}).toDestination();
			
			isAudioInitialized = true;
		}
	}

	// Play a note
	function playNote(note: string) {
		if (isAudioInitialized && sampler) {
			sampler.triggerAttackRelease(note + '4', '8n');
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

	// --- Practice Range Settings ---
	let stringRangeStart = $state<number>(1);
	let stringRangeEnd = $state<number>(6);
	let fretRangeStart = $state<number>(1);
	let fretRangeEnd = $state<number>(12);

	// Convert 1-based string indexing to 0-based for fretboard logic
	const stringRangeStartIndex = $derived(stringRangeStart - 1);
	const stringRangeEndIndex = $derived(stringRangeEnd - 1);

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
				const note = fretboard[string][fret];
				if (scaleNotes.includes(note)) {
					validNotes++;
				}
			}
		}
		return validNotes;
	}

	const validNotesCount = $derived(checkValidNotesInRange());
	const canGenerateQuestion = $derived(validNotesCount >= 2);

	let lastNote = '';
	function generateNewQuestion() {
		feedback = '';
		const newString =
			Math.floor(Math.random() * (stringRangeEndIndex - stringRangeStartIndex + 1)) + stringRangeStartIndex;
		const newFret =
			Math.floor(Math.random() * (fretRangeEnd - fretRangeStart + 1)) + fretRangeStart;

		const note = fretboard[newString][newFret];
		// console.log("note:",note)

		const rootNoteIndex = notes.indexOf(selectedKey);
		const scaleIntervals = scales.major;
		const scaleNotes = scaleIntervals.map(
			(interval) => notes[(rootNoteIndex + interval) % notes.length]
		);

		const degree = scaleNotes.indexOf(note);

		if (degree === -1 || lastNote === note) {
			// if (lastNote === note)
			// console.log('same note', note);
			generateNewQuestion();
		} else {
			lastNote = note;
			activeString = newString;
			activeFret = newFret;
			correctAnswer = degree + 1; // 1-indexed degree
		}
	}

	function handleAnswer(selectedDegree: number) {
		if (selectedDegree === correctAnswer) {
			// Play the correct note when answer is right
			if (correctAnswer !== null) {
				const currentNote = fretboard[activeString][activeFret];
				playNote(currentNote);
			}
			feedback = 'Correct!';
			setTimeout(() => generateNewQuestion(), 1000);
		} else {
			// Play the note corresponding to the wrong degree selected
			const rootNoteIndex = notes.indexOf(selectedKey);
			const scaleIntervals = scales.major;
			const wrongDegreeIndex = selectedDegree - 1; // Convert to 0-based index
			const wrongNote = notes[(rootNoteIndex + scaleIntervals[wrongDegreeIndex]) % notes.length];
			playNote(wrongNote);
			
			feedback = `Incorrect. It's ${degreeButtons[correctAnswer! - 1]}.`;
		}
	}

	// Play current note
	function playCurrentNote() {
		if (correctAnswer !== null) {
			const currentNote = fretboard[activeString][activeFret];
			playNote(currentNote);
		}
	}

	// Initial question
	// $effect(generateNewQuestion);
	$effect(() => {});
</script>

<div class="flex flex-col items-center">
	<!-- Game Info -->
	<div class="my-4 text-center">
		<h2 class="text-2xl font-semibold">Find the note's degree in {selectedKey} Major</h2>
		<div class="mt-4 flex justify-center gap-4">
			<div class="flex items-center gap-2">
				<label class="text-sm font-medium">Key:</label>
				<select
					bind:value={selectedKey}
					class="ease w-full cursor-pointer dark:text-slate-100 appearance-none rounded border border-slate-200 bg-transparent py-2 pl-3 pr-8 text-sm text-slate-700 shadow-sm transition duration-300 placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-400 focus:shadow-md focus:outline-none"
				>
					{#each circleOfFifths as note}
						<option class="px-2 dark:bg-slate-700" value={note}>{note}</option>
					{/each}
				</select>
			</div>
		</div>
		<button
			onclick={async () => {
				await initAudio();
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
					playCurrentNote();
				}}
				class="mt-2 ml-2 rounded bg-green-500 px-4 py-2 text-white transition-colors hover:bg-green-600"
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
				<UiSelect bind:value={stringRangeStart} length={6} start={1} label="Strings:" />
				<span>to</span>
				<UiSelect bind:value={stringRangeEnd} length={6} start={1} />
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

	<div class="w-10/12 md:w-5/6">
		<!-- fretboard main -->
		<div class="relative mt-12 border-l-[5px] border-r-[5px] border-gray-400">
			<!-- Fret Markers -->
			<div class="pointer-events-none absolute left-0 top-0 h-[150px] w-full">
				{#each [3, 5, 7, 9, 12, 15] as fret}
					<div
						class="absolute h-[8px] w-[8px] rounded-full bg-gray-400"
						style:left="calc(({fret} - 0.5) * (100% / {numFrets}) - 4px)"
						style:top="calc(50% - 4px)"
					></div>
				{/each}
			</div>

			<!-- Note Dot -->
			{#if correctAnswer !== null}
				<div class="pointer-events-none absolute left-0 top-0 h-[150px] w-full">
					<div
						class="absolute h-[25px] w-[25px] rounded-full border-2 border-black bg-white"
						style:top="calc({activeString} * 30px - 12.5px)"
						style:left="calc(({activeFret} - 0.5) * (100% / {numFrets}) - 12.5px)"
						style:transition="all 0.3s"
					></div>
				</div>
			{/if}
			<!-- strings wrap -->
			<div>
				{#each { length: 5 } as _, i}
					<div class="h-[30px] border-b border-gray-400" class:border-t={i === 0}></div>
				{/each}

				<!-- notes wrap -->
				<div
					class="absolute left-[-35px] top-[-10px] flex h-[170px] w-[30px] flex-col justify-between"
				>
					{#each tuning as note}
						<div class="h-[30px] text-2xl leading-none">{note}</div>
					{/each}
				</div>
			</div>
			<!-- frets wrap -->
			<div class="absolute left-0 top-0 flex h-[150px] w-full justify-between">
				{#each { length: numFrets } as _, i}
					<div
						class="flex h-[150px] flex-1 items-end justify-center border-r-2 border-gray-500 last:border-r-0"
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
	<div class="mt-24 flex justify-center gap-4">
		{#each degreeButtons as degree, i}
			<button
				onclick={() => handleAnswer(i + 1)}
				class="rounded-lg bg-gray-200 px-6 py-3 text-2xl font-bold transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
			>
				{degree}
			</button>
		{/each}
	</div>

	<!-- Feedback -->
	<div class="mt-4 h-8 text-2xl font-semibold">{feedback}</div>
</div>
