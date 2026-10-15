import { browser } from '$app/environment';

const STORAGE_KEY = 'listeningPracticeSettings';

export type ListeningPracticeSettings = {
	selectedKey: string;
	lowestNote: string;
	selectedDegrees: number[];
	anchorModeEnabled: boolean;
	anchorDegree: number;
	anchorFrequency: number;
	voiceEnabled: boolean;
	callDegreeFirst: boolean;
	announceOnly: boolean;
	bpm: number;
	questionClicks: number;
	answerClicks: number;
	clickVolume: number;
	voiceVolume: number;
	noteSustainEnabled: boolean;
	noteSustainMultiplier: number;
	tonicEnabled: boolean;
	tonicSustainEnabled: boolean;
	selectedTonicDegrees: number[];
	tonicRotateFrequency: number;
	droneRegister: string;
	droneVolume: number;
	degreeOctavesFromTonic: boolean;
	selectedDegreeOctaveOffsets: number[];
	randomToneEnabled: boolean;
	randomToneFrequency: number;
	sequenceModeEnabled: boolean;
	sequenceInput: string;
	sequenceFrequency: number;
};

export const defaultListeningPracticeSettings: ListeningPracticeSettings = {
	selectedKey: 'A',
	lowestNote: 'G3',
	selectedDegrees: [1, 2, 3, 4, 5, 6, 7],
	anchorModeEnabled: false,
	anchorDegree: 1,
	anchorFrequency: 2,
	voiceEnabled: true,
	callDegreeFirst: false,
	announceOnly: false,
	bpm: 120,
	questionClicks: 2,
	answerClicks: 2,
	clickVolume: 1,
	voiceVolume: 1,
	noteSustainEnabled: false,
	noteSustainMultiplier: 1,
	tonicEnabled: false,
	tonicSustainEnabled: false,
	selectedTonicDegrees: [1],
	tonicRotateFrequency: 3,
	droneRegister: 'C2',
	droneVolume: 0.35,
	degreeOctavesFromTonic: false,
	selectedDegreeOctaveOffsets: [0, 1],
	randomToneEnabled: false,
	randomToneFrequency: 10,
	sequenceModeEnabled: false,
	sequenceInput: '4-2-1-3',
	sequenceFrequency: 3
};

function clampDegreeList(degrees: unknown, fallback: number[]): number[] {
	if (!Array.isArray(degrees)) return fallback;
	const filtered = degrees
		.map((d) => Number(d))
		.filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);
	return filtered.length > 0 ? [...new Set(filtered)].sort((a, b) => a - b) : fallback;
}

function clampOctaveOffsets(offsets: unknown, fallback: number[]): number[] {
	if (!Array.isArray(offsets)) return fallback;
	const filtered = offsets
		.map((o) => Number(o))
		.filter((o) => Number.isInteger(o) && o >= 0 && o <= 4);
	return filtered.length > 0 ? [...new Set(filtered)].sort((a, b) => a - b) : fallback;
}

