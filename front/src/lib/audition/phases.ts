import type { AuditionPhase } from '$lib/stores/auditionSettings';

export function parsePhaseSequenceText(text: string): AuditionPhase[] | null {
	const tokens = text
		.trim()
		.toLowerCase()
		.split(/[\s,\-|]+/)
		.filter(Boolean);
	if (tokens.length === 0) return null;
	const out: AuditionPhase[] = [];
	for (const token of tokens) {
		if (token === 'l' || token === 'listen') out.push('listen');
		else if (token === 'a' || token === 'audiate' || token === 'audition') out.push('audiate');
		else return null;
	}
	return out.length > 0 ? out : null;
}

export function formatPhaseSequence(phases: AuditionPhase[]): string {
	return phases.map((phase) => (phase === 'listen' ? 'Listen' : 'Audiate')).join(' → ');
}

export function formatPhaseSequenceCompact(phases: AuditionPhase[]): string {
	return phases.map((phase) => (phase === 'listen' ? 'L' : 'A')).join(' ');
}
