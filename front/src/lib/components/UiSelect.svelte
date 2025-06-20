<script lang="ts">
	export let value: number;
	export let length: number;
	export let start: number = 1;
	export let label: string = '';
	export let className: string = '';
	
</script>

{#if label}
	<p class="text-sm font-medium mr-2">{label}</p>
{/if}
<select
	bind:value
	class="ease w-full cursor-pointer dark:text-slate-100 appearance-none rounded border border-slate-200 bg-transparent py-2 pl-3 pr-8 text-sm text-slate-700 shadow-sm transition duration-300 placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-400 focus:shadow-md focus:outline-none {className}"
>
	{#each Array(length) as _, i}
		<option class="px-2 dark:bg-slate-700" value={i + start}>{i + start}</option>
	{/each}
</select> 