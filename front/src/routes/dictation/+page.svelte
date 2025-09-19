<script lang="ts">
	import * as Tone from 'tone';
	import { onDestroy } from 'svelte';
	import { onMount } from 'svelte';

	const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
	const circleOfFifths = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
	const degreeButtons = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

	// Game state
	let selectedKey = $state('A');
	let lowestNote = $state<string>('G3'); // User's lowest note as reference
    let selectedDegrees = $state<number[]>([1, 2, 3, 4, 5, 6, 7]);
    let correctAnswer = $state<number[] | null>(null);
	let feedback = $state('');
	let questionCount = $state(0);
	let gameStarted = $state(false);
	let isAudioInitialized = $state(false);
	let sampler: Tone.Sampler;
	let clickSampler: Tone.Sampler;
	let voiceSampler: Tone.Sampler;
	let lastDegree = $state<number | null>(null); // Track last asked degree to avoid repetition
	let questionTimeout: ReturnType<typeof setTimeout> | null = null;
	let samplerLoaded = $state(false);
	let voiceSamplerLoaded = $state(false);

    // --- Voice Settings ---
	let voiceEnabled = $state(true);

	let callDegreeFirst = $state(false);

    // --- Timing Settings ---
    let bpm = $state(120); // Beats per minute

    // --- Dictation Settings ---
    let notesPerQuestion = $state(2); // At least 2 notes per question
    const notesCount = $derived(Math.max(2, Math.min(8, notesPerQuestion)));

	// --- Click Volume ---
	let clickVolume = $state(1); // 0.0 to 1.0

    let beatDuration: number;

    $effect(() => {
        beatDuration = 60000 / bpm;
    });

	// Map degrees to note names for the sampler
	const degreeToNote: Record<string, string> = {
		'I': 'C4',
		'II': 'D4',
		'III': 'E4',
		'IV': 'F4',
		'V': 'G4',
		'VI': 'A4',
		'VII': 'B4'
	};

	// Audio setup
	async function initAudio() {
		if (!isAudioInitialized) {
			await Tone.start();
			// Tone.Contet
			
			// Create a sampler with piano-like samples
			sampler = new Tone.Sampler({
				urls: {
					C4: 'C4.mp3',
					'D#4': 'Ds4.mp3',
					'F#4': 'Fs4.mp3'
				},
				release: 1,
				baseUrl: 'https://tonejs.github.io/audio/salamander/',
				onload: () => {
					samplerLoaded = true;
				}
			}).toDestination();
			// Setup clickSampler for metronome click
			clickSampler = new Tone.Sampler({
				urls: {
					C4: '/sounds/Click.wav'
				},
				onload: () => {
					// Optionally set a flag if you want to track click sample loading
				// 	clickSampler.context.lookAhead = 1500
				}
			}).toDestination();

			// Setup voiceSampler for degree announcements
			voiceSampler = new Tone.Sampler({
				urls: {
					'C4': '/sounds/count/1.mp3',
					'D4': '/sounds/count/2.mp3',
					'E4': '/sounds/count/3.mp3',
					'F4': '/sounds/count/4.mp3',
					'G4': '/sounds/count/5.mp3',
					'A4': '/sounds/count/6.mp3',
					'B4': '/sounds/count/7.mp3'
				},
				onload: () => {
					voiceSamplerLoaded = true;
					voiceSampler.context.lookAhead = 0
				}
			}).toDestination();
			

			isAudioInitialized = true;
		}
	}
	$effect(()=>{
		if(!isAudioInitialized) initAudio()
	})

	// Clear timeout when component is destroyed
	onDestroy(() => {
		if (questionTimeout) {
			clearTimeout(questionTimeout);
		}
	});

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
		if (isAudioInitialized && sampler && samplerLoaded) {
			const bestOctave = getBestOctave(note);
			sampler.triggerAttackRelease(note + bestOctave, '4n',Tone.now() + 0.19);
		}
	}

    // Utility: speak a sequence of degrees one per beat
    function speakSequence(degrees: number[]) {
        if (!voiceEnabled || !voiceSamplerLoaded) return;
        degrees.forEach((deg, idx) => {
            const label = degreeButtons[deg - 1];
            const note = degreeToNote[label];
            if (note) {
                voiceSampler.triggerAttackRelease(note, '4n', Tone.now() + idx * (beatDuration / 1000));
            }
        });
    }

    // Utility: play a sequence of scale notes one per beat
    function playSequence(degrees: number[]) {
        if (!isAudioInitialized || !samplerLoaded) return;
        degrees.forEach((deg, idx) => {
            const targetNote = currentScale[deg - 1];
            const bestOctave = getBestOctave(targetNote);
            sampler.triggerAttackRelease(
                targetNote + bestOctave,
                '4n',
                Tone.now() + idx * (beatDuration / 1000) + 0.19
            );
        });
    }

    // Show the correct answer (announce or play full sequence depending on mode)
    function showCorrectAnswer() {
        if (correctAnswer && correctAnswer.length > 0) {
            const degreeText = correctAnswer.map((d) => degreeButtons[d - 1]).join(' ');
            feedback = degreeText;

            if (callDegreeFirst) {
                // We already announced during question; now play them
                playSequence(correctAnswer);
            } else {
                // We played during question; now announce
                speakSequence(correctAnswer);
            }

            // Generate new question after reveal window that fits the full sequence
            const revealBeats = Math.max(2, correctAnswer.length);
            questionTimeout = setTimeout(() => {
                generateNewQuestion();
            }, revealBeats * beatDuration);
        }
    }

	// Metronome interval
	let metronomeInterval: ReturnType<typeof setInterval> | null = null;

	function playClick() {
		if (isAudioInitialized && clickSampler) {
			clickSampler.volume.value = Tone.gainToDb(clickVolume); // clickVolume is 0.0-1.0
			// Schedule the click 0.2 seconds (200ms) in the future
			clickSampler.triggerAttackRelease('C4', '16n', Tone.now() + 0.20);
		}
	}

	function startMetronome(totalClicks: number, onEachClick?: (clickNum: number) => void, onDone?: () => void) {
		let clickCount = 0;
		playClick();
		if (onEachClick) onEachClick(1);
		clickCount++;
		metronomeInterval = setInterval(() => {
			playClick();
			clickCount++;
			if (onEachClick) onEachClick(clickCount);
			if (clickCount >= totalClicks) {
				if (metronomeInterval) clearInterval(metronomeInterval);
				metronomeInterval = null;
				if (onDone) onDone();
			}
		}, beatDuration);
	}

	function stopMetronome() {
		if (metronomeInterval) {
			clearInterval(metronomeInterval);
			metronomeInterval = null;
		}
	}

    // (Dictation page removes anchor and sequence modes)
	function stopSoundEngine() {
		if (sampler) {
			try { sampler.dispose(); } catch {}
			samplerLoaded = false;
		}
		if (clickSampler) {
			try { clickSampler.dispose(); } catch {}
		}
		if (voiceSampler) {
			try { voiceSampler.dispose(); } catch {}
			voiceSamplerLoaded = false;
		}
		isAudioInitialized = false;
	}
    $effect(() => {
        // stop game on exiting the page
        return () => {
            stopGame()
            stopSoundEngine()

        }

    });

    // Update generateNewQuestion for dictation (multiple notes)
    function generateNewQuestion() {
		if (selectedDegrees.length === 0) {
			feedback = 'Please select at least one degree to practice.';
			return;
		}
		if (questionTimeout) {
			clearTimeout(questionTimeout);
			questionTimeout = null;
		}
		stopMetronome();
		feedback = '';
		questionCount++;
        // Determine current notes count and build a sequence of degrees for this question
        const desiredCount = Math.max(2, Math.min(8, Number(notesPerQuestion)));
        const sequence: number[] = [];
        let lastPicked: number | null = null;
        for (let i = 0; i < desiredCount; i++) {
            const pool = selectedDegrees.filter((d) => d !== lastPicked);
            const idx = Math.floor(Math.random() * pool.length);
            const d = pool[idx];
            sequence.push(d);
            lastPicked = d;
        }
        correctAnswer = sequence;
        lastDegree = sequence[sequence.length - 1] ?? null;

        // Placeholder during question
        feedback = Array(sequence.length).fill('?...').join(' ');

        // Total clicks: N beats for notes + max(2, N) beats for reveal window
        const revealBeats = Math.max(2, desiredCount);
        const totalClicks = desiredCount + revealBeats;
        let notesPresented = 0;

        // On each click, present either spoken degrees or played notes for the sequence
        startMetronome(totalClicks, (clickNum) => {
            // While there are still notes to present, present one per click
            if (notesPresented < sequence.length) {
                const degree = sequence[notesPresented];
                const noteName = currentScale[degree - 1];
                if (callDegreeFirst) {
                    speakDegree(degreeButtons[degree - 1]);
                } else {
                    playNote(noteName);
                }
                notesPresented += 1;
                return;
            }

            // Reveal strictly on the first click after the last note
            if (clickNum === desiredCount + 1) {
                showCorrectAnswer();
            }
        });
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
		lastDegree = null;
		generateNewQuestion();
		gameStarted = true;
	}

	// Stop the game
	function stopGame() {
		if (questionTimeout) {
			clearTimeout(questionTimeout);
			questionTimeout = null;
		}
		stopMetronome();
		gameStarted = false;
		correctAnswer = null;
		feedback = '';
		questionCount = 0;
		lastDegree = null;
	}

	// Speak the degree using Tone.js Sampler
	function speakDegree(degree: string) {
		if (!voiceEnabled || !voiceSamplerLoaded) return;
		const note = degreeToNote[degree];
		if (voiceSampler && note) {
			voiceSampler.triggerAttackRelease(note, '1n');
		}
	}