function sanitize(raw: Partial<ListeningPracticeSettings>): ListeningPracticeSettings {
	const d = defaultListeningPracticeSettings;
	return {
		selectedKey: typeof raw.selectedKey === 'string' ? raw.selectedKey : d.selectedKey,
		lowestNote: typeof raw.lowestNote === 'string' ? raw.lowestNote : d.lowestNote,
		selectedDegrees: clampDegreeList(raw.selectedDegrees, d.selectedDegrees),
		anchorModeEnabled: raw.anchorModeEnabled ?? d.anchorModeEnabled,
		anchorDegree:
			typeof raw.anchorDegree === 'number' && raw.anchorDegree >= 1 && raw.anchorDegree <= 7
				? raw.anchorDegree
				: d.anchorDegree,
		anchorFrequency:
			typeof raw.anchorFrequency === 'number' && raw.anchorFrequency >= 1
				? raw.anchorFrequency
				: d.anchorFrequency,
		voiceEnabled: raw.voiceEnabled ?? d.voiceEnabled,
		callDegreeFirst: raw.callDegreeFirst ?? d.callDegreeFirst,
		announceOnly: raw.announceOnly ?? d.announceOnly,
		bpm: typeof raw.bpm === 'number' && raw.bpm >= 40 && raw.bpm <= 240 ? raw.bpm : d.bpm,
		questionClicks:
			typeof raw.questionClicks === 'number' && raw.questionClicks >= 1 && raw.questionClicks <= 8
				? raw.questionClicks
				: d.questionClicks,
		answerClicks:
			typeof raw.answerClicks === 'number' && raw.answerClicks >= 1 && raw.answerClicks <= 8
				? raw.answerClicks
				: d.answerClicks,
		clickVolume:
			typeof raw.clickVolume === 'number' && raw.clickVolume >= 0 && raw.clickVolume <= 1
				? raw.clickVolume
				: d.clickVolume,
		voiceVolume:
			typeof raw.voiceVolume === 'number' && raw.voiceVolume >= 0 && raw.voiceVolume <= 1
				? raw.voiceVolume
				: d.voiceVolume,
		noteSustainEnabled: raw.noteSustainEnabled ?? d.noteSustainEnabled,
		noteSustainMultiplier:
			typeof raw.noteSustainMultiplier === 'number' &&
			raw.noteSustainMultiplier >= 0.5 &&
			raw.noteSustainMultiplier <= 4
				? raw.noteSustainMultiplier
				: d.noteSustainMultiplier,
		tonicEnabled: raw.tonicEnabled ?? d.tonicEnabled,
		tonicSustainEnabled: raw.tonicSustainEnabled ?? d.tonicSustainEnabled,
		selectedTonicDegrees: clampDegreeList(raw.selectedTonicDegrees, d.selectedTonicDegrees),
		tonicRotateFrequency:
			typeof raw.tonicRotateFrequency === 'number' &&
			raw.tonicRotateFrequency >= 1 &&
			raw.tonicRotateFrequency <= 50
				? raw.tonicRotateFrequency
				: d.tonicRotateFrequency,
		droneRegister: typeof raw.droneRegister === 'string' ? raw.droneRegister : d.droneRegister,
		droneVolume:
			typeof raw.droneVolume === 'number' && raw.droneVolume >= 0 && raw.droneVolume <= 1
				? raw.droneVolume
				: d.droneVolume,
		degreeOctavesFromTonic: raw.degreeOctavesFromTonic ?? d.degreeOctavesFromTonic,
		selectedDegreeOctaveOffsets: clampOctaveOffsets(
			raw.selectedDegreeOctaveOffsets,
			d.selectedDegreeOctaveOffsets
		),
		randomToneEnabled: raw.randomToneEnabled ?? d.randomToneEnabled,
		randomToneFrequency:
			typeof raw.randomToneFrequency === 'number' &&
			raw.randomToneFrequency >= 1 &&
			raw.randomToneFrequency <= 50
				? raw.randomToneFrequency
				: d.randomToneFrequency,
		sequenceModeEnabled: raw.sequenceModeEnabled ?? d.sequenceModeEnabled,
		sequenceInput: typeof raw.sequenceInput === 'string' ? raw.sequenceInput : d.sequenceInput,
		sequenceFrequency:
			typeof raw.sequenceFrequency === 'number' && raw.sequenceFrequency >= 1
				? raw.sequenceFrequency
				: d.sequenceFrequency
	};
}

export function loadListeningPracticeSettings(): ListeningPracticeSettings {
	if (!browser) {
		return { ...defaultListeningPracticeSettings };
	}
	try {
		const raw = JSON.parse(
			localStorage.getItem(STORAGE_KEY) || '{}'
		) as Partial<ListeningPracticeSettings>;
		return sanitize(raw);
	} catch {
		return { ...defaultListeningPracticeSettings };
	}
}

export function saveListeningPracticeSettings(settings: ListeningPracticeSettings): void {
	if (!browser) return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitize(settings)));
}
