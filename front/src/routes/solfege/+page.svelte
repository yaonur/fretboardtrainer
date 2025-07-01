<script lang="ts">
// Make sure to install Magenta.js: npm install @magenta/music
import * as Tone from 'tone';
import { onMount } from 'svelte';

let melody: number[] = [];
let isLoading = false;

// Map MIDI pitch to C major scale degree (C4=60)
const midiToDegree = (midi: number): number | null => {
    const scale: number[] = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B
    const base = 60; // C4
    const interval = (midi - base + 12) % 12;
    const degree = scale.indexOf(interval) + 1;
    return degree > 0 ? degree : null;
};

const degreeToNote: string[] = ["C4", "D4", "E4", "F4", "G4", "A4", "B4"];

let sampler: Tone.Sampler;
let samplerLoaded = false;
let mm: typeof import('@magenta/music/es6');
let model: any;
let modelInitialized = false;

onMount(async () => {
  mm = await import('@magenta/music/es6');
});

async function initAudio() {
    if (!samplerLoaded) {
        sampler = new Tone.Sampler({
            urls: {
                C4: 'C4.mp3',
                'D#4': 'Ds4.mp3',
                'F#4': 'Fs4.mp3',
            },
            release: 1,
            baseUrl: 'https://tonejs.github.io/audio/salamander/',
            onload: () => {
                samplerLoaded = true;
            }
        }).toDestination();
        await Tone.start();
    }
}

async function initModel() {
    if (!modelInitialized && mm) {
        model = new mm.MusicRNN('https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/melody_rnn');
        await model.initialize();
        modelInitialized = true;
    }
}

async function generateMelody() {
    isLoading = true;
    melody = [];
    await initModel();
    // Use a two-note seed for more interesting output
    const seed: any = {
        notes: [
            { pitch: 60, startTime: 0, endTime: 0.5 }, // C4
            { pitch: 62, startTime: 0.5, endTime: 1.0 } // D4
        ],
        totalTime: 1.0
    };
    const stepsPerQuarter = 4;
    const quantizedSeed = mm.sequences.quantizeNoteSequence(seed, stepsPerQuarter);
    // Generate 8 steps (2 bars of 4/4)
    const result = await model.continueSequence(quantizedSeed, 8, 1.2);
    // Convert to scale degrees (C major) and filter out non-scale notes
    melody = (result.notes ?? [])
        .map((n: any) => midiToDegree(n.pitch))
        .filter((d: number | null): d is number => d !== null);
    isLoading = false;
}

async function playMelody() {
    console.log(melody)
    await initAudio();
    if (!samplerLoaded || melody.length === 0) return;
    let now = Tone.now();
    melody.forEach((degree: number, i: number) => {
        const note = degreeToNote[degree - 1];
        if (note) {
            sampler.triggerAttackRelease(note, '8n', now + i * 0.5);
        }
    });
}
</script>

<div class="flex flex-col items-center p-8">
    <h1 class="text-2xl font-bold mb-6">Solfege Coach (Magenta.js)</h1>
    <button class="mb-4 px-4 py-2 bg-blue-500 text-white rounded" on:click={generateMelody} disabled={isLoading}>
        {isLoading ? 'Generating...' : 'Generate Solfege'}
    </button>
    {#if melody.length > 0}
        <div class="mb-4 text-xl">
            {melody.join(' ')}
        </div>
        <button class="px-4 py-2 bg-green-500 text-white rounded" on:click={playMelody}>
            Play Melody
        </button>
    {/if}
</div> 