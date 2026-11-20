import { browser } from '$app/environment';
import type { BassTimbre } from '$lib/audition/bassVoice';

export const FRETBOARD_TONIC_SETTINGS_KEY = 'fretboardTonicSettings';

export type FretboardTonicSettings = {
	tonicEnabled: boolean;
	tonicSustainEnabled: boolean;
	tonicTimbre: BassTimbre;
	tonicDegree: number;
	droneRegister: string;
	droneVolume: number;
};

export const defaultFretboardTonicSettings: FretboardTonicSettings = {
	tonicEnabled: false,
	tonicSustainEnabled: true,
	tonicTimbre: 'piano',
	tonicDegree: 1,
	droneRegister: 'C2',
	droneVolume: 0.35
};

function sanitize(raw: Partial<FretboardTonicSettings>): FretboardTonicSettings {
	const d = defaultFretboardTonicSettings;
	return {
		tonicEnabled: raw.tonicEnabled ?? d.tonicEnabled,
		tonicSustainEnabled: raw.tonicSustainEnabled ?? d.tonicSustainEnabled,
		tonicTimbre:
			raw.tonicTimbre === 'pad' || raw.tonicTimbre === 'piano' ? raw.tonicTimbre : d.tonicTimbre,
		tonicDegree:
			typeof raw.tonicDegree === 'number' && raw.tonicDegree >= 1 && raw.tonicDegree <= 7
				? raw.tonicDegree
				: d.tonicDegree,
		droneRegister: typeof raw.droneRegister === 'string' ? raw.droneRegister : d.droneRegister,
		droneVolume:
			typeof raw.droneVolume === 'number' && raw.droneVolume >= 0 && raw.droneVolume <= 1
				? raw.droneVolume
				: d.droneVolume
	};
}

export function loadFretboardTonicSettings(): FretboardTonicSettings {
	if (!browser) return { ...defaultFretboardTonicSettings };
	try {
		const raw = JSON.parse(
			localStorage.getItem(FRETBOARD_TONIC_SETTINGS_KEY) || '{}'
		) as Partial<FretboardTonicSettings>;
		return sanitize(raw);
	} catch {
		return { ...defaultFretboardTonicSettings };
	}
}

export function saveFretboardTonicSettings(settings: FretboardTonicSettings): void {
	if (!browser) return;
	localStorage.setItem(FRETBOARD_TONIC_SETTINGS_KEY, JSON.stringify(sanitize(settings)));
}