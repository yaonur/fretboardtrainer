<script lang="ts">
	import * as Tone from 'tone';
	import { onDestroy } from 'svelte';
	import {
		loadDictationPracticeSettings,
		saveDictationPracticeSettings,
		type DictationPracticeSettings
	} from '$lib/stores/dictationPracticeSettings';

	const savedSettings = loadDictationPracticeSettings();

	const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
	const circleOfFifths = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
	const degreeButtons = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

	const droneRegisterOptions = (() => {
		const options: string[] = [];
		for (let octave = 0; octave <= 4; octave++) {
			for (const name of notes) {
				options.push(`${name}${octave}`);
			}
		}
		return options;
	})();

	// Game state
	let selectedKey = $state(savedSettings.selectedKey);
	let lowestNote = $state<string>(savedSettings.lowestNote);
	let selectedDegrees = $state<number[]>(savedSettings.selectedDegrees);
    let correctAnswer = $state<number[] | null>(null);
	let feedback = $state('');
	let questionCount = $state(0);
	let gameStarted = $state(false);
	let isAudioInitialized = $state(false);
	let sampler: Tone.Sampler;
	let clickSampler: Tone.Sampler;
	let voiceSampler: Tone.Sampler;
	let droneSampler: Tone.Sampler;
	let dronePlaying = $state(false);
	let droneSamplerLoaded = $state(false);
	let lastDegree = $state<number | null>(null); // Track last asked degree to avoid repetition
	let questionTimeout: ReturnType<typeof setTimeout> | null = null;
	let samplerLoaded = $state(false);
	let voiceSamplerLoaded = $state(false);
	let voiceQueue: Array<{note: string, time: number, degree: string}> = [];
	let isVoicePlaying = $state(false);
	let voiceTimeout: ReturnType<typeof setTimeout> | null = null;

	// --- Voice Settings ---
	let voiceEnabled = $state(savedSettings.voiceEnabled);
	let callDegreeFirst = $state(savedSettings.callDegreeFirst);

	// --- Timing Settings ---
	let bpm = $state(savedSettings.bpm);

	// --- Dictation Settings ---
	let notesPerQuestion = $state(savedSettings.notesPerQuestion);
	let clicksBeforeAnswer = $state(savedSettings.clicksBeforeAnswer);
	const notesCount = $derived(Math.max(2, Math.min(8, notesPerQuestion)));

	// --- Click Volume ---
	let clickVolume = $state(savedSettings.clickVolume);

	// --- Tonic reference ---
	let tonicEnabled = $state(savedSettings.tonicEnabled);
	let tonicOnAnswer = $state(savedSettings.tonicOnAnswer);
	let tonicSustainEnabled = $state(savedSettings.tonicSustainEnabled);
	let selectedTonicDegrees = $state<number[]>(savedSettings.selectedTonicDegrees);
	let tonicRotateFrequency = $state(savedSettings.tonicRotateFrequency);
	let activeTonicDegree = $state(1);
	let tonicRotateIndex = $state(0);
	let questionsOnActiveTonic = $state(0);
	let droneRegister = $state(savedSettings.droneRegister);
	let droneVolume = $state(savedSettings.droneVolume);
	let degreeOctavesFromTonic = $state(savedSettings.degreeOctavesFromTonic);
	let selectedDegreeOctaveOffsets = $state<number[]>(savedSettings.selectedDegreeOctaveOffsets);
	let activeDegreeOctaveOffset = $state(0);

	// --- Random tone (key) change ---
	let randomToneEnabled = $state(savedSettings.randomToneEnabled);
	let randomToneFrequency = $state(savedSettings.randomToneFrequency);
	let questionsInCurrentKey = $state(0);

	let settingsSaveMessage = $state('');
	let settingsSaveTimeout: ReturnType<typeof setTimeout> | null = null;

	let beatDuration: number;

	$effect(() => {
		beatDuration = 60000 / bpm;
	});

	function getSettingsSnapshot(): DictationPracticeSettings {
		return {
			selectedKey,
			lowestNote,
			selectedDegrees,
			voiceEnabled,
			callDegreeFirst,
			bpm,
			clickVolume,
			notesPerQuestion,
			clicksBeforeAnswer,
			tonicEnabled,
			tonicOnAnswer,
			tonicSustainEnabled,
			selectedTonicDegrees,
			tonicRotateFrequency,
			droneRegister,
			droneVolume,
			degreeOctavesFromTonic,
			selectedDegreeOctaveOffsets,
			randomToneEnabled,
			randomToneFrequency
		};
	}

	function savePracticeSettings(showMessage = true) {
		saveDictationPracticeSettings(getSettingsSnapshot());
		if (!showMessage) return;
		settingsSaveMessage = 'Settings saved';
		if (settingsSaveTimeout) clearTimeout(settingsSaveTimeout);
		settingsSaveTimeout = setTimeout(() => {
			settingsSaveMessage = '';
		}, 2000);
	}

	$effect(() => {
		selectedKey;
		lowestNote;
		selectedDegrees;
		voiceEnabled;
		callDegreeFirst;
		bpm;
		clickVolume;
		notesPerQuestion;
		clicksBeforeAnswer;
		tonicEnabled;
		tonicOnAnswer;
		tonicSustainEnabled;
		selectedTonicDegrees;
		tonicRotateFrequency;
		droneRegister;
		droneVolume;
		degreeOctavesFromTonic;
		selectedDegreeOctaveOffsets;
		randomToneEnabled;
		randomToneFrequency;
		savePracticeSettings(false);
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
					// Increase lookahead for better mobile performance
					voiceSampler.context.lookAhead = 0.1;
					// Note: latencyHint cannot be set after context creation (it's read-only)
					// If needed, configure it when initializing Tone with Tone.setContext()
				},
				onerror: (error) => {
					console.error('Voice sampler loading error:', error);
				}
			}).toDestination();

			droneSampler = new Tone.Sampler({
				urls: {
					C4: 'C4.mp3',
					'D#4': 'Ds4.mp3',
					'F#4': 'Fs4.mp3'
				},
				release: 3,
				attack: 0.05,
				baseUrl: 'https://tonejs.github.io/audio/salamander/',
				onload: () => {
					droneSamplerLoaded = true;
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
		if (voiceTimeout) {
			clearTimeout(voiceTimeout);
		}
		if (settingsSaveTimeout) {
			clearTimeout(settingsSaveTimeout);
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

	function getBestOctaveForReference(noteName: string, referenceNote: string): number {
		const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
		const referenceNoteName = referenceNote.slice(0, -1);
		const referenceOctave = parseInt(referenceNote.slice(-1), 10);
		const targetNoteIndex = noteNames.indexOf(noteName);
		const referenceNoteIndex = noteNames.indexOf(referenceNoteName);
		if (targetNoteIndex === -1 || referenceNoteIndex === -1) return 4;
		if (targetNoteIndex < referenceNoteIndex) return referenceOctave + 1;
		return referenceOctave;
	}

	function getBestOctave(noteName: string): number {
		return getBestOctaveForReference(noteName, lowestNote);
	}

	function parsePitch(pitch: string): { noteName: string; octave: number } {
		return { noteName: pitch.slice(0, -1), octave: parseInt(pitch.slice(-1), 10) };
	}

	function noteToMidi(noteName: string, octave: number): number {
		const idx = notes.indexOf(noteName);
		if (idx === -1) return 0;
		return (octave + 1) * 12 + idx;
	}

	function getSortedTonicDegrees(): number[] {
		return [...selectedTonicDegrees].sort((a, b) => a - b);
	}

	function getTonicPitch(degreeNum = activeTonicDegree): string {
		const noteName = currentScale[degreeNum - 1];
		if (!noteName) return 'C4';
		const octave = getBestOctaveForReference(noteName, droneRegister);
		return `${noteName}${octave}`;
	}

	function getMinimumDegreeOctave(noteName: string): number {
		const tonicPitch = getTonicPitch();
		const { noteName: tonicNoteName, octave: tonicOctave } = parsePitch(tonicPitch);
		let octave = getBestOctaveForReference(noteName, `${tonicNoteName}${tonicOctave}`);
		const tonicMidi = noteToMidi(tonicNoteName, tonicOctave);
		while (noteToMidi(noteName, octave) < tonicMidi) octave++;
		return octave;
	}

	function getDegreeOctave(noteName: string): number {
		if (!degreeOctavesFromTonic || !tonicEnabled) return getBestOctave(noteName);
		return getMinimumDegreeOctave(noteName) + activeDegreeOctaveOffset;
	}

	function pickDegreeOctaveOffset() {
		if (!degreeOctavesFromTonic || !tonicEnabled) {
			activeDegreeOctaveOffset = 0;
			return;
		}
		const options = [...selectedDegreeOctaveOffsets].sort((a, b) => a - b);
		if (options.length === 0) {
			activeDegreeOctaveOffset = 0;
			return;
		}
		activeDegreeOctaveOffset = options[Math.floor(Math.random() * options.length)];
	}

	function toggleDegreeOctaveOffset(offset: number) {
		if (selectedDegreeOctaveOffsets.includes(offset)) {
			const next = selectedDegreeOctaveOffsets.filter((o) => o !== offset);
			selectedDegreeOctaveOffsets = next.length > 0 ? next : [offset];
		} else {
			selectedDegreeOctaveOffsets = [...selectedDegreeOctaveOffsets, offset].sort((a, b) => a - b);
		}
	}

	function advanceTonicIfNeeded() {
		const sorted = getSortedTonicDegrees();
		if (!tonicEnabled || sorted.length === 0) return;
		if (sorted.length === 1) {
			activeTonicDegree = sorted[0];
			return;
		}
		if (questionCount === 1) {
			tonicRotateIndex = 0;
			activeTonicDegree = sorted[0];
			questionsOnActiveTonic = 1;
			return;
		}
		questionsOnActiveTonic++;
		if (questionsOnActiveTonic > tonicRotateFrequency) {
			tonicRotateIndex = (tonicRotateIndex + 1) % sorted.length;
			activeTonicDegree = sorted[tonicRotateIndex];
			questionsOnActiveTonic = 1;
		}
	}

	function playTonicOnQuestion(when = Tone.now() + 0.05) {
		if (!tonicEnabled || selectedTonicDegrees.length === 0 || !droneSamplerLoaded) return;
		const pitch = getTonicPitch();
		droneSampler.volume.value = Tone.gainToDb(droneVolume);
		if (tonicSustainEnabled) {
			droneSampler.releaseAll();
			droneSampler.triggerAttack(pitch, when);
			dronePlaying = true;
		} else {
			droneSampler.triggerAttackRelease(pitch, '2n', when);
		}
	}

	function toggleTonicDegree(degree: number) {
		if (selectedTonicDegrees.includes(degree)) {
			const next = selectedTonicDegrees.filter((d) => d !== degree);
			selectedTonicDegrees = next.length > 0 ? next : [degree];
		} else {
			selectedTonicDegrees = [...selectedTonicDegrees, degree].sort((a, b) => a - b);
		}
	}

	function pickRandomKey() {
		const otherKeys = circleOfFifths.filter((key) => key !== selectedKey);
		if (otherKeys.length === 0) return;
		selectedKey = otherKeys[Math.floor(Math.random() * otherKeys.length)];
	}

	function maybeChangeRandomKey() {
		if (!randomToneEnabled) return;
		questionsInCurrentKey++;
		if (questionsInCurrentKey >= randomToneFrequency) {
			pickRandomKey();
			questionsInCurrentKey = 0;
			updateDronePitch();
		}
	}

	function stopDrone() {
		if (droneSampler && dronePlaying) {
			droneSampler.releaseAll();
			dronePlaying = false;
		}
	}

	function updateDronePitch() {
		if (!tonicEnabled || !tonicSustainEnabled || !droneSampler || !droneSamplerLoaded) {
			stopDrone();
			return;
		}
		const pitch = getTonicPitch();
		droneSampler.volume.value = Tone.gainToDb(droneVolume);
		if (dronePlaying) droneSampler.releaseAll();
		droneSampler.triggerAttack(pitch, Tone.now() + 0.05);
		dronePlaying = true;
	}

	// Play a note
	function playNote(note: string) {
		if (isAudioInitialized && sampler && samplerLoaded) {
			const bestOctave = getDegreeOctave(note);
			sampler.triggerAttackRelease(note + bestOctave, '4n', Tone.now() + 0.19);
		}
	}

    // Utility: speak a sequence of degrees one per beat
    function speakSequence(degrees: number[], startTime = Tone.now() + 0.05) {
        if (!voiceEnabled || !voiceSamplerLoaded) return;

        voiceQueue = [];
        if (voiceTimeout) {
            clearTimeout(voiceTimeout);
            voiceTimeout = null;
        }

        if (voiceSampler.context.state !== 'running') {
            voiceSampler.context.resume();
        }

        const step = beatDuration / 1000;
        degrees.forEach((deg, idx) => {
            const label = degreeButtons[deg - 1];
            const note = degreeToNote[label];
            if (note) {
                try {
                    voiceSampler.triggerAttackRelease(note, '4n', startTime + idx * step);
                } catch (error) {
                    console.error(`Failed to play voice ${label}:`, error);
                }
            }
        });
    }
    
    // Process voice queue with fallback timing
    function processVoiceQueue() {
        if (voiceQueue.length === 0) return;
        
        const currentItem = voiceQueue.shift();
        if (!currentItem) return;
        
        const delay = currentItem.time * 1000; // Convert to milliseconds
        
        voiceTimeout = setTimeout(() => {
            try {
                // Double-check audio context is still running
                if (voiceSampler.context.state !== 'running') {
                    voiceSampler.context.resume().then(() => {
                        voiceSampler.triggerAttackRelease(currentItem.note, '4n');
                    });
                } else {
                    voiceSampler.triggerAttackRelease(currentItem.note, '4n');
                }
            } catch (error) {
                console.error(`Failed to play voice ${currentItem.degree}:`, error);
            }
            
            // Process next item in queue
            processVoiceQueue();
        }, delay);
    }

    // Utility: play a sequence of scale notes one per beat
    function playSequence(degrees: number[], startTime = Tone.now() + 0.05) {
        if (!isAudioInitialized || !samplerLoaded) return;
        const step = beatDuration / 1000;
        degrees.forEach((deg, idx) => {
            const targetNote = currentScale[deg - 1];
            const bestOctave = getDegreeOctave(targetNote);
            sampler.triggerAttackRelease(targetNote + bestOctave, '4n', startTime + idx * step);
        });
    }

    // Show the correct answer (announce or play full sequence depending on mode)
    function showCorrectAnswer() {
        if (correctAnswer && correctAnswer.length > 0) {
            const degreeText = correctAnswer.map((d) => degreeButtons[d - 1]).join(' ');
            feedback = degreeText;

            const answerTime = Tone.now() + 0.05;
            if (tonicOnAnswer) {
                playTonicOnQuestion(answerTime);
            }

            if (callDegreeFirst) {
                playSequence(correctAnswer, answerTime);
            } else {
                speakSequence(correctAnswer, answerTime);
            }

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
		if (droneSampler) {
			try { droneSampler.dispose(); } catch {}
			droneSamplerLoaded = false;
			dronePlaying = false;
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
		maybeChangeRandomKey();
		advanceTonicIfNeeded();
		pickDegreeOctaveOffset();
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

        const revealBeats = Math.max(2, desiredCount);
        const answerClickNum = desiredCount + clicksBeforeAnswer + 1;
        const totalClicks = desiredCount + clicksBeforeAnswer + revealBeats;
        let notesPresented = 0;

        startMetronome(totalClicks, (clickNum) => {
            if (clickNum === 1 && tonicEnabled) {
                playTonicOnQuestion();
            }
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

            if (clickNum === answerClickNum) {
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
		questionsInCurrentKey = 0;
		questionsOnActiveTonic = 0;
		tonicRotateIndex = 0;
		if (selectedTonicDegrees.length > 0) {
			activeTonicDegree = getSortedTonicDegrees()[0];
		}
		gameStarted = true;
		generateNewQuestion();
	}

	// Stop the game
	function stopGame() {
		if (questionTimeout) {
			clearTimeout(questionTimeout);
			questionTimeout = null;
		}
		if (voiceTimeout) {
			clearTimeout(voiceTimeout);
			voiceTimeout = null;
		}
		voiceQueue = [];
		stopMetronome();
		stopDrone();
		gameStarted = false;
		correctAnswer = null;
		feedback = '';
		questionCount = 0;
		lastDegree = null;
		questionsInCurrentKey = 0;
		questionsOnActiveTonic = 0;
	}

	$effect(() => {
		if (!gameStarted || !isAudioInitialized) return;
		tonicEnabled;
		tonicSustainEnabled;
		droneRegister;
		droneVolume;
		selectedKey;
		activeTonicDegree;
		droneSamplerLoaded;
		if (tonicEnabled && tonicSustainEnabled && droneSamplerLoaded) {
			updateDronePitch();
		} else {
			stopDrone();
		}
	});

	// Speak the degree using Tone.js Sampler
	function speakDegree(degree: string) {
		if (!voiceEnabled || !voiceSamplerLoaded) return;
		const note = degreeToNote[degree];
		if (voiceSampler && note) {
			// Ensure audio context is running
			if (voiceSampler.context.state !== 'running') {
				voiceSampler.context.resume();
			}
			
			try {
				voiceSampler.triggerAttackRelease(note, '1n', Tone.now() + 0.05);
			} catch (error) {
				console.error(`Failed to play voice ${degree}:`, error);
			}
		}
	}
</script>

<div class="flex flex-col items-center p-6">
    <h1 class="mb-8 text-3xl font-bold">Dictation Practice</h1>
	
	<!-- Settings Panel -->
	<div class="mb-8 w-full max-w-2xl rounded-lg bg-gray-50 p-6 dark:bg-gray-800">
		<div class="mb-4 flex flex-wrap items-center justify-between gap-2">
			<h2 class="text-xl font-semibold">Settings</h2>
			<div class="flex items-center gap-2">
				<button
					type="button"
					class="rounded border border-gray-300 bg-white px-3 py-1 text-sm font-medium hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
					onclick={() => savePracticeSettings(true)}
				>
					Save settings
				</button>
				{#if settingsSaveMessage}
					<span class="text-xs text-green-600 dark:text-green-400">{settingsSaveMessage}</span>
				{/if}
			</div>
		</div>
		
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
		<div class="mb-4 flex flex-col gap-1">
		<div class="flex items-center gap-4">
			<span class="text-sm font-medium">Lowest Note:</span>
			<select
				bind:value={lowestNote}
				disabled={tonicEnabled && degreeOctavesFromTonic}
				class="rounded border border-gray-300 bg-white px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-white"
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
		{#if tonicEnabled && degreeOctavesFromTonic}
			<p class="text-xs text-gray-600 dark:text-gray-400">
				Degree pitches use the current tonic ({getTonicPitch()}) as the floor instead of lowest note.
			</p>
		{/if}
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

        <div class="mb-4 flex flex-wrap items-center gap-4">
            <span class="text-sm font-medium">Clicks before answer:</span>
            <input
                type="range"
                min="0"
                max="8"
                step="1"
                bind:value={clicksBeforeAnswer}
                class="w-48 accent-blue-500"
            />
            <span class="text-sm"
                >{clicksBeforeAnswer} click{clicksBeforeAnswer !== 1 ? 's' : ''} after the melody</span
            >
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

		<!-- Tonic reference -->
		<div
			class="mb-4 flex flex-col items-center gap-2 rounded-lg bg-amber-50 p-4 dark:bg-amber-900/20"
		>
			<label class="flex cursor-pointer select-none items-center gap-2">
				<input type="checkbox" bind:checked={tonicEnabled} class="accent-amber-500" />
				<span class="text-sm font-medium">Enable tonic (plays each new question)</span>
			</label>
			{#if tonicEnabled}
				<div class="w-full">
					<span class="mb-2 block text-center text-sm font-medium">Tonic degree:</span>
					<div class="flex flex-wrap justify-center gap-2">
						{#each degreeButtons as degree, i}
							<button
								type="button"
								onclick={() => toggleTonicDegree(i + 1)}
								class="rounded border-2 px-3 py-1 text-lg font-bold transition-colors"
								class:bg-amber-600={selectedTonicDegrees.includes(i + 1)}
								class:text-white={selectedTonicDegrees.includes(i + 1)}
								class:border-amber-600={selectedTonicDegrees.includes(i + 1)}
								class:bg-gray-200={!selectedTonicDegrees.includes(i + 1)}
								class:text-gray-700={!selectedTonicDegrees.includes(i + 1)}
								class:border-gray-300={!selectedTonicDegrees.includes(i + 1)}
							>
								{degree}
							</button>
						{/each}
					</div>
				</div>
				{#if selectedTonicDegrees.length > 1}
					<div class="flex flex-wrap items-center justify-center gap-2">
						<span class="text-sm">Change tonic every</span>
						<input
							type="number"
							bind:value={tonicRotateFrequency}
							min="1"
							max="50"
							class="w-16 rounded border border-gray-300 bg-white px-2 py-1 text-center text-sm dark:bg-gray-700 dark:text-white"
						/>
						<span class="text-sm">question{tonicRotateFrequency !== 1 ? 's' : ''}</span>
					</div>
					<p class="text-center text-xs text-gray-600 dark:text-gray-400">
						Rotates: {getSortedTonicDegrees()
							.map((d) => degreeButtons[d - 1])
							.join(' → ')}
					</p>
				{/if}
				<label class="flex cursor-pointer select-none items-center gap-2">
					<input type="checkbox" bind:checked={tonicOnAnswer} class="accent-amber-500" />
					<span class="text-sm">Play bass note again on answer phase</span>
				</label>
				<label class="flex cursor-pointer select-none items-center gap-2">
					<input type="checkbox" bind:checked={tonicSustainEnabled} class="accent-amber-500" />
					<span class="text-sm">Sustain tonic between questions</span>
				</label>
				<div class="flex flex-wrap items-center justify-center gap-4">
					<span class="text-sm font-medium">Register from:</span>
					<select
						bind:value={droneRegister}
						class="max-w-[8rem] rounded border border-gray-300 bg-white px-3 py-1 text-sm dark:bg-gray-700 dark:text-white"
					>
						{#each droneRegisterOptions as reg (reg)}
							<option value={reg}>{reg}</option>
						{/each}
					</select>
					<span class="text-xs text-gray-600 dark:text-gray-400">
						Current: {degreeButtons[activeTonicDegree - 1]} → {getTonicPitch()} in {selectedKey}
					</span>
				</div>
				<div class="flex items-center gap-4">
					<span class="text-sm font-medium">Tonic volume:</span>
					<input
						type="range"
						min="0"
						max="1"
						step="0.01"
						bind:value={droneVolume}
						class="w-48 accent-amber-500"
					/>
					<span class="text-sm">{Math.round(droneVolume * 100)}%</span>
				</div>
				<label class="flex cursor-pointer select-none items-center gap-2">
					<input type="checkbox" bind:checked={degreeOctavesFromTonic} class="accent-amber-500" />
					<span class="text-sm">Place degrees relative to tonic (never below tonic pitch)</span>
				</label>
				{#if degreeOctavesFromTonic}
					<div class="w-full">
						<span class="mb-2 block text-center text-sm font-medium"
							>Octave offsets to use (random each question):</span
						>
						<div class="flex flex-wrap justify-center gap-2">
							{#each [0, 1, 2, 3, 4] as offset (offset)}
								<button
									type="button"
									onclick={() => toggleDegreeOctaveOffset(offset)}
									class="rounded border-2 px-3 py-1 text-sm font-bold transition-colors"
									class:bg-amber-600={selectedDegreeOctaveOffsets.includes(offset)}
									class:text-white={selectedDegreeOctaveOffsets.includes(offset)}
									class:border-amber-600={selectedDegreeOctaveOffsets.includes(offset)}
									class:bg-gray-200={!selectedDegreeOctaveOffsets.includes(offset)}
									class:text-gray-700={!selectedDegreeOctaveOffsets.includes(offset)}
									class:border-gray-300={!selectedDegreeOctaveOffsets.includes(offset)}
								>
									+{offset}
								</button>
							{/each}
						</div>
					</div>
					<p class="text-center text-xs text-gray-600 dark:text-gray-400">
						Each question picks one offset above the tonic floor. Selected:
						{selectedDegreeOctaveOffsets.map((o) => `+${o}`).join(', ')}
					</p>
				{/if}
			{/if}
		</div>

		<!-- Random tone (key) change -->
		<div
			class="mb-4 flex flex-col items-center gap-2 rounded-lg bg-orange-50 p-4 dark:bg-orange-900/20"
		>
			<label class="flex cursor-pointer select-none items-center gap-2">
				<input type="checkbox" bind:checked={randomToneEnabled} class="accent-orange-500" />
				<span class="text-sm font-medium">Random tone (change key automatically)</span>
			</label>
			{#if randomToneEnabled}
				<div class="flex flex-wrap items-center justify-center gap-2">
					<span class="text-sm">Change key every</span>
					<input
						type="number"
						bind:value={randomToneFrequency}
						min="1"
						max="50"
						class="w-16 rounded border border-gray-300 bg-white px-2 py-1 text-center text-sm dark:bg-gray-700 dark:text-white"
					/>
					<span class="text-sm">question{randomToneFrequency !== 1 ? 's' : ''}</span>
				</div>
				<p class="text-center text-xs text-gray-600 dark:text-gray-400">
					Key picks randomly from the circle-of-fifths list (never repeats the same key twice).
					{#if gameStarted}
						Next change in {Math.max(0, randomToneFrequency - questionsInCurrentKey)} question(s).
					{/if}
				</p>
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
					Question {questionCount} · Key: {selectedKey}{#if tonicEnabled && degreeOctavesFromTonic}
						· Octave +{activeDegreeOctaveOffset}{/if}
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