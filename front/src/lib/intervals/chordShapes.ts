/**
 * Consecutive semitone steps between adjacent chord tones (ascending, close position).
 * Used for random harmonic questions: bass + steps defines the voicing.
 */

export type ChordShape = {
	id: string;
	/** Human-readable: quality + inversion */
	label: string;
	steps: number[];
};

/** Triads: 2 steps (3 notes). */
export const TRIAD_SHAPES: ChordShape[] = [
	{ id: 'maj-r', label: 'Major triad · root', steps: [4, 3] },
	{ id: 'maj-1', label: 'Major triad · 1st inv', steps: [3, 5] },
	{ id: 'maj-2', label: 'Major triad · 2nd inv', steps: [5, 4] },
	{ id: 'min-r', label: 'Minor triad · root', steps: [3, 4] },
	{ id: 'min-1', label: 'Minor triad · 1st inv', steps: [4, 5] },
	{ id: 'min-2', label: 'Minor triad · 2nd inv', steps: [5, 3] },
	{ id: 'dim-r', label: 'Diminished triad · root', steps: [3, 3] },
	{ id: 'dim-1', label: 'Diminished triad · 1st inv', steps: [3, 6] },
	{ id: 'dim-2', label: 'Diminished triad · 2nd inv', steps: [6, 3] },
	{ id: 'aug-r', label: 'Augmented triad · root', steps: [4, 4] },
	{ id: 'aug-1', label: 'Augmented triad · 1st inv', steps: [4, 3] },
	{ id: 'aug-2', label: 'Augmented triad · 2nd inv', steps: [3, 4] }
];

/** Seventh chords: 3 steps (4 notes), close position. */
export const SEVENTH_SHAPES: ChordShape[] = [
	// Dominant 7
	{ id: '7-r', label: 'Dominant 7 · root', steps: [4, 3, 3] },
	{ id: '7-1', label: 'Dominant 7 · 1st inv', steps: [3, 3, 2] },
	{ id: '7-2', label: 'Dominant 7 · 2nd inv', steps: [3, 2, 4] },
	{ id: '7-3', label: 'Dominant 7 · 3rd inv', steps: [2, 4, 3] },
	// Major 7
	{ id: 'maj7-r', label: 'Major 7 · root', steps: [4, 3, 4] },
	{ id: 'maj7-1', label: 'Major 7 · 1st inv', steps: [3, 4, 1] },
	{ id: 'maj7-2', label: 'Major 7 · 2nd inv', steps: [4, 1, 4] },
	{ id: 'maj7-3', label: 'Major 7 · 3rd inv', steps: [1, 4, 3] },
	// Minor 7
	{ id: 'm7-r', label: 'Minor 7 · root', steps: [3, 4, 3] },
	{ id: 'm7-1', label: 'Minor 7 · 1st inv', steps: [4, 3, 1] },
	{ id: 'm7-2', label: 'Minor 7 · 2nd inv', steps: [3, 1, 3] },
	{ id: 'm7-3', label: 'Minor 7 · 3rd inv', steps: [1, 3, 4] },
	// Half-diminished (m7♭5)
	{ id: 'm7b5-r', label: 'Half-dim (m7♭5) · root', steps: [3, 3, 4] },
	{ id: 'm7b5-1', label: 'Half-dim (m7♭5) · 1st inv', steps: [3, 4, 2] },
	{ id: 'm7b5-2', label: 'Half-dim (m7♭5) · 2nd inv', steps: [3, 2, 3] },
	{ id: 'm7b5-3', label: 'Half-dim (m7♭5) · 3rd inv', steps: [2, 3, 3] },
	// Diminished 7 (symmetric)
	{ id: 'dim7-r', label: 'Diminished 7 · (any inv)', steps: [3, 3, 3] },
	// Minor major 7 (root only — less ambiguous)
	{ id: 'mM7-r', label: 'Minor–major 7 · root', steps: [3, 4, 4] }
];

export const TRIAD_IDS = TRIAD_SHAPES.map((s) => s.id);
export const SEVENTH_IDS = SEVENTH_SHAPES.map((s) => s.id);
