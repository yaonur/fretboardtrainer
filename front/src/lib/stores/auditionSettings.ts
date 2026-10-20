import { browser } from '$app/environment';
import { isBarCount, type BarCount } from '$lib/audition/notation';

export const AUDITION_SETTINGS_KEY = 'auditionSettings';

export type AuditionSettings = {
	selectedKey: string;
	bpm: number;
	clickEnabled: boolean;
	clickVolume: number;
	bassEnabled: boolean;
	bassDegree: number;
	bassSustain: boolean;
	droneRegister: string;
	droneVolume: number;
	melodyOctave: number;
	loop: boolean;
	autoAdvance: boolean;
	hideMelody: boolean;
	barCount: BarCount;
};

export const defaultAuditionSettings: AuditionSettings = {
	selectedKey: 'A',
	bpm: 80,
	clickEnabled: true,
	clickVolume: 0.35,
	bassEnabled: true,
	bassDegree: 1,
	bassSustain: false,
	droneRegister: 'C2',
	droneVolume: 0.45,
	melodyOctave: 0,
	loop: false,
	autoAdvance: false,
	hideMelody: false,
	barCount: 1
};

function sanitize(raw: Partial<AuditionSettings>): AuditionSettings {
	const defaults = defaultAuditionSettings;
	const barCount = Number(raw.barCount);
	return {
		selectedKey: typeof raw.selectedKey === 'string' ? raw.selectedKey : defaults.selectedKey,
		bpm: typeof raw.bpm === 'number' && raw.bpm >= 40 && raw.bpm <= 200 ? raw.bpm : defaults.bpm,
		clickEnabled: raw.clickEnabled ?? defaults.clickEnabled,
		clickVolume:
			typeof raw.clickVolume === 'number' && raw.clickVolume >= 0 && raw.clickVolume <= 1
				? raw.clickVolume
				: defaults.clickVolume,
		bassEnabled: raw.bassEnabled ?? defaults.bassEnabled,
		bassDegree:
			typeof raw.bassDegree === 'number' && raw.bassDegree >= 1 && raw.bassDegree <= 7
				? raw.bassDegree
				: defaults.bassDegree,
		bassSustain: raw.bassSustain ?? defaults.bassSustain,
		droneRegister:
			typeof raw.droneRegister === 'string' ? raw.droneRegister : defaults.droneRegister,
		droneVolume:
			typeof raw.droneVolume === 'number' && raw.droneVolume >= 0 && raw.droneVolume <= 1
				? raw.droneVolume
				: defaults.droneVolume,
		melodyOctave:
			typeof raw.melodyOctave === 'number' && raw.melodyOctave >= -1 && raw.melodyOctave <= 2
				? raw.melodyOctave
				: defaults.melodyOctave,
		loop: raw.loop ?? defaults.loop,
		autoAdvance: raw.autoAdvance ?? defaults.autoAdvance,
		hideMelody: raw.hideMelody ?? defaults.hideMelody,
		barCount: isBarCount(barCount) ? barCount : defaults.barCount
	};
}

export function loadAuditionSettings(): AuditionSettings {
	if (!browser) return { ...defaultAuditionSettings };
	try {
		const raw = JSON.parse(
			localStorage.getItem(AUDITION_SETTINGS_KEY) || '{}'
		) as Partial<AuditionSettings>;
		return sanitize(raw);
	} catch {
		return { ...defaultAuditionSettings };
	}
}
