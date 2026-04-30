/**
 * Chord prompts: diatonic chords, each pool item stores its own tonality; multiple named profiles.
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

function newProfileId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `p-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function toSharpName(note: string): string {
	return FLAT_TO_SHARP[note] ?? note;
}

export function noteToPc(note: string): number | null {
	const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
	const i = names.indexOf(toSharpName(note));
	return i === -1 ? null : i;
}

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

/** One chord in the practice pool — tonality is fixed when added (changing the builder does not rewrite this). */
export type PooledChordEntry = {
	tonalityRoot: CircleRoot;
	tonalityMode: TonalityMode;
	degree: number;
	kind: ChordKind;
	slashBassDegree?: number;
};

export type ChordPromptProfile = {
	id: string;
	name: string;
	builderTonalityRoot: CircleRoot;
	builderTonalityMode: TonalityMode;
	poolEntries: PooledChordEntry[];
	bpm: number;
	clicksPerChord: number;
	clickVolume: number;
	metronomeEnabled: boolean;
};

export type ChordPromptsSettings = {
	profiles: ChordPromptProfile[];
	activeProfileId: string;
};

export function createChordPromptProfile(
	name: string,
	overrides?: Partial<Omit<ChordPromptProfile, 'id'>> & { id?: string }
): ChordPromptProfile {
	return {
		id: overrides?.id ?? newProfileId(),
		name,
		builderTonalityRoot: 'C',
		builderTonalityMode: 'major',
		poolEntries: [],
		bpm: 80,
		clicksPerChord: 4,
		clickVolume: 1,
		metronomeEnabled: true,
		...overrides
	};
}

export const DEFAULT_CHORD_PROMPTS_SETTINGS: ChordPromptsSettings = (() => {
	const p = createChordPromptProfile('Default');
	return { profiles: [p], activeProfileId: p.id };
})();

export type ChordPromptPick = {
	label: string;
	entry: PooledChordEntry;
};

function clamp(n: number, lo: number, hi: number, fallback: number): number {
	const x = Math.round(Number(n));
	if (!Number.isFinite(x)) return fallback;
	return Math.min(hi, Math.max(lo, x));
}

export function poolEntryKey(e: PooledChordEntry): string {
	return `${e.tonalityRoot}|${e.tonalityMode}|${e.degree}|${e.kind}|${e.slashBassDegree ?? ''}`;
}

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

