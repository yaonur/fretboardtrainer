// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

interface ImportMetaEnv {
	/** GET JSON: array of presets or `{ presets: [...] }`. When set, offline preset edits stay in memory only; reconnect pulls server data into IndexedDB. */
	readonly PUBLIC_PRESETS_SYNC_URL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
