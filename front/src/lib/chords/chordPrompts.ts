/**
 * Chord prompts: diatonic chords from a chosen tonality, user-built pool, optional slash bass.
 */

export const CIRCLE_OF_FIFTHS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'] as const;
export type CircleRoot = (typeof CIRCLE_OF_FIFTHS)[number];

export const TONALITY_MODES = ['major', 'naturalMinor', 'harmonicMinor'] as const;
export type TonalityMode = (typeof TONALITY_MODES)[number];

const FLAT_TO_SHARP: Record<string, string> = {
	Db: 'C#',
	Eb: 'D#',
	Gb: 'F#',
	Ab: 'G#',
	Bb: 'A#'
};

const LETTER_CYCLE = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const NATURAL_PC: Record<string, number> = {
	C: 0,
	D: 2,
	E: 4,
	F: 5,
	G: 7,
	A: 9,
	B: 11
};

function toSharpName(note: string): string {
	return FLAT_TO_SHARP[note] ?? note;
}

export function noteToPc(note: string): number | null {
	const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
	const i = names.indexOf(toSharpName(note));
	return i === -1 ? null : i;
}

/** Semitones above tonic for each scale degree (1..7). */
const MODE_STEPS: Record<TonalityMode, number[]> = {
	major: [0, 2, 4, 5, 7, 9, 11],
	naturalMinor: [0, 2, 3, 5, 7, 8, 10],
	harmonicMinor: [0, 2, 3, 5, 7, 8, 11]
};

function parseTonicLetter(tonic: string): (typeof LETTER_CYCLE)[number] {
	const m = /^([A-G])/.exec(tonic);
	return (m?.[1] ?? 'C') as (typeof LETTER_CYCLE)[number];
}

function sevenLettersStartingAt(letter: (typeof LETTER_CYCLE)[number]): string[] {
	const i = LETTER_CYCLE.indexOf(letter);
	return Array.from({ length: 7 }, (_, k) => LETTER_CYCLE[(i + k) % 7]!);
}

function spellLetterToPc(letter: string, targetPc: number): string {
	const natural = NATURAL_PC[letter];
	if (natural === undefined) return letter;
	let diff = (targetPc - natural + 12) % 12;
	if (diff === 0) return letter;
	if (diff <= 6) {
		if (diff === 1) return `${letter}#`;
		if (diff === 2) return `${letter}##`;
	}
	const down = (natural - targetPc + 12) % 12;
	if (down === 1) return `${letter}b`;
	if (down === 2) return `${letter}bb`;
	return `${letter}#`;
}

/**
 * Seven diatonic note names for tonality (enharmonic spelling follows letter line from tonic).
 */
export function buildDiatonicScale(tonic: CircleRoot, mode: TonalityMode): string[] {
	const tonicPc = noteToPc(tonic);
	if (tonicPc === null) return [];
	const steps = MODE_STEPS[mode];
	const letters = sevenLettersStartingAt(parseTonicLetter(tonic));
	return letters.map((L, i) => {
		const pc = (tonicPc + steps[i]!) % 12;
		return spellLetterToPc(L, pc);
	});
}

export type ChordKind = 'triad' | 'seventh';

export type TonalityPoolEntry = {
	/** Scale degree 1–7 */
	degree: number;
	kind: ChordKind;
	/** Bass note = this scale degree (pedal / slash). Omit = chord root in bass. */
	slashBassDegree?: number;
};

export type ChordPromptPick = {
	label: string;
	tonalityRoot: CircleRoot;
	tonalityMode: TonalityMode;
	entry: TonalityPoolEntry;
};

export type ChordPromptsSettings = {
	tonalityRoot: CircleRoot;
	tonalityMode: TonalityMode;
	poolEntries: TonalityPoolEntry[];
	bpm: number;
	clicksPerChord: number;
	clickVolume: number;
	metronomeEnabled: boolean;
};

export const DEFAULT_CHORD_PROMPTS_SETTINGS: ChordPromptsSettings = {
	tonalityRoot: 'C',
	tonalityMode: 'major',
	poolEntries: [],
	bpm: 80,
	clicksPerChord: 4,
	clickVolume: 1,
	metronomeEnabled: true
};

function clamp(n: number, lo: number, hi: number, fallback: number): number {
	const x = Math.round(Number(n));
	if (!Number.isFinite(x)) return fallback;
	return Math.min(hi, Math.max(lo, x));
}

export function poolEntryKey(e: TonalityPoolEntry): string {
	return `${e.degree}-${e.kind}-${e.slashBassDegree ?? ''}`;
}

