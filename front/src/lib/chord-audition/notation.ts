export const BEAT_STEP = 0.5;
export const BEATS_PER_CHORD_OPTIONS = [1, 2, 4] as const;

export type BeatsPerChord = (typeof BEATS_PER_CHORD_OPTIONS)[number];

export type ChordEvent = {
	degree: number;
	beats: number;
};

export type ChordProgression = {
	id: string;
	name: string;
	notation: string;
	skill: string;
};

export type ChordLibrary = {
	beatsPerChord: BeatsPerChord;
	notationHelp: string;
	progressions: ChordProgression[];
};

export type ParseResult = {
	ok: boolean;
	chords: ChordEvent[];
	beats: number;
	error: string | null;
};

const TOKEN = /^([1-7])(?::(\d+(?:\.\d+)?))?$/;
const ROMAN = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];

export function isBeatsPerChord(value: number): value is BeatsPerChord {
	return value === 1 || value === 2 || value === 4;
}

export function chordCount(notation: string): number {
	return notation
		.trim()
		.split(/\s+/)
		.filter((token) => token !== '|' && TOKEN.test(token)).length;
}

export function parseProgression(notation: string, defaultBeats: number): ParseResult {
	const raw = notation.trim();
	if (!raw) return { ok: false, chords: [], beats: 0, error: 'Notation is empty' };

	const fallback = isBeatsPerChord(defaultBeats) ? defaultBeats : 4;
	const chords: ChordEvent[] = [];

	for (const token of raw.split(/\s+/)) {
		if (token === '|') continue;
		const match = TOKEN.exec(token);
		if (!match) {
			return {
				ok: false,
				chords,
				beats: sumBeats(chords),
				error: `Can't read "${token}"`
			};
		}
		const beats = match[2] === undefined ? fallback : Number(match[2]);
		if (!Number.isFinite(beats) || beats <= 0 || beats > 16) {
			return {
				ok: false,
				chords,
				beats: sumBeats(chords),
				error: `Bad duration in "${token}"`
			};
		}
		const steps = Math.round(beats / BEAT_STEP);
		if (Math.abs(steps * BEAT_STEP - beats) > 1e-6) {
			return {
				ok: false,
				chords,
				beats: sumBeats(chords),
				error: `"${token}" must be a multiple of a half beat`
			};
		}
		chords.push({ degree: Number(match[1]), beats: steps * BEAT_STEP });
	}

	if (chords.length === 0) {
		return { ok: false, chords, beats: 0, error: 'Add at least one chord' };
	}

	return { ok: true, chords, beats: sumBeats(chords), error: null };
}

export function sumBeats(chords: ChordEvent[]): number {
	return chords.reduce((total, chord) => total + chord.beats, 0);
}

export function romanForDegree(degree: number): string {
	return ROMAN[degree - 1] ?? String(degree);
}

export function formatDegrees(chords: ChordEvent[]): string {
	return chords.map((chord) => romanForDegree(chord.degree)).join('–');
}

export function normalizeChordLibrary(raw: unknown): ChordLibrary {
	const obj = (raw && typeof raw === 'object' ? raw : {}) as Partial<ChordLibrary>;
	const beats = Number(obj.beatsPerChord);
	const progressions = Array.isArray(obj.progressions) ? obj.progressions : [];
	return {
		beatsPerChord: isBeatsPerChord(beats) ? beats : 4,
		notationHelp:
			typeof obj.notationHelp === 'string' && obj.notationHelp.trim()
				? obj.notationHelp.trim()
				: '',
		progressions: progressions.map((progression, index) => ({
			id:
				typeof progression?.id === 'string' && progression.id.trim()
					? progression.id.trim()
					: `progression-${index + 1}`,
			name:
				typeof progression?.name === 'string' && progression.name.trim()
					? progression.name.trim()
					: `Progression ${index + 1}`,
			notation: typeof progression?.notation === 'string' ? progression.notation.trim() : '',
			skill: typeof progression?.skill === 'string' ? progression.skill.trim() : ''
		}))
	};
}

export function libraryIssues(library: ChordLibrary): string[] {
	const issues: string[] = [];
	const ids = new Set<string>();
	for (const progression of library.progressions) {
		const label = progression.name || progression.id;
		if (ids.has(progression.id)) issues.push(`Duplicate id "${progression.id}"`);
		ids.add(progression.id);
		const parsed = parseProgression(progression.notation, library.beatsPerChord);
		if (!parsed.ok) issues.push(`${label}: ${parsed.error}`);
	}
	return issues;
}

export function lengthsIn(library: ChordLibrary): number[] {
	const lengths = new Set<number>();
	for (const progression of library.progressions) {
		const count = chordCount(progression.notation);
		if (count > 0) lengths.add(count);
	}
	return [...lengths].sort((a, b) => a - b);
}
