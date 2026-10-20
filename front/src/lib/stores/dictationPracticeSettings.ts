import { browser } from '$app/environment';

const STORAGE_KEY = 'dictationPracticeSettings';

export type DictationPracticeSettings = {
	selectedKey: string;
	lowestNote: string;
	selectedDegrees: number[];
	voiceEnabled: boolean;
	callDegreeFirst: boolean;
	bpm: number;
	clickVolume: number;
	notesPerQuestion: number;
	clicksBeforeAnswer: number;
	tonicEnabled: boolean;
	tonicOnAnswer: boolean;
	tonicSustainEnabled: boolean;
	selectedTonicDegrees: number[];
	tonicRotateFrequency: number;
	droneRegister: string;
	droneVolume: number;
	degreeOctavesFromTonic: boolean;
	selectedDegreeOctaveOffsets: number[];
	randomToneEnabled: boolean;
	randomToneFrequency: number;
};

export const defaultDictationPracticeSettings: DictationPracticeSettings = {
	selectedKey: 'A',
	lowestNote: 'G3',
	selectedDegrees: [1, 2, 3, 4, 5, 6, 7],
	voiceEnabled: true,
	callDegreeFirst: false,
	bpm: 120,
	clickVolume: 1,
	notesPerQuestion: 2,
	clicksBeforeAnswer: 0,
	tonicEnabled: false,
	tonicOnAnswer: false,
	tonicSustainEnabled: false,
	selectedTonicDegrees: [1],
	tonicRotateFrequency: 3,
	droneRegister: 'C2',
	droneVolume: 0.35,
	degreeOctavesFromTonic: false,
	selectedDegreeOctaveOffsets: [0, 1],
	randomToneEnabled: false,
	randomToneFrequency: 10
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

function sanitize(raw: Partial<DictationPracticeSettings>): DictationPracticeSettings {
	const d = defaultDictationPracticeSettings;
	return {
		selectedKey: typeof raw.selectedKey === 'string' ? raw.selectedKey : d.selectedKey,
		lowestNote: typeof raw.lowestNote === 'string' ? raw.lowestNote : d.lowestNote,
		selectedDegrees: clampDegreeList(raw.selectedDegrees, d.selectedDegrees),
		voiceEnabled: raw.voiceEnabled ?? d.voiceEnabled,
		callDegreeFirst: raw.callDegreeFirst ?? d.callDegreeFirst,
		bpm: typeof raw.bpm === 'number' && raw.bpm >= 40 && raw.bpm <= 240 ? raw.bpm : d.bpm,
		clickVolume:
			typeof raw.clickVolume === 'number' && raw.clickVolume >= 0 && raw.clickVolume <= 1
				? raw.clickVolume
				: d.clickVolume,
		notesPerQuestion:
			typeof raw.notesPerQuestion === 'number' &&
			raw.notesPerQuestion >= 2 &&
			raw.notesPerQuestion <= 8
				? raw.notesPerQuestion
				: d.notesPerQuestion,
		clicksBeforeAnswer:
			typeof raw.clicksBeforeAnswer === 'number' &&
			raw.clicksBeforeAnswer >= 0 &&
			raw.clicksBeforeAnswer <= 8
				? raw.clicksBeforeAnswer
				: d.clicksBeforeAnswer,
		tonicEnabled: raw.tonicEnabled ?? d.tonicEnabled,
		tonicOnAnswer: raw.tonicOnAnswer ?? d.tonicOnAnswer,
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
				: d.randomToneFrequency
	};
}

export function loadDictationPracticeSettings(): DictationPracticeSettings {
	if (!browser) {
		return { ...defaultDictationPracticeSettings };
	}
	try {
		const raw = JSON.parse(
			localStorage.getItem(STORAGE_KEY) || '{}'
		) as Partial<DictationPracticeSettings>;
		return sanitize(raw);
	} catch {
		return { ...defaultDictationPracticeSettings };
	}
}

export function saveDictationPracticeSettings(settings: DictationPracticeSettings): void {
	if (!browser) return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitize(settings)));
}
