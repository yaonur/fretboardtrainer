import type { FretboardPreset } from '$lib/stores/fretboardPresetTypes';
import { getPresetsSyncUrl } from './presetSyncUrl';

function normalizePayload(json: unknown): FretboardPreset[] {
	if (Array.isArray(json)) {
		return json.filter((p): p is FretboardPreset => Boolean(p) && typeof (p as FretboardPreset).name === 'string');
	}
	if (json && typeof json === 'object' && 'presets' in json) {
		const presets = (json as { presets: unknown }).presets;
		if (Array.isArray(presets)) {
			return presets.filter(
				(p): p is FretboardPreset => Boolean(p) && typeof (p as FretboardPreset).name === 'string'
			);
		}
	}
	throw new Error('Expected a JSON array of presets or { presets: [...] }');
}

/** Fetches authoritative presets from the configured URL (live backend / CDN). */
export async function pullPresetsFromRemote(): Promise<FretboardPreset[]> {
	const url = getPresetsSyncUrl();
	if (!url) throw new Error('PUBLIC_PRESETS_SYNC_URL is not configured');

	const res = await fetch(url, { cache: 'no-store', credentials: 'omit' });
	if (!res.ok) {
		throw new Error(`Preset sync HTTP ${res.status}`);
	}
	const json: unknown = await res.json();
	return normalizePayload(json);
}
