const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** Semitone steps from tonic for major-scale degrees 1–7. */
const MAJOR_DEGREE_STEPS = [0, 2, 4, 5, 7, 9, 11] as const;

const MIDI_FLOOR = (1 + 1) * 12 + 0; // C1
const MIDI_CEILING = (6 + 1) * 12 + 11; // B6

export function parsePitch(pitch: string): { noteName: string; octave: number } {
	const match = /^([A-G]#?)(-?\d+)$/.exec(pitch);
	if (!match) return { noteName: 'C', octave: 3 };
	return { noteName: match[1], octave: Number(match[2]) };
}

export function pitchToMidi(noteName: string, octave: number): number {
	const pc = NOTE_NAMES.indexOf(noteName as (typeof NOTE_NAMES)[number]);
	if (pc < 0) return 60;
	return (octave + 1) * 12 + pc;
}

export function midiToPitch(midi: number): string {
	const rounded = Math.round(midi);
	const pc = ((rounded % 12) + 12) % 12;
	const octave = Math.floor(rounded / 12) - 1;
	return `${NOTE_NAMES[pc]}${octave}`;
}

/** Place a chromatic note name in the octave band of a reference pitch. */
export function getBestOctaveForReference(noteName: string, referenceNote: string): number {
	const reference = parsePitch(referenceNote);
	const targetIndex = NOTE_NAMES.indexOf(noteName as (typeof NOTE_NAMES)[number]);
	const referenceIndex = NOTE_NAMES.indexOf(reference.noteName as (typeof NOTE_NAMES)[number]);
	if (targetIndex === -1 || referenceIndex === -1) return 4;
	if (targetIndex < referenceIndex) return reference.octave + 1;
	return reference.octave;
}

/**
 * Melody pitch anchored on scale degree 1: tonic sets the register floor,
 * other degrees follow diatonic steps. Matches prior bass-on-I behavior when
 * `globalMelodyOctave` is the Audition “melody register” offset.
 */
export function melodyPitchFromTonic(
	scale: string[],
	degree: number,
	droneRegister: string,
	globalMelodyOctave: number,
	perNoteOctaveOffset: number
): string {
	const tonicName = scale[0] ?? 'C';
	const tonicOctave = getBestOctaveForReference(tonicName, droneRegister) + 1 + globalMelodyOctave;
	const tonicMidi = pitchToMidi(tonicName, tonicOctave);
	const step = MAJOR_DEGREE_STEPS[degree - 1] ?? 0;
	let midi = tonicMidi + step + perNoteOctaveOffset * 12;
	midi = Math.max(MIDI_FLOOR, Math.min(MIDI_CEILING, midi));
	return midiToPitch(midi);
}