export function formatPoolEntryLabel(entry: PooledChordEntry): string {
	const scale = buildDiatonicScale(entry.tonalityRoot, entry.tonalityMode);
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

export function diatonicDegreePreview(
	tonic: CircleRoot,
	mode: TonalityMode,
	degree: number
): { roman: string; triad: string; seventh: string } {
	const triad: PooledChordEntry = { tonalityRoot: tonic, tonalityMode: mode, degree, kind: 'triad' };
	const seventh: PooledChordEntry = {
		tonalityRoot: tonic,
		tonalityMode: mode,
		degree,
		kind: 'seventh'
	};
	const romans = romanNumeralForDegree(mode, degree);
	return {
		roman: romans,
		triad: formatPoolEntryLabel(triad),
		seventh: formatPoolEntryLabel(seventh)
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
	pool: PooledChordEntry[];
	lastLabel?: string | null;
}): ChordPromptPick | null {
	const pool = options.pool.filter(
		(e) =>
			CIRCLE_OF_FIFTHS.includes(e.tonalityRoot as CircleRoot) &&
			TONALITY_MODES.includes(e.tonalityMode) &&
			e.degree >= 1 &&
			e.degree <= 7 &&
			(e.slashBassDegree === undefined || (e.slashBassDegree >= 1 && e.slashBassDegree <= 7))
	);
	if (pool.length === 0) return null;

	for (let attempt = 0; attempt < 50; attempt++) {
		const entry = randomItem(pool);
		const label = formatPoolEntryLabel(entry);
		if (options.lastLabel && label === options.lastLabel && pool.length > 1) continue;
		return { label, entry };
	}

	const entry = randomItem(pool);
	return { label: formatPoolEntryLabel(entry), entry };
}

export function addPoolEntry(pool: PooledChordEntry[], entry: PooledChordEntry): PooledChordEntry[] {
	const k = poolEntryKey(entry);
	const next = pool.filter((e) => poolEntryKey(e) !== k);
	return [...next, entry];
}

export function removePoolEntry(pool: PooledChordEntry[], entry: PooledChordEntry): PooledChordEntry[] {
	const k = poolEntryKey(entry);
	return pool.filter((e) => poolEntryKey(e) !== k);
}

function sanitizeProfile(raw: unknown, fallbackName: string): ChordPromptProfile | null {
	if (!raw || typeof raw !== 'object') return null;
	const o = raw as Record<string, unknown>;
	const id = typeof o.id === 'string' && o.id.length > 0 ? o.id : newProfileId();
	const name = typeof o.name === 'string' && o.name.trim() ? o.name.trim() : fallbackName;

	const builderTonalityRoot = CIRCLE_OF_FIFTHS.includes(o.builderTonalityRoot as CircleRoot)
		? (o.builderTonalityRoot as CircleRoot)
		: CIRCLE_OF_FIFTHS.includes(o.tonalityRoot as CircleRoot)
			? (o.tonalityRoot as CircleRoot)
			: 'C';

	const rawMode = o.builderTonalityMode ?? o.tonalityMode;
	const builderTonalityMode =
		rawMode === 'major' || rawMode === 'naturalMinor' || rawMode === 'harmonicMinor'
			? rawMode
			: 'major';

	let poolEntries: PooledChordEntry[] = [];
	if (Array.isArray(o.poolEntries)) {
		for (const e of o.poolEntries) {
			if (!e || typeof e !== 'object') continue;
			const row = e as Record<string, unknown>;
			const deg = clamp(Number(row.degree), 1, 7, -1);
			const kind = row.kind;
			if (deg < 1 || (kind !== 'triad' && kind !== 'seventh')) continue;

			const tr = CIRCLE_OF_FIFTHS.includes(row.tonalityRoot as CircleRoot)
				? (row.tonalityRoot as CircleRoot)
				: builderTonalityRoot;
			const tm =
				row.tonalityMode === 'major' ||
				row.tonalityMode === 'naturalMinor' ||
				row.tonalityMode === 'harmonicMinor'
					? row.tonalityMode
					: builderTonalityMode;

			let slashBassDegree: number | undefined;
			const sd = row.slashBassDegree;
			if (sd !== undefined && sd !== null) {
				const b = clamp(Number(sd), 1, 7, -1);
				if (b >= 1) slashBassDegree = b;
			}
			poolEntries.push({ tonalityRoot: tr, tonalityMode: tm, degree: deg, kind, slashBassDegree });
		}
	}

	const ref = DEFAULT_CHORD_PROMPTS_SETTINGS.profiles[0]!;
	return {
		id,
		name,
		builderTonalityRoot,
		builderTonalityMode,
		poolEntries,
		bpm: clamp(Number(o.bpm ?? ref.bpm), 40, 240, ref.bpm),
		clicksPerChord: clamp(Number(o.clicksPerChord ?? ref.clicksPerChord), 1, 32, ref.clicksPerChord),
		clickVolume: Math.min(
			1,
			Math.max(
				0,
				Number.isFinite(Number(o.clickVolume)) ? Number(o.clickVolume) : ref.clickVolume
			)
		),
		metronomeEnabled:
			typeof o.metronomeEnabled === 'boolean' ? o.metronomeEnabled : ref.metronomeEnabled
	};
}

/** Flat storage before profiles (single pool + global tonality). */
type LegacyFlat = {
	tonalityRoot?: CircleRoot;
	tonalityMode?: TonalityMode;
	poolEntries?: Array<{ degree: number; kind: ChordKind; slashBassDegree?: number }>;
	bpm?: number;
	clicksPerChord?: number;
	clickVolume?: number;
	metronomeEnabled?: boolean;
	selectedQualityIds?: string[];
};

export function sanitizeChordPromptsSettings(
	raw: Partial<ChordPromptsSettings> & LegacyFlat
): ChordPromptsSettings {
	const d = DEFAULT_CHORD_PROMPTS_SETTINGS;

	if (raw.profiles && Array.isArray(raw.profiles) && raw.profiles.length > 0) {
		const profiles = raw.profiles
			.map((p, i) => sanitizeProfile(p, `Profile ${i + 1}`))
			.filter((p): p is ChordPromptProfile => p !== null);
		if (profiles.length === 0) return d;
		let activeProfileId =
			typeof raw.activeProfileId === 'string' ? raw.activeProfileId : profiles[0]!.id;
		if (!profiles.some((p) => p.id === activeProfileId)) activeProfileId = profiles[0]!.id;
		return { profiles, activeProfileId };
	}

	if (raw.poolEntries && Array.isArray(raw.poolEntries) && raw.poolEntries.length >= 0) {
		const tr = CIRCLE_OF_FIFTHS.includes(raw.tonalityRoot as CircleRoot)
			? (raw.tonalityRoot as CircleRoot)
			: 'C';
		const tm =
			raw.tonalityMode === 'major' ||
			raw.tonalityMode === 'naturalMinor' ||
			raw.tonalityMode === 'harmonicMinor'
				? raw.tonalityMode
				: 'major';
		const migratedPool: PooledChordEntry[] = [];
		for (const e of raw.poolEntries) {
			if (!e || typeof e !== 'object') continue;
			const deg = clamp(Number((e as { degree: number }).degree), 1, 7, -1);
			const kind = (e as { kind: ChordKind }).kind;
			if (deg < 1 || (kind !== 'triad' && kind !== 'seventh')) continue;
			const sd = (e as { slashBassDegree?: number }).slashBassDegree;
			let slashBassDegree: number | undefined;
			if (sd !== undefined && sd !== null) {
				const b = clamp(Number(sd), 1, 7, -1);
				if (b >= 1) slashBassDegree = b;
			}
			migratedPool.push({ tonalityRoot: tr, tonalityMode: tm, degree: deg, kind, slashBassDegree });
		}
		const p = createChordPromptProfile('Default', {
			builderTonalityRoot: tr,
			builderTonalityMode: tm,
			poolEntries: migratedPool,
			bpm: clamp(raw.bpm ?? 80, 40, 240, 80),
			clicksPerChord: clamp(raw.clicksPerChord ?? 4, 1, 32, 4),
			clickVolume: Math.min(
				1,
				Math.max(0, Number.isFinite(Number(raw.clickVolume)) ? Number(raw.clickVolume) : 1)
			),
			metronomeEnabled:
				typeof raw.metronomeEnabled === 'boolean' ? raw.metronomeEnabled : true
		});
		return { profiles: [p], activeProfileId: p.id };
	}

	return { ...d, activeProfileId: d.profiles[0]!.id };
}

export function getActiveProfile(settings: ChordPromptsSettings): ChordPromptProfile {
	const p = settings.profiles.find((x) => x.id === settings.activeProfileId);
	return p ?? settings.profiles[0]!;
}

export function profileIndex(settings: ChordPromptsSettings): number {
	const i = settings.profiles.findIndex((x) => x.id === settings.activeProfileId);
	return i >= 0 ? i : 0;
}
