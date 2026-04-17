/** When set, presets are pulled from this URL on load (while online) and on every `online` event. Offline edits are kept in memory only and discarded when a pull succeeds. */
export function getPresetsSyncUrl(): string | undefined {
	const raw = import.meta.env.PUBLIC_PRESETS_SYNC_URL;
	if (typeof raw !== 'string') return undefined;
	const t = raw.trim();
	return t.length > 0 ? t : undefined;
}

export function isPresetRemoteSyncEnabled(): boolean {
	return getPresetsSyncUrl() !== undefined;
}