</script>

<div class="flex flex-col items-center p-6">
    <h1 class="mb-8 text-3xl font-bold">Dictation Practice</h1>
	
	<!-- Settings Panel -->
	<div class="mb-8 w-full max-w-2xl rounded-lg bg-gray-50 p-6 dark:bg-gray-800">
		<h2 class="mb-4 text-xl font-semibold">Settings</h2>
		
		<!-- Key Selection -->
		<div class="mb-4 flex items-center gap-4">
			<span class="text-sm font-medium">Key:</span>
			<button
				title="Previous Key"
				class="rounded border px-2 py-1 text-sm font-bold hover:bg-gray-200 dark:hover:bg-gray-700"
				onclick={prevKey}>&lt;</button
			>
			<select
				bind:value={selectedKey}
				class="rounded border w-14 border-gray-300 bg-white px-3 py-1 text-sm dark:bg-gray-700 dark:text-white"
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
			<span class="text-sm font-medium">Lowest Note:</span>
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

		<!-- Tempo Control -->
		<div class="mb-4 flex items-center gap-4">
			<span class="text-sm font-medium">Tempo (BPM):</span>
			<input
				type="range"
				min="40"
				max="240"
				step="1"
				bind:value={bpm}
				class="w-32 accent-blue-500"
			/>
			<span class="text-sm">{bpm} BPM</span>
		</div>

        <!-- Click Volume Control -->
		<div class="mb-4 flex items-center gap-4">
			<span class="text-sm font-medium">Click Volume:</span>
			<input
				type="range"
				min="0"
				max="1"
				step="0.01"
				bind:value={clickVolume}
				class="w-32 accent-blue-500"
			/>
			<span class="text-sm">{Math.round(clickVolume * 100)}%</span>
		</div>

        <!-- Notes Per Question -->
        <div class="mb-4 flex items-center gap-4">
            <span class="text-sm font-medium">Notes per question:</span>
            <input
                type="number"
                min="2"
                max="8"
                bind:value={notesPerQuestion}
                class="w-16 rounded border border-gray-300 bg-white px-2 py-1 text-center text-sm dark:bg-gray-700 dark:text-white"
            />
        </div>

        

        <!-- Voice Control -->
		<div class="mb-4 flex items-center gap-4">
			<span class="text-sm font-medium">Voice:</span>
			<label class="flex cursor-pointer select-none items-center gap-2">
				<input type="checkbox" bind:checked={voiceEnabled} class="accent-blue-500" />
				<span class="text-sm">Announce degrees</span>
			</label>
		</div>

		<!-- Call Degree First Control -->
		<div class="mb-4 flex items-center gap-4">
			<span class="text-sm font-medium">Call Degree First:</span>
			<label class="flex cursor-pointer select-none items-center gap-2">
				<input type="checkbox" bind:checked={callDegreeFirst} class="accent-blue-500" />
				<span class="text-sm">Announce degree before playing note</span>
			</label>
		</div>

        <!-- Dictation Mode Note -->
        <div class="mb-4 text-xs text-gray-600 dark:text-gray-400">
            Plays {notesPerQuestion} note{notesPerQuestion > 1 ? 's' : ''} per question.
        </div>

		<!-- Degree Selection -->
		<div class="mb-4">
			<span class="mb-2 block text-sm font-medium">Degrees to Practice:</span>
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

		
	</div>

	<!-- Game Controls -->
	<div class="mb-8 flex flex-col items-center gap-4">
		{#if !gameStarted}
			<button
				onclick={startGame}
				disabled={selectedDegrees.length === 0 || !samplerLoaded}
				class="rounded bg-blue-500 px-6 py-3 text-lg font-semibold text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
                Start Dictation
			</button>
			{#if !samplerLoaded}
				<div class="text-xs text-gray-500 mt-2">Loading piano sounds...</div>
			{/if}
		{:else}
			<button
				onclick={stopGame}
				class="rounded bg-red-500 px-4 py-2 text-white transition-colors hover:bg-red-600"
			>
				Stop Game
			</button>
		{/if}
	</div>
	{#if !gameStarted && !samplerLoaded}
		 <!-- content here -->
		 <div class="mb-8 flex flex-col items-center gap-4">
			 <button
			 onclick={initAudio}
			 class="rounded bg-blue-500 px-6 py-3 text-lg font-semibold text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-400"
		 >
			 Force init
		 </button>
		 </div>
	{/if}

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
	{/if}

	<!-- Instructions -->
	<div class="max-w-2xl text-center text-gray-600 dark:text-gray-400">
        <h3 class="mb-2 text-lg font-semibold">How to Use:</h3>
		<ol class="list-decimal list-inside space-y-1 text-sm">
			<li>Select your preferred key and lowest note</li>
			<li>Choose which degrees you want to practice</li>
			<li>Set Tempo (beats per minute)</li>
            <li>Set Notes per question (min 2)</li>
            <li>The exercise plays N notes; then reveals and announces them</li>
            <li>Click "Start Dictation"</li>
            <li>Listen to the notes that play (or the degrees announced if Call Degree First is enabled)</li>
            <li>Think about which degrees they are</li>
            <li>The correct degrees will be shown automatically after Question Clicks</li>
			<li>A new question will be asked after Answer Clicks</li>
		</ol>
		<p class="mt-2 text-xs text-gray-500">
            🎸 Practice melodic dictation: internalize sound of multiple degrees in context.
		</p>
	</div>

</div> 