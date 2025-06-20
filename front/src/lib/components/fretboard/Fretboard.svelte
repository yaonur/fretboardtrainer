<script lang="ts">
	const notes = ['E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C', 'C#', 'D', 'D#'];
	const tuning = ['E', 'B', 'G', 'D', 'A', 'E']; // Standard tuning from high E to low E
	const numFrets = 15;
	const degreeButtons = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

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
	let selectedScale = $state('major');
	let correctAnswer = $state<number | null>(null);
	let feedback = $state('');

	// --- Practice Range Settings ---
	let stringRangeStart = $state<number>(0);
	let stringRangeEnd = $state<number>(5);
	let fretRangeStart = $state<number>(1);
	let fretRangeEnd = $state<number>(12);

	const scales = {
		major: [0, 2, 4, 5, 7, 9, 11] // Major scale intervals
	};

	function checkValidNotesInRange(): number {
		const rootNoteIndex = notes.indexOf(selectedKey);
		const scaleIntervals = scales[selectedScale as keyof typeof scales];
		const scaleNotes = scaleIntervals.map(
			(interval) => notes[(rootNoteIndex + interval) % notes.length]
		);

		let validNotes = 0;
		for (let string = stringRangeStart; string <= stringRangeEnd; string++) {
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
			Math.floor(Math.random() * (stringRangeEnd - stringRangeStart + 1)) + stringRangeStart;
		const newFret =
			Math.floor(Math.random() * (fretRangeEnd - fretRangeStart + 1)) + fretRangeStart;

		const note = fretboard[newString][newFret];
		// console.log("note:",note)

		const rootNoteIndex = notes.indexOf(selectedKey);
		const scaleIntervals = scales[selectedScale as keyof typeof scales];
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
			feedback = 'Correct!';
			setTimeout(() => generateNewQuestion(), 1000);
		} else {
			feedback = `Incorrect. It's ${degreeButtons[correctAnswer! - 1]}.`;
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
		<button
			onclick={generateNewQuestion}
			disabled={!canGenerateQuestion}
			class="mt-2 rounded bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
		>
			New Question
		</button>
		{#if !canGenerateQuestion}
			<div class="mt-2 text-sm text-red-600 dark:text-red-400">
				⚠️ Not enough valid notes in selected range. Found {validNotesCount} note{validNotesCount !== 1 ? 's' : ''}.
				Change the range.
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
				<label class="text-sm font-medium">Strings:</label>
				<select bind:value={stringRangeStart} class="rounded border px-2 py-1 text-sm">
					{#each { length: 6 } as _, i}
						<option value={i}>{i + 1}</option>
					{/each}
				</select>
				<span>to</span>
				<select bind:value={stringRangeEnd} class="rounded border px-2 py-1 text-sm">
					{#each { length: 6 } as _, i}
						<option value={i}>{i + 1}</option>
					{/each}
				</select>
			</div>
			<div class="flex items-center gap-2">
				<label class="text-sm font-medium">Frets:</label>
				<select bind:value={fretRangeStart} class="rounded border px-2 py-1 text-sm">
					{#each { length: 12 } as _, i}
						<option value={i + 1}>{i + 1}</option>
					{/each}
				</select>
				<span>to</span>
				<select bind:value={fretRangeEnd} class="rounded border px-2 py-1 text-sm">
					{#each { length: 12 } as _, i}
						<option value={i + 1}>{i + 1}</option>
					{/each}
				</select>
			</div>
		</div>
		<div class="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
			Currently practicing: Strings {stringRangeStart + 1}-{stringRangeEnd + 1}, Frets {fretRangeStart}-{fretRangeEnd}
		</div>
	</div>

	<div class="w-10/12 md:w-5/6">
		<!-- fretboard main -->
		<div class="relative mt-12 border-l-[5px] border-r-[5px] border-gray-400">
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
						<div class="translate-y-[150%] text-xl">{i + 1}</div>
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
