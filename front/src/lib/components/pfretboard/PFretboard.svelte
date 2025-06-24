<script lang="ts">
	import * as Tone from 'tone';
	import { onMount } from 'svelte';

	// Only support guitar
	const tuning = ['E', 'B', 'G', 'D', 'A', 'E']; // Standard tuning from high E to low E
	const numStrings = 6;
	const numFrets = 15;
	const degreeButtons = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
	const notes = ['E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C', 'C#', 'D', 'D#'];

	// Audio setup
	let sampler: Tone.Sampler;
	let isAudioInitialized = false;

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
				baseUrl: 'https://tonejs.github.io/audio/salamander/'
			}).toDestination();
			isAudioInitialized = true;
		}
	}

	function getBestOctave(noteName: string): number {
		const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
		const lowestNote = 'G3'; // fixed for this mode
		const lowestNoteName = lowestNote.slice(0, -1);
		const lowestOctave = parseInt(lowestNote.slice(-1));
		const targetNoteIndex = noteNames.indexOf(noteName);
		const lowestNoteIndex = noteNames.indexOf(lowestNoteName);
		if (targetNoteIndex === -1 || lowestNoteIndex === -1) return 4;
		if (targetNoteIndex < lowestNoteIndex) return lowestOctave + 1;
		return lowestOctave;
	}

	function playNote(note: string) {
		if (isAudioInitialized && sampler) {
			const bestOctave = getBestOctave(note);
			sampler.triggerAttackRelease(note + bestOctave, '8n');
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

	// Only note-to-degree mode
	let activeString = 0;
	let activeFret = 1;
	let correctAnswer: number | null = null;
	let feedback = '';
	let showNoteNameOnDot = true;

	// Predetermined questions (stub)
	// Each question: { string: number, fret: number, degree: number }
	const questions = [
		{ string: 0, fret: 3, degree: 1 },
		{ string: 1, fret: 5, degree: 3 },
		{ string: 2, fret: 7, degree: 5 },
		// ... add more as needed
	];
	let currentQuestionIndex = 0;

	function loadQuestion(index: number) {
		const q = questions[index];
		activeString = q.string;
		activeFret = q.fret;
		correctAnswer = q.degree;
		feedback = '';
	}

	function nextQuestion() {
		if (currentQuestionIndex < questions.length - 1) {
			currentQuestionIndex++;
			loadQuestion(currentQuestionIndex);
		} else {
			feedback = 'Practice complete!';
		}
	}

	function handleAnswer(selectedDegree: number) {
		if (correctAnswer === null) return;
		if (selectedDegree === correctAnswer) {
			playNote(fretboard[activeString][activeFret]);
			feedback = 'Correct!';
			setTimeout(() => nextQuestion(), 500);
		} else {
			feedback = `Incorrect. It's ${degreeButtons[correctAnswer - 1]}.`;
		}
	}

	onMount(() => {
		loadQuestion(0);
	});
</script>

<div class="flex flex-col items-center">
	<h2 class="text-2xl font-semibold mb-4">Guitar Degree Practice</h2>
	<div class="mb-2 flex justify-center">
		<label class="flex cursor-pointer select-none items-center gap-2">
			<input type="checkbox" bind:checked={showNoteNameOnDot} class="accent-blue-500" />
			<span class="text-sm">Show note name on dot</span>
		</label>
	</div>
	<div class="h-8 text-2xl font-semibold">{feedback}</div>
	<div class="w-11/12 lg:w-10/12">
		<!-- Fretboard main -->
		<div
			class="relative mt-12 border-l-[5px] border-r-[5px] border-gray-400"
			style:height="{(numStrings - 1) * 30}px"
		>
			<!-- Main question dot -->
			<div
				class="absolute flex h-[20px] w-[20px] items-center justify-center rounded-full border-2 text-xs font-bold text-black sm:h-[25px] sm:w-[25px] md:h-[30px] md:w-[30px] lg:h-[35px] lg:w-[35px] border-blue-500 bg-blue-100"
				style:top="calc({activeString} * 30px - 12.5px)"
				style:left="calc(({activeFret} - 0.5) * (100% / {numFrets}) - 12.5px)"
				style:transition="all 0.3s"
			>
				{#if showNoteNameOnDot}
					<span class="mb-[1px] text-sm sm:text-lg md:text-xl lg:text-2xl">
						{fretboard[activeString][activeFret]}
					</span>
				{/if}
			</div>
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
	<!-- Answer buttons -->
	<div class="ml-6 mt-10 flex w-11/12 flex-col gap-2 place-self-start md:place-self-center lg:ml-0 lg:w-10/12">
		<div class="flex justify-start gap-2 lg:justify-center">
			{#each degreeButtons as degree, i}
				<button
					onclick={() => handleAnswer(i + 1)}
					class="w-10 rounded-lg bg-gray-200 px-1 text-lg font-bold transition-colors hover:bg-gray-300 sm:text-2xl dark:bg-gray-700 dark:hover:bg-gray-600"
				>
					{degree}
				</button>
			{/each}
		</div>
	</div>
	<div class="mt-6">
		<button
			onclick={() => {
				currentQuestionIndex = 0;
				loadQuestion(0);
			}}
			class="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
		>
			Restart
		</button>
	</div>
</div>
