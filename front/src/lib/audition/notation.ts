export const BEATS_PER_BAR = 4;
export const BEAT_STEP = 0.5;

export const NOTATION_HELP =
	"Space-separated notes. 1-7 = scale degree, r = rest. Add ' per octave up or , per octave down. Add :beats for length (default 1; 0.5 eighth, 1.5 dotted quarter, 2 half, 4 whole). | marks a bar. Each bar is 4 beats.";

export type BarCount = 1 | 2 | 3 | 4;

export type MelodyNote = {
	degree: number | null;
	octave: number;
	beats: number;
};

export type MelodyCell = {
	degree: number | null;
	octave: number;
	tied: boolean;
};

export type AuditionMelody = {
	id: string;
	name: string;
	notation: string;
};

export type AuditionLibrary = {
	bars: BarCount;
	beatsPerBar: number;
	notationHelp: string;
	melodies: AuditionMelody[];
};

export type ParseCode = 'ok' | 'empty' | 'token' | 'duration' | 'length';

export type ParseResult = {
	ok: boolean;
	notes: MelodyNote[];
	beats: number;
	error: string | null;
	code: ParseCode;
};

const TOKEN = /^([1-7]|r)('+|,+)?(?::(\d+(?:\.\d+)?))?$/i;

export function isBarCount(value: number): value is BarCount {
	return value === 1 || value === 2 || value === 3 || value === 4;
}

export function expectedBeats(bars: number, beatsPerBar = BEATS_PER_BAR): number {
	return bars * beatsPerBar;
}

export function sumBeats(notes: MelodyNote[]): number {
	return notes.reduce((total, note) => total + note.beats, 0);
}

export function blankNotation(bars: number): string {
	return Array.from({ length: bars }, () => '1 1 1 1').join(' | ');
}

export function parseNotation(
	notation: string,
	bars: number,
	beatsPerBar = BEATS_PER_BAR
): ParseResult {
	const raw = notation.trim();
	if (!raw) {
		return { ok: false, notes: [], beats: 0, error: 'Notation is empty', code: 'empty' };
	}

	const tokens = raw.split(/\s+/).filter((token) => token !== '|');
	const notes: MelodyNote[] = [];

	for (const token of tokens) {
		const match = TOKEN.exec(token);
		if (!match) {
			return {
				ok: false,
				notes,
				beats: sumBeats(notes),
				error: `Can't read "${token}"`,
				code: 'token'
			};
		}

		const degree = match[1].toLowerCase() === 'r' ? null : Number(match[1]);
		const octaveMark = match[2] ?? '';
		let octave = 0;
		if (octaveMark.startsWith("'")) octave = octaveMark.length;
		else if (octaveMark.startsWith(',')) octave = -octaveMark.length;

		const beats = match[3] === undefined ? 1 : Number(match[3]);
		if (!Number.isFinite(beats) || beats <= 0 || beats > 16) {
			return {
				ok: false,
				notes,
				beats: sumBeats(notes),
				error: `Bad duration in "${token}"`,
				code: 'duration'
			};
		}

		const steps = Math.round(beats / BEAT_STEP);
		if (Math.abs(steps * BEAT_STEP - beats) > 1e-6) {
			return {
				ok: false,
				notes,
				beats: sumBeats(notes),
				error: `"${token}" must be a multiple of a half beat`,
				code: 'duration'
			};
		}

		notes.push({
			degree,
			octave: degree === null ? 0 : Math.max(-2, Math.min(2, octave)),
			beats: steps * BEAT_STEP
		});
	}

	const beats = sumBeats(notes);
	const needed = expectedBeats(bars, beatsPerBar);
	if (Math.abs(beats - needed) > 1e-6) {
		return {
			ok: false,
			notes,
			beats,
			error: `${formatBeats(beats)} beats so far, this file needs ${needed}`,
			code: 'length'
		};
	}

	return { ok: true, notes, beats, error: null, code: 'ok' };
}

export function formatBeats(beats: number): string {
	return Number(beats.toFixed(2)).toString();
}

function formatToken(note: MelodyNote): string {
	const head = note.degree === null ? 'r' : String(note.degree);
	const octave =
		note.degree === null
			? ''
			: note.octave > 0
				? "'".repeat(note.octave)
				: note.octave < 0
					? ','.repeat(-note.octave)
					: '';
	const duration = note.beats === 1 ? '' : `:${formatBeats(note.beats)}`;
	return `${head}${octave}${duration}`;
}

export function notesToCells(notes: MelodyNote[], totalBeats: number): MelodyCell[] {
	const count = Math.max(0, Math.round(totalBeats / BEAT_STEP));
	const cells: MelodyCell[] = Array.from({ length: count }, () => ({
		degree: null,
		octave: 0,
		tied: false
	}));

	let beat = 0;
	for (const note of notes) {
		const steps = Math.round(note.beats / BEAT_STEP);
		const start = Math.round(beat / BEAT_STEP);
		for (let i = 0; i < steps && start + i < count; i++) {
			cells[start + i] = {
				degree: note.degree,
				octave: note.degree === null ? 0 : note.octave,
				tied: i > 0
			};
		}
		beat += note.beats;
		if (start >= count) break;
	}

	return cells;
}

function cellsToNotes(cells: MelodyCell[]): MelodyNote[] {
	const eighthsPerBar = Math.round(BEATS_PER_BAR / BEAT_STEP);
	const notes: MelodyNote[] = [];
	let index = 0;

	while (index < cells.length) {
		let end = index + 1;
		while (
			end < cells.length &&
			cells[end].tied &&
			cells[end].degree === cells[index].degree &&
			cells[end].octave === cells[index].octave
		) {
			if (cells[index].degree === null && end % eighthsPerBar === 0) break;
			end++;
		}
		notes.push({
			degree: cells[index].degree,
			octave: cells[index].degree === null ? 0 : cells[index].octave,
			beats: (end - index) * BEAT_STEP
		});
		index = end;
	}

	return notes;
}

export function serializeNotation(notes: MelodyNote[], beatsPerBar = BEATS_PER_BAR): string {
	const parts: string[] = [];
	let beat = 0;
	for (const note of notes) {
		if (beat > 0 && Math.abs(beat % beatsPerBar) < 1e-6) parts.push('|');
		parts.push(formatToken(note));
		beat += note.beats;
	}
	return parts.join(' ');
}

export function placeNote(
	notes: MelodyNote[],
	startBeat: number,
	note: MelodyNote,
	totalBeats: number
): MelodyNote[] {
	const length = Math.max(totalBeats, sumBeats(notes));
	const cells = notesToCells(notes, length);
	const start = Math.round(startBeat / BEAT_STEP);
	if (start < 0 || start >= cells.length) return cellsToNotes(cells);

	let steps = Math.max(1, Math.round(note.beats / BEAT_STEP));
	steps = Math.min(steps, cells.length - start);
	const degree = note.degree;
	const octave = degree === null ? 0 : note.octave;

	for (let i = 0; i < steps; i++) {
		cells[start + i] = { degree, octave, tied: i > 0 };
	}

	const end = start + steps;
	if (end < cells.length && cells[end].tied) {
		cells[end] = { ...cells[end], tied: false };
	}

	return cellsToNotes(cells);
}

export function mapNoteAt(
	notes: MelodyNote[],
	beat: number,
	totalBeats: number,
	map: (note: MelodyNote) => MelodyNote
): MelodyNote[] {
	const length = Math.max(totalBeats, sumBeats(notes));
	const cells = notesToCells(notes, length);
	if (cells.length === 0) return [];

	const index = Math.min(cells.length - 1, Math.max(0, Math.round(beat / BEAT_STEP)));
	let start = index;
	while (start > 0 && cells[start].tied) start--;
	let end = start + 1;
	while (end < cells.length && cells[end].tied) end++;

	const current: MelodyNote = {
		degree: cells[start].degree,
		octave: cells[start].octave,
		beats: (end - start) * BEAT_STEP
	};
	const next = map(current);
	if (Math.abs(next.beats - current.beats) > 1e-6) {
		return placeNote(cellsToNotes(cells), start * BEAT_STEP, next, length);
	}

	const degree = next.degree;
	const octave = degree === null ? 0 : next.octave;
	for (let i = start; i < end; i++) {
		cells[i] = { degree, octave, tied: i !== start };
	}
	return cellsToNotes(cells);
}

export function fitNotes(notes: MelodyNote[], totalBeats: number): MelodyNote[] {
	return cellsToNotes(notesToCells(notes, totalBeats));
}

export function normalizeLibrary(raw: unknown): AuditionLibrary {
	const obj = (raw && typeof raw === 'object' ? raw : {}) as Partial<AuditionLibrary>;
	const bars = Number(obj.bars);
	if (!isBarCount(bars)) {
		throw new Error('Audition library bars must be 1, 2, 3, or 4');
	}

	const melodies = Array.isArray(obj.melodies) ? obj.melodies : [];
	return {
		bars,
		beatsPerBar: BEATS_PER_BAR,
		notationHelp: NOTATION_HELP,
		melodies: melodies.map((melody, index) => ({
			id:
				typeof melody?.id === 'string' && melody.id.trim()
					? melody.id.trim()
					: `melody-${index + 1}`,
			name:
				typeof melody?.name === 'string' && melody.name.trim()
					? melody.name.trim()
					: `Melody ${index + 1}`,
			notation: typeof melody?.notation === 'string' ? melody.notation.trim() : ''
		}))
	};
}

export function canonicalLibrary(library: AuditionLibrary): AuditionLibrary {
	return {
		bars: library.bars,
		beatsPerBar: BEATS_PER_BAR,
		notationHelp: NOTATION_HELP,
		melodies: library.melodies.map((melody) => ({
			id: melody.id.trim(),
			name: melody.name.trim() || 'Untitled',
			notation: melody.notation.trim()
		}))
	};
}

export function libraryIssues(library: AuditionLibrary): string[] {
	const issues: string[] = [];
	if (!isBarCount(library.bars)) issues.push('Bars must be 1, 2, 3, or 4');
	const ids = new Set<string>();

	for (const melody of library.melodies) {
		const label = melody.name.trim() || melody.id || 'Untitled';
		if (!melody.id.trim()) issues.push(`${label} is missing an id`);
		if (ids.has(melody.id)) issues.push(`Duplicate id "${melody.id}"`);
		ids.add(melody.id);
		const parsed = parseNotation(melody.notation, library.bars, BEATS_PER_BAR);
		if (!parsed.ok) issues.push(`${label}: ${parsed.error}`);
	}

	return issues;
}
