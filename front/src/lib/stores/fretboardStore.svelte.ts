import { openDB } from 'idb';
import { browser } from '$app/environment';

export type FretboardPreset = {
  name: string;
  selectedInstrument: string;
  selectedKey: string;
  lowestNote: string;
  stringRangeStart: number;
  stringRangeEnd: number;
  fretRangeStart: number;
  fretRangeEnd: number;
  anchorModeEnabled: boolean;
  anchorDegree: number;
  anchorFrequency: number;
};

const DB_NAME = 'fretboardtrainer';
const STORE_NAME = 'presets';
const DB_VERSION = 1;

async function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'name' });
      }
    },
  });
}

class FretboardPresetsStore {
  #presets: FretboardPreset[] = $state([]);

  constructor() {
    this.loadPresets();
  }

  get presets() {
    return this.#presets;
  }

  async loadPresets() {
    if (!browser) return;
    const db = await getDb();
    const all = await db.getAll(STORE_NAME);
    this.#presets = all as FretboardPreset[];
  }

  async savePreset(preset: FretboardPreset) {
    if (!browser) return;
    const db = await getDb();
    await db.put(STORE_NAME, preset);
    await this.loadPresets();
  }

  async deletePreset(name: string) {
    if (!browser) return;
    const db = await getDb();
    await db.delete(STORE_NAME, name);
    await this.loadPresets();
  }

  async getPreset(name: string): Promise<FretboardPreset | undefined> {
    if (!browser) return undefined;
    const db = await getDb();
    return db.get(STORE_NAME, name);
  }
}

export const fretboardPresetsStore = new FretboardPresetsStore(); 