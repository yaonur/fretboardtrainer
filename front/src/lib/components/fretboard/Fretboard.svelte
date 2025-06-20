<script lang="ts">
	const notes = ['E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C', 'C#', 'D', 'D#'];
	const tuning = ['E', 'B', 'G', 'D', 'A', 'E']; // Standard tuning from high E to low E
	const numFrets = 12;
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

	const scales = {
		major: [0, 2, 4, 5, 7, 9, 11] // Major scale intervals
	};

	function generateNewQuestion() {
		feedback = '';
		const newString = Math.floor(Math.random() * tuning.length);
		const newFret = Math.floor(Math.random() * numFrets) + 1; // Frets 1-12

		const note = fretboard[newString][newFret];
		console.log(note); 
		const rootNoteIndex = notes.indexOf(selectedKey);
		const scaleIntervals = scales[selectedScale as keyof typeof scales];
		const scaleNotes = scaleIntervals.map((interval) => notes[(rootNoteIndex + interval) % notes.length]);

		const degree = scaleNotes.indexOf(note);

		if (degree === -1) {
			// If the note is not in the scale, try again
			generateNewQuestion();
		} else {
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
	$effect(generateNewQuestion);
</script>

<div class="flex flex-col items-center">
	<!-- Game Info -->
	<div class="text-center my-4">
		<h2 class="text-2xl font-semibold">Find the note's degree in {selectedKey} Major</h2>
		<button
			onclick={generateNewQuestion}
			class="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
		>
			New Question
		</button>
	</div>

	<div class="w-10/12 md:w-5/6">
		<!-- fretboard main -->
		<div class="relative border-l-[5px] border-r-[5px] border-gray-400 mt-12">
			<!-- Note Dot -->
			<div class="absolute top-0 left-0 w-full h-[150px] pointer-events-none">
				<div
					class="absolute bg-white rounded-full h-[25px] w-[25px] border-2 border-black"
					style:top="calc({activeString} * 30px - 12.5px)"
					style:left="calc(({activeFret} - 0.5) * (100% / {numFrets}) - 12.5px)"
					style:transition="all 0.3s"
				></div>
			</div>

			<!-- strings wrap -->
			<div>
				{#each { length: 5 } as _, i}
					<div class="border-b border-gray-400 h-[30px]" class:border-t={i === 0}></div>
				{/each}

				<!-- notes wrap -->
				<div class="absolute top-[-10px] left-[-35px] h-[170px] w-[30px] flex flex-col justify-between">
					{#each tuning as note}
						<div class="text-2xl leading-none h-[30px]">{note}</div>
					{/each}
				</div>
			</div>
			<!-- frets wrap -->
			<div class="absolute top-0 left-0 flex w-full h-[150px] justify-between">
				{#each { length: numFrets } as _, i}
					<div
						class="flex-1 h-[150px] border-r-2 border-gray-500 flex items-end justify-center last:border-r-0"
					>
						<div class="text-xl translate-y-[150%]">{i + 1}</div>
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
				class="px-6 py-3 bg-gray-200 dark:bg-gray-700 rounded-lg text-2xl font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
			>
				{degree}
			</button>
		{/each}
	</div>

	<!-- Feedback -->
	<div class="mt-4 text-2xl font-semibold h-8">{feedback}</div>
</div>
