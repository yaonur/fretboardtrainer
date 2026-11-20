import * as Tone from 'tone';

export type BassTimbre = 'piano' | 'pad';

export type BassVoice = {
	timbre: BassTimbre;
	ready: boolean;
	setVolumeDb: (db: number) => void;
	releaseAll: () => void;
	dispose: () => void;
	/** Play a note for a fixed duration (piano or pad envelope). */
	triggerForDuration: (pitch: string, durationSec: number, when: number) => void;
	/** Start a sustained pad note; ends on releaseAll or releaseAt. */
	triggerSustain: (pitch: string, when: number) => void;
	releaseAt: (when: number) => void;
};

function createPadSynth(): Tone.PolySynth {
	const synth = new Tone.PolySynth(Tone.Synth, {
		volume: -8,
		oscillator: { type: 'triangle' },
		envelope: { attack: 0.05, decay: 0.55, sustain: 0.98, release: 2.8 }
	});
	synth.maxPolyphony = 6;
	const filter = new Tone.Filter({ frequency: 520, type: 'lowpass', rolloff: -24 });
	synth.connect(filter);
	filter.toDestination();
	return synth;
}

function createPianoSampler(onload?: () => void): Tone.Sampler {
	return new Tone.Sampler({
		urls: { C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3' },
		release: 0.45,
		attack: 0.02,
		baseUrl: 'https://tonejs.github.io/audio/salamander/',
		onload
	}).toDestination();
}

export function createBassVoice(timbre: BassTimbre, onReady?: () => void): BassVoice {
	if (timbre === 'pad') {
		const synth = createPadSynth();
		onReady?.();
		let sustainPitch: string | null = null;
		return {
			timbre,
			ready: true,
			setVolumeDb: (db) => {
				synth.volume.value = db;
			},
			releaseAll: () => {
				sustainPitch = null;
				synth.releaseAll();
			},
			dispose: () => {
				synth.dispose();
			},
			triggerForDuration: (pitch, durationSec, when) => {
				synth.triggerAttackRelease(pitch, Math.max(0.05, durationSec), when);
			},
			triggerSustain: (pitch, when) => {
				if (sustainPitch === pitch) return;
				if (sustainPitch) synth.triggerRelease(when);
				sustainPitch = pitch;
				synth.triggerAttack(pitch, when);
			},
			releaseAt: (when) => {
				sustainPitch = null;
				synth.triggerRelease(when);
			}
		};
	}

	let pianoReady = false;
	const sampler = createPianoSampler(() => {
		pianoReady = true;
		onReady?.();
	});

	return {
		timbre,
		get ready() {
			return pianoReady;
		},
		setVolumeDb: (db) => {
			sampler.volume.value = db;
		},
		releaseAll: () => {
			sampler.releaseAll();
		},
		dispose: () => {
			sampler.dispose();
		},
		triggerForDuration: (pitch, durationSec, when) => {
			sampler.triggerAttackRelease(pitch, Math.max(0.05, durationSec), when);
		},
		triggerSustain: (pitch, when) => {
			sampler.triggerAttackRelease(pitch, '1m', when);
		},
		releaseAt: (when) => {
			sampler.triggerRelease(when);
		}
	};
}