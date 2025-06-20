import { browser } from '$app/environment';

class ThemeStore {
    #isDark: boolean = $state(false);

    constructor() {
        if (browser) {
            // Check local storage or system preference on initialization
            const stored = localStorage.getItem('theme');
            if (stored) {
                this.#isDark = stored === 'dark';
            } else {
                // Check system preference
                this.#isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            }
        }
    }

    get isDark() {
        return this.#isDark;
    }

    set isDark(value: boolean) {
        this.#isDark = value;
        if (browser) {
            localStorage.setItem('theme', value ? 'dark' : 'light');
            value
            ? document.documentElement.classList.add('dark')
            : document.documentElement.classList.remove('dark');
        }
    }

    toggleTheme() {
        this.isDark = !this.isDark;
    }
}

export const themeStore = new ThemeStore(); 