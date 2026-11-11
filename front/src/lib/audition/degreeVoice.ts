import * as Tone from 'tone';

const DEGREE_PITCH: Record<number, string> = {
	1: 'C4',
	2: 'D4',
	3: 'E4',
	4: 'F4',
	5: 'G4',
	6: 'A4',
	7: 'B4'
};

export function pitchForScaleDegree(degree: number): string | null {
	if (!Number.isInteger(degree) || degree < 1 || degree > 7) return null;
	return DEGREE_PITCH[degree] ?? null;
}

export function createDegreeVoiceSampler(onload?: () => void): Tone.Sampler {
	const sampler = new Tone.Sampler({
		urls: {
			C4: '/sounds/count/1.mp3',
			D4: '/sounds/count/2.mp3',
			E4: '/sounds/count/3.mp3',
			F4: '/sounds/count/4.mp3',
			G4: '/sounds/count/5.mp3',
			A4: '/sounds/count/6.mp3',
			B4: '/sounds/count/7.mp3'
		},
		onload
	}).toDestination();
	sampler.volume.value = -2;
	return sampler;
}

export function triggerDegreeVoice(
	sampler: Tone.Sampler | undefined,
	degree: number,
	when: number,
	duration = '8n'
) {
	const pitch = pitchForScaleDegree(degree);
	if (!sampler || !pitch) return;
	sampler.triggerAttackRelease(pitch, duration, when);
}