/** Suffix after chord root note (e.g. `m7`, `ø`, `maj7`). */
function classifyChordSymbol(
	rootPc: number,
	thirdPc: number,
	fifthPc: number,
	seventhPc: number | null
): { triadSuffix: string; seventhSuffix: string | null } {
	const i3 = (thirdPc - rootPc + 12) % 12;
	const i5 = (fifthPc - rootPc + 12) % 12;
	const i7 =
		seventhPc === null ? null : (seventhPc - rootPc + 12) % 12;

	let triadSuffix = '';
	if (i3 === 4 && i5 === 7) triadSuffix = '';
	else if (i3 === 3 && i5 === 7) triadSuffix = 'm';
	else if (i3 === 3 && i5 === 6) triadSuffix = 'dim';
	else if (i3 === 4 && i5 === 8) triadSuffix = 'aug';
	else triadSuffix = '';

	let seventhSuffix: string | null = null;
	if (i7 === null) return { triadSuffix, seventhSuffix };

	if (triadSuffix === '' && i3 === 4 && i5 === 7) {
		if (i7 === 11) seventhSuffix = 'maj7';
		else if (i7 === 10) seventhSuffix = '7';
	} else if (triadSuffix === 'm' && i3 === 3 && i5 === 7) {
		if (i7 === 10) seventhSuffix = 'm7';
		else if (i7 === 11) seventhSuffix = 'm(maj7)';
	} else if (triadSuffix === 'dim' || (i3 === 3 && i5 === 6)) {
		if (i7 === 10) seventhSuffix = 'ø';
		else if (i7 === 9) seventhSuffix = 'dim7';
	} else if (triadSuffix === 'aug') {
		if (i7 === 10 || i7 === 11) seventhSuffix = '7';
	}

	if (seventhSuffix === null) {
		if (i7 === 10) seventhSuffix = '7';
		else if (i7 === 11) seventhSuffix = 'maj7';
	}

	return { triadSuffix, seventhSuffix };
}

export function formatPoolEntryLabel(tonic: CircleRoot, mode: TonalityMode, entry: TonalityPoolEntry): string {
	const scale = buildDiatonicScale(tonic, mode);
	if (scale.length !== 7) return '?';

	const d = entry.degree;
	if (d < 1 || d > 7) return '?';

	const i0 = d - 1;
	const i2 = (i0 + 2) % 7;
	const i4 = (i0 + 4) % 7;
	const i6 = (i0 + 6) % 7;

	const r = scale[i0]!;
	const thirdPc = noteToPc(scale[i2]!)!;
	const fifthPc = noteToPc(scale[i4]!)!;
	const rootPc = noteToPc(r)!;

	if (entry.kind === 'triad') {
		const { triadSuffix } = classifyChordSymbol(rootPc, thirdPc, fifthPc, null);
		const base = `${r}${triadSuffix}`;
		if (entry.slashBassDegree !== undefined) {
			const b = entry.slashBassDegree;
			if (b >= 1 && b <= 7) {
				const bass = scale[b - 1]!;
				return `${base}/${bass}`;
			}
		}
		return base;
	}

	const seventhPc = noteToPc(scale[i6]!)!;
	const { triadSuffix, seventhSuffix } = classifyChordSymbol(rootPc, thirdPc, fifthPc, seventhPc);
	let body = `${r}`;
	if (seventhSuffix === 'm7' && triadSuffix === 'm') body = `${r}m7`;
	else if (seventhSuffix === 'maj7' && triadSuffix === '') body = `${r}maj7`;
	else if (seventhSuffix === '7' && triadSuffix === '') body = `${r}7`;
	else if (seventhSuffix === 'ø') body = `${r}ø`;
	else if (seventhSuffix === 'dim7') body = `${r}dim7`;
	else if (seventhSuffix === 'm(maj7)') body = `${r}m(maj7)`;
	else if (seventhSuffix) body = `${r}${triadSuffix}${seventhSuffix}`;
	else body = `${r}${triadSuffix}`;

	if (entry.slashBassDegree !== undefined) {
		const b = entry.slashBassDegree;
		if (b >= 1 && b <= 7) {
			const bass = scale[b - 1]!;
			return `${body}/${bass}`;
		}
	}
	return body;
}

/** Preview lines for builder UI: degree, roman hint, triad label, seventh label. */
export function diatonicDegreePreview(
	tonic: CircleRoot,
	mode: TonalityMode,
	degree: number
): { roman: string; triad: string; seventh: string } {
	const triad: TonalityPoolEntry = { degree, kind: 'triad' };
	const seventh: TonalityPoolEntry = { degree, kind: 'seventh' };
	const romans = romanNumeralForDegree(mode, degree);
	return {
		roman: romans,
		triad: formatPoolEntryLabel(tonic, mode, triad),
		seventh: formatPoolEntryLabel(tonic, mode, seventh)
	};
}

