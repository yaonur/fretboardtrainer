<script lang="ts">
	import Navbar from '$lib/components/navbar';
	import '../app.css';

	let { children } = $props();
</script>

<div class="min-h-dvh bg-white dark:bg-slate-900 dark:text-white">
	<Navbar />
	{@render children()}
</div>
