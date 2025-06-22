<script lang="ts">
	// import { languageTag, type AvailableLanguageTag } from '$lib/paraglide/runtime';
	import { setLocale } from '$lib/paraglide/runtime';
	import { page } from '$app/state';
	import * as m from '$lib/paraglide/messages.js';
	import { goto } from '$app/navigation';
	import { LocalStorage } from '$lib/stores/storage.svelte';
	import { onMount } from 'svelte';
	import ThemeToggle from '$lib/components/icons/ThemeToggle.svelte';

	const lang = new LocalStorage('lang', 'en');
	let isMenuOpen = $state(false);
	let { class: className = '' } = $props();

	function switchToLanguage() {
		setLocale(lang.current);
		// const canonicalPath = i18n.route(page.url.pathname);
		// let localisedPath = i18n.resolveRoute(canonicalPath, lang.current as AvailableLanguageTag);
		// if (localisedPath.length > 1 && localisedPath[localisedPath.length - 1] === '/') {
		// 	localisedPath = localisedPath.slice(0, -1);
		// }

		// if (page.url.pathname !== localisedPath) {
		// 	setTimeout(() => {
		// 		goto(localisedPath)
		// 			.then(() => {})
		// 			.catch((error) => {
		// 				console.error('Navigation error:', error);
		// 			});
		// 	}, 0);
		// }
	}

	function toggleMenu() {
		isMenuOpen = !isMenuOpen;
	}

	function closeMenu() {
		isMenuOpen = false;
	}

	$effect(() => {
		if (!lang.current) {
			debugger;
			lang.current = 'en';
		}
		switchToLanguage();
	});
</script>

<nav class="bg-gray-800 px-4 py-2 text-white shadow-lg {className}">
	<div class="container mx-auto flex items-center justify-between">
		<!-- Hamburger menu button for mobile -->
		<button class="p-2 lg:hidden" onclick={toggleMenu} aria-label="Toggle menu">
			<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M4 6h16M4 12h16M4 18h16"
				/>
			</svg>
		</button>

		<!-- Desktop navigation -->
		<div class="hidden gap-4 lg:flex">
			<a href="/" class="font-medium transition-colors duration-200 hover:text-blue-400"
				>{m.home()}</a
			>
			<a href="/degrees" class="font-medium transition-colors duration-200 hover:text-blue-400"
				>{m.degrees()}</a
			>
			<!-- <a href="/setlist" class="font-medium transition-colors duration-200 hover:text-blue-400"
				>{m.setlist()}</a
			> -->
		</div>

		<!-- Add theme toggle before the language selector -->
		<div class="flex items-center gap-4">
			<ThemeToggle />
			<select
				onchange={switchToLanguage}
				bind:value={lang.current}
				class="bordere-none600 focus:outline-hidden cursor-pointer rounded-md border bg-gray-700 py-1 text-white focus:ring-2 focus:ring-blue-500"
			>
				<option value="en">EN</option>
				<option value="tr">TR</option>
				<!-- <option value="de">DE</option> -->
			</select>
		</div>
	</div>

	<!-- Mobile menu -->
	{#if isMenuOpen}
		<div
			class="fixed left-0 right-0 top-14 z-50 transform bg-gray-800 p-4 shadow-lg transition-transform duration-200 ease-in-out lg:hidden"
			style="transform: translateY({isMenuOpen ? '0' : '100%'});"
		>
			<div class="flex flex-col gap-4">
				<a
					href="/"
					onclick={closeMenu}
					class="py-2 text-center font-medium transition-colors duration-200 hover:text-blue-400"
					>{m.home()}</a
				>
				<a href="/degrees" class="font-medium transition-colors duration-200 hover:text-blue-400"
				>{m.degrees()}</a
			>
			</div>
		</div>
	{/if}
</nav>
