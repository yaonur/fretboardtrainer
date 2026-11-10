import { noteToPc } from '$lib/chords/chordPrompts';
import type { ChordEvent } from './notation';

const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export type VoicedChord = {
	degree: number;
	beats: number;
	bass: string;
	upper: string[];
};

export function pitchToMidi(pitch: string): number {
	const match = /^([A-G]#?)(-?\d+)$/.exec(pitch);
	if (!match) return 48;
	const pc = SHARP.indexOf(match[1]);
	if (pc < 0) return 48;
	return (Number(match[2]) + 1) * 12 + pc;
}

export function midiToPitch(midi: number): string {
	const rounded = Math.round(midi);
	const pc = ((rounded % 12) + 12) % 12;
	const octave = Math.floor(rounded / 12) - 1;
	return `${SHARP[pc]}${octave}`;
}

function lowestAtOrAbove(pc: number, floor: number): number {
	const octave = Math.floor((floor - pc) / 12);
	let midi = pc + octave * 12;
	if (midi < floor) midi += 12;
	return midi;
}

function nearestMidi(pc: number, target: number): number {
	const midi = pc + 12 * Math.round((target - pc) / 12);
	return midi;
}

function triadPcs(scale: string[], degree: number): number[] | null {
	if (degree < 1 || degree > 7 || scale.length !== 7) return null;
	const steps = [0, 2, 4];
	const pcs: number[] = [];
	for (const step of steps) {
		const pc = noteToPc(scale[(degree - 1 + step) % 7] ?? '');
		if (pc === null) return null;
		pcs.push(pc);
	}
	return pcs;
}

function closeVoicing(pcs: number[], inversion: number, floor: number): number[] | null {
	const bottom = lowestAtOrAbove(pcs[inversion]!, floor);
	const voices = [bottom];
	for (let offset = 1; offset < pcs.length; offset++) {
		const pc = pcs[(inversion + offset) % pcs.length]!;
		voices.push(lowestAtOrAbove(pc, voices[offset - 1]! + 1));
	}
	const span = voices[voices.length - 1]! - voices[0]!;
	if (span > 12) return null;
	return voices;
}

/** Lowest close-position inversion that sits at or above `floor`. */
function lowestCloseVoicing(pcs: number[], floor: number): number[] {
	let best: number[] | null = null;
	for (let inversion = 0; inversion < pcs.length; inversion++) {
		const voices = closeVoicing(pcs, inversion, floor);
		if (!voices) continue;
		if (!best || voices[0]! < best[0]!) best = voices;
	}
	return best ?? pcs.map((pc, index) => lowestAtOrAbove(pc, floor + index));
}

function voiceLead(pcs: number[], previous: number[]): number[] {
	const order = [0, 1, 2];
	const permutations: number[][] = [];
	const used = new Set<number>();
	function walk(path: number[]) {
		if (path.length === order.length) {
			permutations.push([...path]);
			return;
		}
		for (const index of order) {
			if (used.has(index)) continue;
			used.add(index);
			path.push(index);
			walk(path);
			path.pop();
			used.delete(index);
		}
	}
	walk([]);

	let best: number[] = previous.map((midi, index) => nearestMidi(pcs[index % pcs.length]!, midi));
	let bestCost = Infinity;
	for (const perm of permutations) {
		const midis = perm.map((pcIndex, voice) => nearestMidi(pcs[pcIndex]!, previous[voice]!));
		const unique = new Set(midis).size;
		const move = midis.reduce((sum, midi, index) => sum + Math.abs(midi - previous[index]!), 0);
		const spread = Math.max(...midis) - Math.min(...midis);
		const cost = move + (unique < pcs.length ? 36 : 0) + (spread > 16 ? (spread - 16) * 3 : 0);
		if (cost < bestCost) {
			bestCost = cost;
			best = midis;
		}
	}
	return best;
}

export function voiceProgression(
	scale: string[],
	chords: ChordEvent[],
	bassRegister: string
): VoicedChord[] {
	const floor = pitchToMidi(bassRegister);
	const upperFloor = floor + 12;
	let previous: number[] | null = null;
	const voiced: VoicedChord[] = [];

	for (const chord of chords) {
		const pcs = triadPcs(scale, chord.degree);
		if (!pcs) continue;
		const upper: number[] = previous
			? voiceLead(pcs, previous)
			: lowestCloseVoicing(pcs, upperFloor);
		previous = upper;
		voiced.push({
			degree: chord.degree,
			beats: chord.beats,
			bass: midiToPitch(lowestAtOrAbove(pcs[0]!, floor)),
			upper: upper.map(midiToPitch)
		});
	}

	return voiced;
}
