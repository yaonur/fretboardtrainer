<script lang="ts">
	import * as Tone from 'tone';

	// Only support guitar
	const tuning = ['E', 'B', 'G', 'D', 'A', 'E']; // Standard tuning from high E to low E
	const numStrings = 6;
	const numFrets = 15;
	const degreeButtons = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
	const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

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

	// UI state
	let showNoteNameOnDot = $state(true);
	let showDegreeOnRedDots = $state(false);
	let selectedTone = $state('C');
	let highlightedDegrees = $state<number[]>([1, 2, 3, 4, 5, 6, 7]);

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

	function getRedDotDegreeLabel(stringIdx: number, fretIdx: number): string {
		const note = fretboard[stringIdx][fretIdx];
		const degree = scaleNotes.indexOf(note) + 1;
		return degree > 0 ? degreeButtons[degree - 1] : '';
	}
</script>

<div class="flex flex-col items-center">
	<h2 class="text-2xl font-semibold mb-4">Guitar Degree Practice</h2>
	<div class="mb-2 flex justify-center">
		<label class="flex cursor-pointer select-none items-center gap-2">
			<input type="checkbox" bind:checked={showNoteNameOnDot} class="accent-blue-500" />
			<span class="text-sm">Show note name on dot</span>
		</label>
	</div>
	<!-- Degree label toggle -->
	<div class="mb-2 flex justify-center">
		<label class="flex cursor-pointer select-none items-center gap-2">
			<input type="checkbox" bind:checked={showDegreeOnRedDots} class="accent-red-500" />
			<span class="text-sm">Show degree name in red dots</span>
		</label>
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
