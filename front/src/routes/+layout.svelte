<script lang="ts">
	import Navbar from '$lib/components/navbar';
	import '../app.css';

	let { children } = $props();
</script>

<Navbar />
{@render children()}
