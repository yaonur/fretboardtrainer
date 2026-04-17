<script lang="ts">
	import { onMount } from 'svelte';
	import Navbar from '$lib/components/navbar';
	import '../app.css';
	import { connectivity } from '$lib/offline/connectivity.svelte';
	import { isPresetRemoteSyncEnabled } from '$lib/offline/presetSyncUrl';
	import * as m from '$lib/paraglide/messages.js';
	import { pwaInfo } from 'virtual:pwa-info';

	let { children } = $props();

	const offline = $derived(!connectivity.online);
	const presetRemoteMode = $derived(isPresetRemoteSyncEnabled());
	const webManifest = $derived(pwaInfo ? pwaInfo.webManifest.linkTag : '');

	onMount(() => {
		if (!pwaInfo) return;
		let cancelled = false;
		void import('virtual:pwa-register').then(({ registerSW }) => {
			if (cancelled) return;
			registerSW({ immediate: true });
		});
		return () => {
			cancelled = true;
		};
	});
</script>

<svelte:head>
	{@html webManifest}
</svelte:head>

<div class="min-h-dvh bg-white dark:bg-slate-900 dark:text-white">
	{#if offline}
		<div
			class="border-b border-amber-800/40 bg-amber-950/90 px-4 py-2 text-center text-sm text-amber-100"
			role="status"
		>
			<p>{m.offline_banner()}</p>
			{#if presetRemoteMode}
				<p class="mt-1 text-xs text-amber-200/90">{m.offline_presets_hint()}</p>
			{/if}
		</div>
	{/if}
	<Navbar />
	{@render children()}
</div>
