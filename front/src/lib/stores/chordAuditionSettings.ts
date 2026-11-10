import { browser } from '$app/environment';
import { CIRCLE_OF_FIFTHS, type CircleRoot } from '$lib/chords/chordPrompts';
import { isBeatsPerChord, type BeatsPerChord } from '$lib/chord-audition/notation';
import type { AuditionPhase } from '$lib/stores/auditionSettings';

export const CHORD_AUDITION_SETTINGS_KEY = 'chordAuditionSettings';

export type AudiateBass = 'off' | 'roots' | 'tonic';

export type ChordAuditionSettings = {
	selectedKey: CircleRoot;
	bpm: number;
	beatsPerChord: BeatsPerChord;
	clickEnabled: boolean;
	clickVolume: number;
	audiateBass: AudiateBass;
	bassRegister: string;
	hideProgression: boolean;
	length: number;
	poolIdsByLength: Partial<Record<number, string[]>>;
	phaseSequence: AuditionPhase[];
};

export const defaultChordAuditionSettings: ChordAuditionSettings = {
	selectedKey: 'C',
	bpm: 80,
	beatsPerChord: 4,
	clickEnabled: true,
	clickVolume: 0.35,
	audiateBass: 'roots',
	bassRegister: 'C3',
	hideProgression: false,
	length: 4,
	poolIdsByLength: {},
	phaseSequence: ['listen', 'audiate']
};

function sanitizePhaseSequence(raw: unknown): AuditionPhase[] {
	if (!Array.isArray(raw) || raw.length === 0) {
		return [...defaultChordAuditionSettings.phaseSequence];
	}
	const out: AuditionPhase[] = [];
	for (const item of raw) {
		if (item === 'listen' || item === 'audiate') out.push(item);
	}
	return out.length > 0 ? out : [...defaultChordAuditionSettings.phaseSequence];
}

function sanitizePool(raw: unknown): Partial<Record<number, string[]>> {
	if (!raw || typeof raw !== 'object') return {};
	const out: Partial<Record<number, string[]>> = {};
	for (const [key, list] of Object.entries(raw as Record<string, unknown>)) {
		const length = Number(key);
		if (!Number.isInteger(length) || length < 1 || !Array.isArray(list)) continue;
		const ids = list.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
		if (ids.length > 0) out[length] = [...new Set(ids)];
	}
	return out;
}

function sanitize(raw: Partial<ChordAuditionSettings>): ChordAuditionSettings {
	const defaults = defaultChordAuditionSettings;
	const beats = Number(raw.beatsPerChord);
	const length = Number(raw.length);
	const key = CIRCLE_OF_FIFTHS.includes(raw.selectedKey as CircleRoot)
		? (raw.selectedKey as CircleRoot)
		: defaults.selectedKey;
	const bass: AudiateBass =
		raw.audiateBass === 'off' || raw.audiateBass === 'roots' || raw.audiateBass === 'tonic'
			? raw.audiateBass
			: defaults.audiateBass;
	return {
		selectedKey: key,
		bpm: typeof raw.bpm === 'number' && raw.bpm >= 40 && raw.bpm <= 200 ? raw.bpm : defaults.bpm,
		beatsPerChord: isBeatsPerChord(beats) ? beats : defaults.beatsPerChord,
		clickEnabled: raw.clickEnabled ?? defaults.clickEnabled,
		clickVolume:
			typeof raw.clickVolume === 'number' && raw.clickVolume >= 0 && raw.clickVolume <= 1
				? raw.clickVolume
				: defaults.clickVolume,
		audiateBass: bass,
		bassRegister:
			typeof raw.bassRegister === 'string' && /^[A-G]#?\d$/.test(raw.bassRegister)
				? raw.bassRegister
				: defaults.bassRegister,
		hideProgression: raw.hideProgression ?? defaults.hideProgression,
		length: Number.isInteger(length) && length >= 1 && length <= 32 ? length : defaults.length,
		poolIdsByLength: sanitizePool(raw.poolIdsByLength),
		phaseSequence: sanitizePhaseSequence(raw.phaseSequence)
	};
}

export function loadChordAuditionSettings(): ChordAuditionSettings {
	if (!browser) return { ...defaultChordAuditionSettings, poolIdsByLength: {} };
	try {
		const raw = JSON.parse(
			localStorage.getItem(CHORD_AUDITION_SETTINGS_KEY) || '{}'
		) as Partial<ChordAuditionSettings>;
		return sanitize(raw);
	} catch {
		return { ...defaultChordAuditionSettings, poolIdsByLength: {} };
	}
}
