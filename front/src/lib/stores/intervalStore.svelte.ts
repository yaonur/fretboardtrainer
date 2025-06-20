import { browser } from '$app/environment';
import type { baseNotes, Modes } from '$lib/types';
import { Intervals } from '$lib/utils/noteIntervalCalculator';

type IntervalSettings = {
	minNoteIndex: number;
	maxNoteIndex: number;
	mainNotePlayTime: number;
	intervalNotePlayTime: number; // time playing interval note
	bothNotePlayTime: number; // time playing both notes
	sleepTime: number; // time between notes
	selectedInterval: number;
	intervalDirection: 'ascending' | 'descending';
	playAnswerAfterCorrect: boolean;
	playHarmonicAfterCorrect: boolean;
	correctFeedbackTimeout: number;
	nextQuestionDelay: number; // time between questions
	selectedIntervals: number[];
	playTargetNote: 'never' | 'interval' | 'onCorrect';
	playTargetNoteInterval: number;
	intervalTone: baseNotes;
	intervalMode: Modes;
	intervalModeNotes: string[];
	correctAnswerSleepTime?: number;
};

const defaultSettings: IntervalSettings = {
	minNoteIndex: 20,
	maxNoteIndex: 24,
	mainNotePlayTime: 4000,
	intervalNotePlayTime: 500,
	bothNotePlayTime: 2000,
	sleepTime: 500,
	selectedInterval: 3, // default to minor third
	intervalDirection: 'ascending',
	playAnswerAfterCorrect: false,
	playHarmonicAfterCorrect: false,
	correctFeedbackTimeout: 1000, // Default 1 second
	nextQuestionDelay: 1500, // Default 1.5 seconds
	selectedIntervals: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
	playTargetNote: 'never',
	playTargetNoteInterval: 1000,
	intervalTone: 'A',
	intervalMode: 'ionian',
	intervalModeNotes: ['Bb', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A'],
	correctAnswerSleepTime: 1000,
};

class IntervalSettingsStore {
	#minNoteIndex: number = $state(defaultSettings.minNoteIndex);
	#maxNoteIndex: number = $state(defaultSettings.maxNoteIndex);
	#mainNotePlayTime: number = $state(defaultSettings.mainNotePlayTime); // time playing main note
	#intervalNotePlayTime: number = $state(defaultSettings.intervalNotePlayTime); // time playing interval note on intervalsing
	#bothNotePlayTime: number = $state(defaultSettings.bothNotePlayTime); // time playing both notes on intervalsing
	#sleepTime: number = $state(defaultSettings.sleepTime); // time between notes
	#selectedInterval: number = $state(defaultSettings.selectedInterval);
	#intervalDirection: 'ascending' | 'descending' = $state(defaultSettings.intervalDirection);
	#notes: string[] = $state([]);
	#successSound: HTMLAudioElement | null = $state(null);
	#playAnswerAfterCorrect: boolean = $state(defaultSettings.playAnswerAfterCorrect); // play answer after correct
	#playHarmonicAfterCorrect: boolean = $state(defaultSettings.playHarmonicAfterCorrect); // play harmonic after correct
	#correctFeedbackTimeout: number = $state(defaultSettings.correctFeedbackTimeout); // time showing correct feedback
	#nextQuestionDelay: number = $state(defaultSettings.nextQuestionDelay); // time between questions
	#intervals: number[] = $state([]);
	#minIntervalIndex: number = $state(0);
	#maxIntervalIndex: number = $state(12);
	#selectedIntervals: number[] = $state([]);
	#intervalTone: baseNotes = $state(defaultSettings.intervalTone);
	#intervalMode: Modes = $state(defaultSettings.intervalMode);
	#intervalModeNotes: string[] = $state(defaultSettings.intervalModeNotes);
	#playTargetNote: 'never' | 'interval' | 'onCorrect' = $state('never');
	#playTargetNoteInterval: number = $state(1000); // time playing target note on modal singing
	currentPage: 'intervalsing' | 'modalsing' = $state('intervalsing');
	correctAnswerSleepTime: number = $derived.by(()=> {
		const intersectionTime = this.#nextQuestionDelay
		if(this.currentPage === 'intervalsing'){
			return  intersectionTime + (this.#playAnswerAfterCorrect? this.#intervalNotePlayTime+this.#sleepTime : 0)
			 + (this.#playHarmonicAfterCorrect? this.#bothNotePlayTime+this.#sleepTime : 0)
		}
		return intersectionTime + (this.#playTargetNote === 'onCorrect' ? this.#intervalNotePlayTime : 0)
	});
	constructor() {
		this.load();
		this.generateNotes(); // Generate initial notes
	}

	generateNotes() {
		const notes: string[] = [];
		const allNotes = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
		
		for (let i = this.#minNoteIndex; i <= this.#maxNoteIndex; i++) {
			notes.push(`${allNotes[i % 12]}${Math.floor(i / 12 + 1)}`);
		}
		this.#notes = notes;
	}
	generateIntervals() {
		const intervals: number[] = [];
		for (let i = this.#minIntervalIndex; i <= this.#maxIntervalIndex; i++) {
			intervals.push(i);
		}
		this.#intervals = intervals;
	}

	get notes() { return this.#notes; }
	get intervals() { return this.#intervals; }
	save() {
		if (browser) {
			const settings: IntervalSettings = {
				minNoteIndex: this.#minNoteIndex,
				maxNoteIndex: this.#maxNoteIndex,
				mainNotePlayTime: this.#mainNotePlayTime,
				intervalNotePlayTime: this.#intervalNotePlayTime,
				bothNotePlayTime: this.#bothNotePlayTime,
				sleepTime: this.#sleepTime,
				selectedInterval: this.#selectedInterval,
				intervalDirection: this.#intervalDirection,
				playAnswerAfterCorrect: this.#playAnswerAfterCorrect,
				playHarmonicAfterCorrect: this.#playHarmonicAfterCorrect,
				correctFeedbackTimeout: this.#correctFeedbackTimeout,
				nextQuestionDelay: this.#nextQuestionDelay,
				selectedIntervals: this.#selectedIntervals,
				playTargetNote: this.#playTargetNote,
				playTargetNoteInterval: this.#playTargetNoteInterval,
				intervalTone: this.#intervalTone,
				intervalMode: this.#intervalMode,
				intervalModeNotes: this.#intervalModeNotes,
			};
			localStorage.setItem("intervalSettings", JSON.stringify(settings));
		}
	}

	load() {
		if (browser) {
			const savedSettings = JSON.parse(localStorage.getItem("intervalSettings") || "{}");
			this.#minNoteIndex = savedSettings.minNoteIndex ?? defaultSettings.minNoteIndex;
			this.#maxNoteIndex = savedSettings.maxNoteIndex ?? defaultSettings.maxNoteIndex;
			this.#mainNotePlayTime = savedSettings.mainNotePlayTime ?? defaultSettings.mainNotePlayTime;
			this.#intervalNotePlayTime = savedSettings.intervalNotePlayTime ?? defaultSettings.intervalNotePlayTime;
			this.#bothNotePlayTime = savedSettings.bothNotePlayTime ?? defaultSettings.bothNotePlayTime;
			this.#sleepTime = savedSettings.sleepTime ?? defaultSettings.sleepTime;
			this.#selectedInterval = savedSettings.selectedInterval ?? defaultSettings.selectedInterval;
			this.#intervalDirection = savedSettings.intervalDirection ?? defaultSettings.intervalDirection;
			this.#playAnswerAfterCorrect = savedSettings.playAnswerAfterCorrect ?? defaultSettings.playAnswerAfterCorrect;
			this.#playHarmonicAfterCorrect = savedSettings.playHarmonicAfterCorrect ?? defaultSettings.playHarmonicAfterCorrect;
			this.#correctFeedbackTimeout = savedSettings.correctFeedbackTimeout ?? defaultSettings.correctFeedbackTimeout;
			this.#nextQuestionDelay = savedSettings.nextQuestionDelay ?? defaultSettings.nextQuestionDelay;
			this.#selectedIntervals = savedSettings.selectedIntervals ?? defaultSettings.selectedIntervals;
			this.#playTargetNote = savedSettings.playTargetNote ?? defaultSettings.playTargetNote;
			this.#playTargetNoteInterval = savedSettings.playTargetNoteInterval ?? defaultSettings.playTargetNoteInterval;
			this.#intervalTone = savedSettings.intervalTone ?? defaultSettings.intervalTone;
			this.#intervalMode = savedSettings.intervalMode ?? defaultSettings.intervalMode;
			this.#intervalModeNotes = savedSettings.intervalModeNotes ?? defaultSettings.intervalModeNotes;
		}
	}

	// Getters and setters
	get minNoteIndex() { return this.#minNoteIndex; }
	set minNoteIndex(value: number) {
		this.#minNoteIndex = value;
		this.generateNotes();
		this.save();
	}

	get maxNoteIndex() { return this.#maxNoteIndex; }
	set maxNoteIndex(value: number) {
		this.#maxNoteIndex = value;
		this.generateNotes();
		this.save();
	}
	get minIntervalIndex() { return this.#minIntervalIndex; }
	set minIntervalIndex(value: number) {
		this.#minIntervalIndex = value;
		this.generateIntervals();
		this.save();
	}

	get maxIntervalIndex() { return this.#maxIntervalIndex; }
	set maxIntervalIndex(value: number) {
		this.#maxIntervalIndex = value;
		this.generateIntervals();
		this.save();
	}

	

	get mainNotePlayTime() { return this.#mainNotePlayTime; }
	set mainNotePlayTime(value: number) {
		this.#mainNotePlayTime = value;
		this.save();
	}

	get intervalNotePlayTime() { return this.#intervalNotePlayTime; }
	set intervalNotePlayTime(value: number) {
		this.#intervalNotePlayTime = value;
		this.save();
	}

	get bothNotePlayTime() { return this.#bothNotePlayTime; }
	set bothNotePlayTime(value: number) {
		this.#bothNotePlayTime = value;
		this.save();
	}

	get sleepTime() { return this.#sleepTime; }
	set sleepTime(value: number) {
		this.#sleepTime = value;
		this.save();
	}

	get selectedInterval() { return this.#selectedInterval; }
	set selectedInterval(value: number) {
		this.#selectedInterval = value;
		this.save();
	}

	get intervalDirection() { return this.#intervalDirection; }
	set intervalDirection(value: 'ascending' | 'descending') {
		this.#intervalDirection = value;
		this.save();
	}

	get playAnswerAfterCorrect() { return this.#playAnswerAfterCorrect; }
	set playAnswerAfterCorrect(value: boolean) {
		this.#playAnswerAfterCorrect = value;
		this.save();
	}

	get playHarmonicAfterCorrect() { return this.#playHarmonicAfterCorrect; }
	set playHarmonicAfterCorrect(value: boolean) {
		this.#playHarmonicAfterCorrect = value;
		this.save();
	}

	get correctFeedbackTimeout() { return this.#correctFeedbackTimeout; }
	set correctFeedbackTimeout(value: number) {
		this.#correctFeedbackTimeout = value;
		this.save();
	}

	get nextQuestionDelay() { return this.#nextQuestionDelay; }
	set nextQuestionDelay(value: number) {
		this.#nextQuestionDelay = value;
		this.save();
	}

	get selectedIntervals() { return this.#selectedIntervals; }
	set selectedIntervals(value: number[]) {
		this.#selectedIntervals = value;
		this.save();
	}

	get intervalTone() { return this.#intervalTone; }
	set intervalTone(value: baseNotes) {
		this.#intervalTone = value;
		this.save();
	}

	get intervalMode() { return this.#intervalMode; }
	set intervalMode(value: Modes) {
		this.#intervalMode = value;
		this.save();
	}

	get intervalModeNotes() { return this.#intervalModeNotes; }
	set intervalModeNotes(value: string[]) {
		this.#intervalModeNotes = value;
		this.save();
	}

	get playTargetNote() { return this.#playTargetNote; }
	set playTargetNote(value: 'never' | 'interval' | 'onCorrect') {
		this.#playTargetNote = value;
		this.save();
	}

	get playTargetNoteInterval() { return this.#playTargetNoteInterval; }
	set playTargetNoteInterval(value: number) {
		this.#playTargetNoteInterval = value;
		this.save();
	}

	initSuccessSound() {
		if (!this.#successSound && browser) {
			this.#successSound = new Audio('/sounds/success.mp3');
			this.#successSound.volume = 0.5; // Adjust volume as needed
		}
	}

	onCorrectCallBack: () => void = () => {};
	triggerNextQuestion() {
		this.onCorrectCallBack();
	}

	playSuccess() {
		if (this.#successSound) {
			this.#successSound.currentTime = 0; // Reset to start
			this.#successSound.play();
		}
	}
}

export const intervalStore = new IntervalSettingsStore();
