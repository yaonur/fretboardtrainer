import { browser } from '$app/environment';
type Options = {
	micGain: number;
	volumeGain: number;
	calibrationFactor: number;
	audioInputDevice: string;
};
let defaultOptions: Options = {
	micGain: 4,
	volumeGain: 1,
	calibrationFactor: 1,
	audioInputDevice: ''
};
class UserSettingsStore {
	#micGain: number  = $state(4);
	#volumeGain: number  = $state(1);
	#calibrationFactor: number  = $state(1);
	#audioInputDevice: string = $state('');
	constructor() {
		this.load();
	}
	save(){
		if(browser){
			// console.log("Saving user settings", this.#micGain, this.#volumeGain, this.#calibrationFactor);
			localStorage.setItem("userSettings", JSON.stringify({micGain: this.#micGain, volumeGain: this.#volumeGain, calibrationFactor: this.#calibrationFactor, audioInputDevice: this.#audioInputDevice}));
		}
	}
	load(){
		if(browser){
			const settings = JSON.parse(localStorage.getItem("userSettings") || "{}");
			this.#micGain = settings.micGain ?? 4;
			this.#volumeGain = settings.volumeGain ?? 1;
			this.#calibrationFactor = settings.calibrationFactor ?? 1;
			this.#audioInputDevice = settings.audioInputDevice ?? '';
		}
	}
	get micGain(){
		return this.#micGain;
	}
	set micGain(value:number){
		this.#micGain = value;
		this.save();
	}
	get volumeGain(){
		return this.#volumeGain;
	}
	set volumeGain(value:number){
		this.#volumeGain = value;
		this.save();
	}
	get calibrationFactor(){
		return this.#calibrationFactor;
	}
	set calibrationFactor(value:number){
		this.#calibrationFactor = value;
		this.save();
	}
	get audioInputDevice(){
		return this.#audioInputDevice;
	}
	set audioInputDevice(value:string){
		this.#audioInputDevice = value;
		this.save();
	}
}
export const userSettingsStore = new UserSettingsStore();
userSettingsStore.load();