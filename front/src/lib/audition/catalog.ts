import rawFour from './melodies/4-bar.json';
import rawOne from './melodies/1-bar.json';
import rawThree from './melodies/3-bar.json';
import rawTwo from './melodies/2-bar.json';
import { normalizeLibrary, type AuditionLibrary, type BarCount } from './notation';

export const bundledLibraries: Record<BarCount, AuditionLibrary> = {
	1: normalizeLibrary(rawOne),
	2: normalizeLibrary(rawTwo),
	3: normalizeLibrary(rawThree),
	4: normalizeLibrary(rawFour)
};
