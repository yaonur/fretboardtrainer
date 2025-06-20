import { browser } from '$app/environment';

export type PitchPhase = 'question' | 'playingAnswer' | 'playingHarmonic' | 'idle';

type Options = {
	currentNote: string | null;
	targetNote: string | null;
	inputLevel: number;
	currentPitch: number;
	currentPhase?: PitchPhase;
};

let defaultOptions: Options = {
	currentNote: null,
	targetNote: null,
	inputLevel: 0,
	currentPitch: 0,
	currentPhase: 'idle'
};

class PitcherStore {
	#currentNote: string  = $state("");
	#targetNote: string  = $state("");
	#inputLevel: number = $state(0);
	#currentPitch: number = $state(0);
	#progressWidth: number = $state(0);
	#deg: number = $state(0);
	#currentPhase: PitchPhase = $state('idle');
	// constructor(options: Options) {
	// 	this.#currentNote = options.currentNote;
	// 	this.#targetNote = options.targetNote;
	// }
	currentNoteSubscribers: (() => void)[] = [];
	onChangeCurrentNote(callback: () => void) {
		this.currentNoteSubscribers.push(callback);
	}
	get currentNote(){
		return this.#currentNote;
	}
	set currentNote(value:string){
		this.#currentNote = value;
		this.currentNoteSubscribers.forEach(callback => callback());
	}
	get targetNote(){
		return this.#targetNote;
	}
	set targetNote(value:string){
		this.#targetNote = value;
	}
	get inputLevel(){
		return this.#inputLevel;
	}
	set inputLevel(value:number){
		this.#inputLevel = value;
	}
	get currentPitch(){
		return this.#currentPitch;
	}
	set currentPitch(value:number){
		this.#currentPitch = value;
	}
	get currentPhase() {
		return this.#currentPhase;
	}
	set currentPhase(value: PitchPhase) {
		this.#currentPhase = value;
	}
	get progressWidth(){
		return this.#progressWidth;
	}
	set progressWidth(value:number){
		this.#progressWidth = value;
	}
	get deg(){
		return this.#deg;
	}
	set deg(value:number){
		this.#deg = value;
	}
	reset(){
		this.#currentNote = '';
		this.#progressWidth = 0;
		this.#deg = 0;
	}
}
export const pitcherStore = new PitcherStore();