function romanNumeralForDegree(mode: TonalityMode, degree: number): string {
	const maj = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
	const natMin = ['i', 'ii°', 'bIII', 'iv', 'v', 'bVI', 'bVII'];
	const harmMin = ['i', 'ii°', 'bIII+', 'iv', 'V', 'bVI', 'vii°'];
	const t = mode === 'major' ? maj : mode === 'naturalMinor' ? natMin : harmMin;
	return t[degree - 1] ?? String(degree);
}

function randomItem<T>(arr: readonly T[]): T {
	return arr[Math.floor(Math.random() * arr.length)]!;
}

export function pickRandomChordFromPool(options: {
	tonalityRoot: CircleRoot;
	tonalityMode: TonalityMode;
	pool: TonalityPoolEntry[];
	lastLabel?: string | null;
}): ChordPromptPick | null {
	const pool = options.pool.filter(
		(e) =>
			e.degree >= 1 &&
			e.degree <= 7 &&
			(e.slashBassDegree === undefined || (e.slashBassDegree >= 1 && e.slashBassDegree <= 7))
	);
	if (pool.length === 0) return null;

	for (let attempt = 0; attempt < 50; attempt++) {
		const entry = randomItem(pool);
		const label = formatPoolEntryLabel(options.tonalityRoot, options.tonalityMode, entry);
		if (options.lastLabel && label === options.lastLabel && pool.length > 1) continue;
		return {
			label,
			tonalityRoot: options.tonalityRoot,
			tonalityMode: options.tonalityMode,
			entry
		};
	}

	const entry = randomItem(pool);
	return {
		label: formatPoolEntryLabel(options.tonalityRoot, options.tonalityMode, entry),
		tonalityRoot: options.tonalityRoot,
		tonalityMode: options.tonalityMode,
		entry
	};
}

export function addPoolEntry(
	pool: TonalityPoolEntry[],
	entry: TonalityPoolEntry
): TonalityPoolEntry[] {
	const k = poolEntryKey(entry);
	const next = pool.filter((e) => poolEntryKey(e) !== k);
	return [...next, entry];
}

export function removePoolEntry(pool: TonalityPoolEntry[], entry: TonalityPoolEntry): TonalityPoolEntry[] {
	const k = poolEntryKey(entry);
	return pool.filter((e) => poolEntryKey(e) !== k);
}

type LegacySettings = {
	selectedQualityIds?: string[];
	slashChordsEnabled?: boolean;
};

export function sanitizeChordPromptsSettings(raw: Partial<ChordPromptsSettings> & LegacySettings): ChordPromptsSettings {
	const d = DEFAULT_CHORD_PROMPTS_SETTINGS;

	const tonalityRoot = CIRCLE_OF_FIFTHS.includes(raw.tonalityRoot as CircleRoot)
		? (raw.tonalityRoot as CircleRoot)
		: d.tonalityRoot;

	const tonalityMode =
		raw.tonalityMode === 'major' ||
		raw.tonalityMode === 'naturalMinor' ||
		raw.tonalityMode === 'harmonicMinor'
			? raw.tonalityMode
			: d.tonalityMode;

	let poolEntries: TonalityPoolEntry[] = [];
	if (Array.isArray(raw.poolEntries)) {
		for (const e of raw.poolEntries) {
			if (!e || typeof e !== 'object') continue;
			const deg = clamp(Number((e as TonalityPoolEntry).degree), 1, 7, -1);
			const kind = (e as TonalityPoolEntry).kind;
			if (deg < 1 || (kind !== 'triad' && kind !== 'seventh')) continue;
			const sd = (e as TonalityPoolEntry).slashBassDegree;
			let slashBassDegree: number | undefined;
			if (sd !== undefined && sd !== null) {
				const b = clamp(Number(sd), 1, 7, -1);
				if (b >= 1) slashBassDegree = b;
			}
			poolEntries.push({ degree: deg, kind, slashBassDegree });
		}
	}

	return {
		tonalityRoot,
		tonalityMode,
		poolEntries,
		bpm: clamp(raw.bpm ?? d.bpm, 40, 240, d.bpm),
		clicksPerChord: clamp(raw.clicksPerChord ?? d.clicksPerChord, 1, 32, d.clicksPerChord),
		clickVolume: Math.min(
			1,
			Math.max(0, Number.isFinite(Number(raw.clickVolume)) ? Number(raw.clickVolume) : d.clickVolume)
		),
		metronomeEnabled:
			typeof raw.metronomeEnabled === 'boolean' ? raw.metronomeEnabled : d.metronomeEnabled
	};
}
