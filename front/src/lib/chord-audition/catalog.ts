import rawLibrary from './progressions.json';
import { libraryIssues, normalizeChordLibrary, type ChordLibrary } from './notation';

export const chordLibrary: ChordLibrary = normalizeChordLibrary(rawLibrary);

const issues = libraryIssues(chordLibrary);
if (issues.length > 0) {
	throw new Error(`Chord progression library: ${issues.join(' ')}`);
}
