import { browser } from '$app/environment';
import { isBarCount, type BarCount } from '$lib/audition/notation';

export const AUDITION_SETTINGS_KEY = 'auditionSettings';

export type AuditionPhase = 'listen' | 'audiate';

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
	hideMelody: boolean;
	barCount: BarCount;
	/** Melody ids in the random pool for each bar file (empty = all). */
	poolMelodyIds: Partial<Record<BarCount, string[]>>;
	phaseSequence: AuditionPhase[];
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
	hideMelody: false,
	barCount: 1,
	poolMelodyIds: {},
	phaseSequence: ['listen', 'audiate']
};

function sanitizePhaseSequence(raw: unknown): AuditionPhase[] {
	if (!Array.isArray(raw) || raw.length === 0) return [...defaultAuditionSettings.phaseSequence];
	const out: AuditionPhase[] = [];
	for (const item of raw) {
		if (item === 'listen' || item === 'audiate') out.push(item);
	}
	return out.length > 0 ? out : [...defaultAuditionSettings.phaseSequence];
}

function sanitizePoolIds(raw: unknown): Partial<Record<BarCount, string[]>> {
	if (!raw || typeof raw !== 'object') return {};
	const out: Partial<Record<BarCount, string[]>> = {};
	for (const bars of [1, 2, 3, 4] as const) {
		const key = String(bars);
		const list = (raw as Record<string, unknown>)[key] ?? (raw as Record<number, unknown>)[bars];
		if (!Array.isArray(list)) continue;
		const ids = list.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
		if (ids.length > 0) out[bars] = [...new Set(ids)];
	}
	return out;
}

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
		hideMelody: raw.hideMelody ?? defaults.hideMelody,
		barCount: isBarCount(barCount) ? barCount : defaults.barCount,
		poolMelodyIds: sanitizePoolIds(raw.poolMelodyIds),
		phaseSequence: sanitizePhaseSequence(raw.phaseSequence)
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
