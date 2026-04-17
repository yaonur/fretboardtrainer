import { browser } from '$app/environment';

/** Mirrors `navigator.onLine` for UI and data-layer checks. */
let online = $state(true);

if (browser) {
	online = navigator.onLine;
	window.addEventListener('online', () => {
		online = true;
	});
	window.addEventListener('offline', () => {
		online = false;
	});
}

export const connectivity = {
	get online() {
		return online;
	}
};
