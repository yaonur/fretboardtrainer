<script lang="ts">
	const notes = ['E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C', 'C#', 'D', 'D#'];
	const tuning = ['E', 'B', 'G', 'D', 'A', 'E']; // Standard tuning from high E to low E
	const numFrets = 12;
	const degreeButtons = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

	const fretboard = tuning.map((openNote) => {
		const openNoteIndex = notes.indexOf(openNote);
		const stringNotes: string[] = [];
		for (let fret = 0; fret <= numFrets; fret++) {
			const noteIndex = (openNoteIndex + fret) % notes.length;
			stringNotes.push(notes[noteIndex]);
		}
		return stringNotes;
	});

	console.log(fretboard);
</script>

<div class="flex flex-col items-center">
	<div class="w-10/12 md:w-5/6">
		<!-- fretboard main -->
		<div class="relative border-l-[5px] border-r-[5px] border-gray-400 mt-12">
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
		{#each degreeButtons as degree}
			<button
				class="px-6 py-3 bg-gray-200 dark:bg-gray-700 rounded-lg text-2xl font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
			>
				{degree}
			</button>
		{/each}
	</div>
</div>
