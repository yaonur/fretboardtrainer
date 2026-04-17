import { openDB } from 'idb';
import { browser } from '$app/environment';
import { connectivity } from '$lib/offline/connectivity.svelte';
import { isPresetRemoteSyncEnabled } from '$lib/offline/presetSyncUrl';
import { pullPresetsFromRemote } from '$lib/offline/pullPresetsFromRemote';
import type { FretboardPreset } from './fretboardPresetTypes';

export type { FretboardPreset } from './fretboardPresetTypes';

const DB_NAME = 'fretboardtrainer';
const STORE_NAME = 'presets';
const DB_VERSION = 1;

async function getDb() {
	return openDB(DB_NAME, DB_VERSION, {
		upgrade(db) {
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: 'name' });
			}
		}
	});
}

class FretboardPresetsStore {
	#idbPresets: FretboardPreset[] = [];
	#sessionEdits = new Map<string, FretboardPreset>();
	#sessionDeletes = new Set<string>();
	#presets: FretboardPreset[] = $state([]);

	constructor() {
		if (browser) {
			window.addEventListener('online', () => {
				void this.syncFromRemote();
			});
			void this.bootstrap();
		}
	}

	get presets() {
		return this.#presets;
	}

	#recomputePresets() {
		const byName = new Map<string, FretboardPreset>();
		for (const p of this.#idbPresets) {
			if (this.#sessionDeletes.has(p.name)) continue;
			byName.set(p.name, p);
		}
		for (const [n, p] of this.#sessionEdits) {
			byName.set(n, p);
		}
		this.#presets = [...byName.values()];
	}

	async bootstrap() {
		await this.loadPresetsFromIdb();
		if (isPresetRemoteSyncEnabled() && navigator.onLine) {
			await this.syncFromRemote();
		}
	}

	/** Replaces local IndexedDB presets with the remote payload when online. Discards in-memory offline edits. */
	async syncFromRemote(): Promise<void> {
		if (!browser) return;
		if (!isPresetRemoteSyncEnabled()) return;
		if (!navigator.onLine) return;
		try {
			const remote = await pullPresetsFromRemote();
			const db = await getDb();
			const tx = db.transaction(STORE_NAME, 'readwrite');
			await tx.store.clear();
			for (const p of remote) {
				await tx.store.put(p);
			}
			await tx.done;
			this.#sessionEdits.clear();
			this.#sessionDeletes.clear();
			await this.loadPresetsFromIdb();
		} catch (e) {
			console.warn('[presets] remote sync failed', e);
		}
	}

	async loadPresetsFromIdb() {
		if (!browser) return;
		const db = await getDb();
		this.#idbPresets = (await db.getAll(STORE_NAME)) as FretboardPreset[];
		this.#recomputePresets();
	}

	async savePreset(preset: FretboardPreset) {
		if (!browser) return;
		if (isPresetRemoteSyncEnabled() && !connectivity.online) {
			this.#sessionEdits.set(preset.name, preset);
			this.#sessionDeletes.delete(preset.name);
			this.#recomputePresets();
			return;
		}
		const db = await getDb();
		await db.put(STORE_NAME, preset);
		this.#sessionEdits.delete(preset.name);
		this.#sessionDeletes.delete(preset.name);
		await this.loadPresetsFromIdb();
	}

	async deletePreset(name: string) {
		if (!browser) return;
		if (isPresetRemoteSyncEnabled() && !connectivity.online) {
			this.#sessionDeletes.add(name);
			this.#sessionEdits.delete(name);
			this.#recomputePresets();
			return;
		}
		const db = await getDb();
		await db.delete(STORE_NAME, name);
		this.#sessionEdits.delete(name);
		this.#sessionDeletes.delete(name);
		await this.loadPresetsFromIdb();
	}

	async getPreset(name: string): Promise<FretboardPreset | undefined> {
		if (!browser) return undefined;
		if (this.#sessionDeletes.has(name)) return undefined;
		const fromSession = this.#sessionEdits.get(name);
		if (fromSession) return structuredClone(fromSession);
		const db = await getDb();
		return db.get(STORE_NAME, name);
	}
}

export const fretboardPresetsStore = new FretboardPresetsStore();
