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
	let correctAnswer = $state<number | null>(null);
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

	// --- Anchor Mode Settings ---
	let anchorModeEnabled = $state(false);
	let anchorDegree = $state<number>(1); // Default to I degree
	let anchorFrequency = $state<number>(2); // How many questions to skip before anchor (default: every 2nd question)

	// --- Voice Settings ---
	let voiceEnabled = $state(true);
	let announceOnly = $state(false);

	// --- Chord Octave Mode ---
	// When enabled, chord tones ascend by octave within a question; when disabled, use original per-note octave selection
	let ascendingChordOctaves = $state(true);

	// --- Reverse Answer Playback ---
	// When enabled, play the chord tones in reverse order (e.g., 7-5-3-1)
	let reverseAnswerPlayback = $state(false);

	// --- Timing Settings ---
	let bpm = $state(120); // Beats per minute
	let questionClicks = $state(2); // Number of clicks before playing chord tones

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

	// Given a root degree, return the chord tone degrees as a 4-note sequence in thirds
	function getChordDegrees(rootDegree: number): number[] {
		const thirdSteps = [0, 2, 4, 6];
		return thirdSteps.map((offset) => ((rootDegree - 1 + offset) % 7) + 1);
	}

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

// (Removed) showCorrectAnswer and answer timing logic

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

	// --- Sequence Mode Settings ---
	let sequenceModeEnabled = $state(false);
	let sequenceInput = $state<string>('4-2-1-3'); // Default sequence
	let sequenceDegrees = $state<number[]>([]); // Parsed sequence degrees
	let sequenceFrequency = $state<number>(3); // How many questions to skip before sequence starts
	let sequenceQuestionCount = $state<number>(0); // Track how many sequence questions have been asked
	let inSequenceMode = $state(false); // Track if we're currently in a sequence

	// Parse sequence input and update sequenceDegrees
	function parseSequence() {
		if (!sequenceInput.trim()) {
			sequenceDegrees = [];
			return;
		}
		const parsed = sequenceInput
			.split(/[-\s,]+/)
			.map(s => s.trim())
			.filter(s => s.length > 0)
			.map(s => parseInt(s))
			.filter(n => !isNaN(n) && n >= 1 && n <= 7);
		sequenceDegrees = parsed;
	}
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
		parseSequence();
		// stop game on exiting the page
		return () => {
			stopGame()
			stopSoundEngine()

		}

	});

	// Update generateNewQuestion to use the metronome
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
		let targetDegree: number;
		// --- Sequence Mode Logic ---
		if (sequenceModeEnabled && sequenceDegrees.length > 0 && !inSequenceMode && questionCount % sequenceFrequency === 0) {
			inSequenceMode = true;
			sequenceQuestionCount = 0;
		}
		if (sequenceModeEnabled && sequenceDegrees.length > 0 && inSequenceMode) {
			targetDegree = sequenceDegrees[sequenceQuestionCount % sequenceDegrees.length];
			sequenceQuestionCount++;
			if (sequenceQuestionCount >= sequenceDegrees.length) {
				inSequenceMode = false;
			}
		} else if (anchorModeEnabled && questionCount % anchorFrequency === 0) {
			targetDegree = anchorDegree;
		} else {
			let availableDegrees = selectedDegrees;
			if (anchorModeEnabled) {
				availableDegrees = availableDegrees.filter(degree => degree !== anchorDegree);
			}
			availableDegrees = availableDegrees.filter(degree => degree !== lastDegree);
			if (availableDegrees.length === 0) {
				availableDegrees = anchorModeEnabled 
					? selectedDegrees.filter(degree => degree !== anchorDegree)
					: [...selectedDegrees];
			}
			const randomDegreeIndex = Math.floor(Math.random() * availableDegrees.length);
			targetDegree = availableDegrees[randomDegreeIndex];
		}
		correctAnswer = targetDegree;
		lastDegree = targetDegree;
		const chordDegrees = getChordDegrees(targetDegree);
		const playbackDegrees = reverseAnswerPlayback ? [...chordDegrees].reverse() : chordDegrees;
		feedback = `?...`;
		const preClicks = Math.max(0, questionClicks);
		const totalClicks = preClicks + playbackDegrees.length; // wait (announce on 1st) + 4 tones
		// Local state to enforce ascending tones within this question (only when enabled and not reversing)
		const seqState = (ascendingChordOctaves && !reverseAnswerPlayback) ? { lastIdx: null as number | null, currentOct: null as number | null } : null;
		startMetronome(
			totalClicks,
			(clickNum) => {
				// Phase 1: Announcement on first click (works even when preClicks = 0)
				if (clickNum === 1) {
					feedback = `${degreeButtons[targetDegree - 1]}`;
					speakDegree(degreeButtons[targetDegree - 1]);
					return;
				}
				// Remaining pre-question clicks: just wait until tones
				if (clickNum <= preClicks) return;

				// Phase 2: Chord tones (one per click)
				const firstToneClick = preClicks + 1; // tones start right after preClicks
				const lastToneClick = firstToneClick + playbackDegrees.length - 1;
				if (clickNum >= firstToneClick && clickNum <= lastToneClick) {
					if (!announceOnly) {
						const chordIndex = clickNum - firstToneClick; // 0..3
						const degreeToPlay = playbackDegrees[chordIndex];
						const noteToPlay = currentScale[degreeToPlay - 1];
						if (ascendingChordOctaves && seqState) {
							// Ensure ascending playback across chord tones by adjusting octave when needed
							const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
							const idx = noteNames.indexOf(noteToPlay);
							if (idx !== -1) {
								if (seqState.currentOct == null) {
									seqState.currentOct = getBestOctave(noteToPlay);
									seqState.lastIdx = idx;
								} else {
									if (seqState.lastIdx != null && idx <= seqState.lastIdx) {
										seqState.currentOct = seqState.currentOct + 1;
									}
									seqState.lastIdx = idx;
								}
								if (isAudioInitialized && sampler && samplerLoaded && seqState.currentOct != null) {
									sampler.triggerAttackRelease(noteToPlay + seqState.currentOct, '4n', Tone.now() + 0.19);
								}
							} else {
								// Fallback when note not recognized
								playNote(noteToPlay);
							}
						} else {
							// Original behavior: select octave independently per note
							playNote(noteToPlay);
						}
					}
					return;
				}
			},
			() => {
				// Add a one-beat gap before starting the next question to avoid overlap
				setTimeout(() => {
					generateNewQuestion();
				}, beatDuration);
			}
		);
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
			voiceSampler.triggerAttackRelease(note, '4n');
		}
	}

	// Speak a numeric count (1..7) using the same voice samples
	function speakCount(count: number) {
		if (!voiceEnabled || !voiceSamplerLoaded) return;
		// Use a different octave to distinguish count-in from degree announcement
		const countNotes = ['C5','D5','E5','F5','G5','A5','B5'];
		if (count >= 1 && count <= 7) {
			const note = countNotes[count - 1];
			if (voiceSampler && note) {
				voiceSampler.triggerAttackRelease(note, '8n');
			}
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

		<!-- Question Clicks Control -->
		<div class="mb-4 flex items-center gap-4">
			<span class="text-sm font-medium">Question Clicks:</span>
			<input
				type="range"
				min="1"
				max="8"
				step="1"
				bind:value={questionClicks}
				class="w-32 accent-blue-500"
			/>
			<span class="text-sm">{questionClicks} click{questionClicks > 1 ? 's' : ''}</span>
		</div>

		<!-- Removed Answer Clicks Control: tones play one-per-click, then next question -->

		<!-- Voice Control -->
		<div class="mb-4 flex items-center gap-4">
			<span class="text-sm font-medium">Voice:</span>
			<label class="flex cursor-pointer select-none items-center gap-2">
				<input type="checkbox" bind:checked={voiceEnabled} class="accent-blue-500" />
				<span class="text-sm">Announce degrees</span>
			</label>
			<label class="flex cursor-pointer select-none items-center gap-2">
				<input type="checkbox" bind:checked={announceOnly} class="accent-blue-500" />
				<span class="text-sm">Announce only</span>
			</label>
		</div>

		<!-- Chord Octave Mode -->
		<div class="mb-4 flex items-center gap-4">
			<span class="text-sm font-medium">Chord Octaves:</span>
			<label class="flex cursor-pointer select-none items-center gap-2">
				<input type="checkbox" bind:checked={ascendingChordOctaves} class="accent-blue-500" />
				<span class="text-sm">Keep chord tones ascending</span>
			</label>
			<span class="text-xs text-gray-600 dark:text-gray-400">
				{ascendingChordOctaves ? 'Ascending within a chord' : 'Original per-note octave'}
			</span>
		</div>

		<!-- Reverse Answer Playback -->
		<div class="mb-4 flex items-center gap-4">
			<span class="text-sm font-medium">Answer Order:</span>
			<label class="flex cursor-pointer select-none items-center gap-2">
				<input type="checkbox" bind:checked={reverseAnswerPlayback} class="accent-blue-500" />
				<span class="text-sm">Play chord tones in reverse</span>
			</label>
			<span class="text-xs text-gray-600 dark:text-gray-400">
				{reverseAnswerPlayback ? 'Descending order' : 'Ascending order'}
			</span>
		</div>

		<!-- Call Degree First Control -->
		<!-- Removed Call Degree First toggle: always announce degree first in this mode -->

		<!-- Anchor Mode Controls -->
		<div class="mb-4 flex flex-col items-center gap-2 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
			<div class="flex items-center gap-2">
				<span class="flex cursor-pointer select-none items-center gap-2">
					<input type="checkbox" bind:checked={anchorModeEnabled} class="accent-blue-500" />
					<span class="text-sm font-medium">Enable Anchor Mode</span>
				</span>
			</div>
			{#if anchorModeEnabled}
				<div class="flex items-center gap-2">
					<span class="text-sm">Anchor Degree:</span>
					<select
						bind:value={anchorDegree}
						class="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:bg-gray-700 dark:text-white"
					>
						{#each degreeButtons as degree, i}
							<option value={i + 1}>{degree}</option>
						{/each}
					</select>
				</div>
				<div class="flex items-center gap-2">
					<span class="text-sm">Every</span>
					<input
						type="number"
						bind:value={anchorFrequency}
						min="1"
						max="10"
						class="w-16 rounded border border-gray-300 bg-white px-2 py-1 text-center text-sm dark:bg-gray-700 dark:text-white"
					/>
					<span class="text-sm">questions</span>
				</div>
				<div class="text-xs text-gray-600 dark:text-gray-400">
					Every {anchorFrequency} question{anchorFrequency !== 1 ? 's' : ''} will be {degreeButtons[anchorDegree - 1]} degree
				</div>
			{/if}
		</div>

		<!-- Sequence Mode Controls -->
		<div class="mb-4 flex flex-col items-center gap-2 rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
			<div class="flex items-center gap-2">
				<label class="flex cursor-pointer select-none items-center gap-2">
					<input type="checkbox" bind:checked={sequenceModeEnabled} class="accent-green-500" />
					<span class="text-sm font-medium">Enable Sequence Mode</span>
				</label>
			</div>
			{#if sequenceModeEnabled}
				<div class="flex items-center gap-2">
					<span class="text-sm">Sequence:</span>
					<input
						type="text"
						bind:value={sequenceInput}
						placeholder="4-2-6-1"
						class="w-32 rounded border border-gray-300 bg-white px-2 py-1 text-center text-sm dark:bg-gray-700 dark:text-white"
					/>
					<span class="text-xs text-gray-600 dark:text-gray-400">
						(degrees 1-7, separated by hyphens)
					</span>
				</div>
				<div class="flex items-center gap-2">
					<span class="text-sm">Every</span>
					<input
						type="number"
						bind:value={sequenceFrequency}
						min="1"
						max="10"
						class="w-16 rounded border border-gray-300 bg-white px-2 py-1 text-center text-sm dark:bg-gray-700 dark:text-white"
					/>
					<span class="text-sm">questions</span>
				</div>
				{#if sequenceDegrees.length > 0}
					<div class="text-xs text-gray-600 dark:text-gray-400">
						Every {sequenceFrequency} question{sequenceFrequency !== 1 ? 's' : ''} will start sequence: {sequenceDegrees.map(d => degreeButtons[d - 1]).join(' → ')}
					</div>
					<div class="text-xs text-gray-600 dark:text-gray-400">
						Current position: {sequenceQuestionCount} of {sequenceDegrees.length}
					</div>
				{:else}
					<div class="text-xs text-red-600 dark:text-red-400">
						⚠️ Invalid sequence. Please enter degrees 1-7 separated by hyphens (e.g., 4-2-6-1)
					</div>
				{/if}
			{/if}
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
				Start Listening Practice
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
			<li>Set Question Clicks (how many clicks before showing the answer)</li>
			<li>Set Answer Clicks (how many clicks to show the answer before next question)</li>
			<li>Click "Start Listening Practice"</li>
			<li>Listen to the note that plays</li>
			<li>Think about which degree it is</li>
			<li>The correct degree will be shown automatically after Question Clicks</li>
			<li>A new question will be asked after Answer Clicks</li>
		</ol>
		<p class="mt-2 text-xs text-gray-500">
			🎸 Perfect for practicing with your guitar - just listen and learn the sound of each degree!
		</p>
	</div>

	<!-- Additional Information -->
	{#if (anchorModeEnabled || sequenceModeEnabled) && correctAnswer !== null}
		<div class="mb-4 text-sm">
			{#if sequenceModeEnabled && sequenceDegrees.length > 0 && inSequenceMode}
				<span class="rounded bg-green-500 px-2 py-1 text-white">
					Sequence: {sequenceDegrees.map(d => degreeButtons[d - 1]).join('-')} ({sequenceQuestionCount}/{sequenceDegrees.length})
				</span>
			{:else if anchorModeEnabled && questionCount % anchorFrequency === 0}
				<span class="rounded bg-blue-500 px-2 py-1 text-white">
					Anchor: {degreeButtons[anchorDegree - 1]}
				</span>
			{:else}
				<span class="rounded bg-gray-500 px-2 py-1 text-white">
					Random
				</span>
			{/if}
		</div>
	{/if}
</div> 