<script lang="ts">
	import { onDestroy } from 'svelte';
	import * as Tone from 'tone';

	let workMinutes = $state(25);
	let workSeconds = $state(0);
	let breakMinutes = $state(5);
	let breakSeconds = $state(0);

	let isWorkTimer = $state(true);
	let isRunning = $state(false);
	let isPaused = $state(false);
	let isFocused = $state(false);
	let currentMinutes = $state(workMinutes);
	let currentSeconds = $state(workSeconds);

	let interval: ReturnType<typeof setInterval> | null = null;
	let clickSampler: Tone.Sampler;

	// Time formatting functions
	function formatTime(minutes: number, seconds: number): string {
		const mins = Math.floor(minutes).toString().padStart(2, '0');
		const secs = Math.floor(seconds).toString().padStart(2, '0');
		return `${mins}:${secs}`;
	}

	// Play click sound
	function playClick() {
		if (clickSampler) {
			clickSampler.volume.value = Tone.gainToDb(0.3);
			clickSampler.triggerAttackRelease('C4', '16n', Tone.now() + 0.1);
			clickSampler.triggerAttackRelease('C4', '16n', Tone.now() + 1);
		}
	}

	// Initialize audio
	async function initAudio() {
		await Tone.start();
		clickSampler = new Tone.Sampler({
			urls: {
				C4: '/sounds/beep.wav'
			}
		}).toDestination();
	}

	// Timer logic
	function startTimer() {
		if (!isRunning && !isPaused) {
			initAudio();
		}

		isRunning = true;
		isPaused = false;

		if (interval) {
			clearInterval(interval);
		}

		interval = setInterval(() => {
			if (currentSeconds > 0) {
				currentSeconds--;
			} else if (currentMinutes > 0) {
				currentMinutes--;
				currentSeconds = 59;
			} else {
				// Timer finished
				clearInterval(interval!);
				interval = null;
				isRunning = false;

				// Play click multiple times to indicate timer completion
				playClick();
				setTimeout(() => playClick(), 200);
				setTimeout(() => playClick(), 400);

				// Switch to the other timer
				isWorkTimer = !isWorkTimer;
				if (isWorkTimer) {
					currentMinutes = workMinutes;
					currentSeconds = workSeconds;
				} else {
					currentMinutes = breakMinutes;
					currentSeconds = breakSeconds;
				}

				// Auto-start the next timer
				setTimeout(() => {
					startTimer();
				}, 1000);
			}
		}, 1000);
	}

	function pauseTimer() {
		if (interval) {
			clearInterval(interval);
			interval = null;
		}
		isRunning = false;
		isPaused = true;
	}

	function resetTimer() {
		if (interval) {
			clearInterval(interval);
			interval = null;
		}
		isRunning = false;
		isPaused = false;
		isWorkTimer = true;

		updateCurrentTime();
	}

	function updateCurrentTime() {
		if (isWorkTimer) {
			currentMinutes = workMinutes;
			currentSeconds = workSeconds;
		} else {
			currentMinutes = breakMinutes;
			currentSeconds = breakSeconds;
		}
	}

	// Watch for timer duration changes
	$effect(() => {
		if (!isRunning && !isPaused) {
			updateCurrentTime();
		}
	});

	// Cleanup on destroy
	onDestroy(() => {
		if (interval) {
			clearInterval(interval);
		}
		if (clickSampler) {
			try {
				clickSampler.dispose();
			} catch {}
		}
	});

	// Calculate progress percentage
	const progress = $derived.by(() => {
		const totalSeconds = isWorkTimer
			? workMinutes * 60 + workSeconds
			: breakMinutes * 60 + breakSeconds;
		const currentTotal = currentMinutes * 60 + currentSeconds;
		return totalSeconds > 0 ? (currentTotal / totalSeconds) * 100 : 0;
	});
</script>

<div class="flex min-h-screen flex-col items-center justify-center bg-white p-6 dark:bg-slate-900">
	<div class="w-full max-w-2xl">
		<h1 class="mb-8 text-center text-4xl font-bold text-gray-800 dark:text-white">
			Pomodoro Timer
		</h1>

		<!-- Timer Type Indicator -->
		<div class="mb-6 text-center">
			<div
				class="inline-block rounded-full px-6 py-3 text-lg font-semibold transition-colors"
				class:bg-red-500={isWorkTimer}
				class:text-white={isWorkTimer}
				class:bg-green-500={!isWorkTimer}
			>
				{isWorkTimer ? '🔴 Work' : '🟢 Break'}
			</div>
		</div>

		<!-- Settings Panel -->
		<div
			class="mb-8 rounded-lg border border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-800"
		>
			<h2 class="mb-4 text-xl font-semibold">Timer Settings</h2>

			<!-- Work Timer Settings -->
			<div
				class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/30 dark:bg-red-900/20"
			>
				<div class="mb-4 flex items-center gap-2">
					<span class="text-sm font-medium">🔴 Work Timer:</span>
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div class="flex items-center gap-2">
						<label class="w-16 text-sm font-medium">Minutes:</label>
						<input
							type="number"
							bind:value={workMinutes}
							min="0"
							max="99"
							disabled={isRunning}
							class="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:disabled:bg-gray-900 dark:disabled:text-gray-600"
						/>
					</div>
					<div class="flex items-center gap-2">
						<label class="w-16 text-sm font-medium">Seconds:</label>
						<input
							type="number"
							bind:value={workSeconds}
							min="0"
							max="59"
							disabled={isRunning}
							class="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:disabled:bg-gray-900 dark:disabled:text-gray-600"
						/>
					</div>
				</div>
			</div>

			<!-- Break Timer Settings -->
			<div
				class="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900/30 dark:bg-green-900/20"
			>
				<div class="mb-4 flex items-center gap-2">
					<span class="text-sm font-medium">🟢 Break Timer:</span>
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div class="flex items-center gap-2">
						<label class="w-16 text-sm font-medium">Minutes:</label>
						<input
							type="number"
							bind:value={breakMinutes}
							min="0"
							max="99"
							disabled={isRunning}
							class="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:disabled:bg-gray-900 dark:disabled:text-gray-600"
						/>
					</div>
					<div class="flex items-center gap-2">
						<label class="w-16 text-sm font-medium">Seconds:</label>
						<input
							type="number"
							bind:value={breakSeconds}
							min="0"
							max="59"
							disabled={isRunning}
							class="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:disabled:bg-gray-900 dark:disabled:text-gray-600"
						/>
					</div>
				</div>
			</div>
		</div>

		<!-- Timer Display -->
		 {#if !isFocused}
			 <!-- content here -->
			 <div class="mb-8">
				 <div class="relative flex items-center justify-center">
					 <!-- Circular Progress -->
					 <div class="relative h-64 w-64 sm:h-80 sm:w-80">
						 <!-- Background Circle -->
						 <svg class="h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
							 <circle
								 cx="50"
								 cy="50"
								 r="45"
								 stroke="currentColor"
								 stroke-width="8"
								 fill="none"
								 class="text-gray-200 dark:text-gray-700"
							 />
							 <!-- Progress Circle -->
							 <circle
								 cx="50"
								 cy="50"
								 r="45"
								 stroke="currentColor"
								 stroke-width="8"
								 fill="none"
								 class="transition-all duration-1000"
								 class:text-red-500={isWorkTimer}
								 class:text-green-500={!isWorkTimer}
								 stroke-dasharray={2 * Math.PI * 45}
								 stroke-dashoffset={2 * Math.PI * 45 * (1 - progress / 100)}
								 stroke-linecap="round"
							 />
						 </svg>
	 
						 <!-- Time Display -->
						 <div
							 class="absolute inset-0 flex flex-col items-center justify-center text-6xl font-bold sm:text-7xl"
							 class:text-red-500={isWorkTimer}
							 class:text-green-500={!isWorkTimer}
						 >
							 {formatTime(currentMinutes, currentSeconds)}
						 </div>
					 </div>
				 </div>
			 </div>
		 {/if}
		 <div class="text-center mb-4">
			 <button onclick={() => isFocused = !isFocused} class="rounded-lg bg-blue-500 px-8 py-3 text-lg font-semibold text-white transition-colors hover:bg-blue-600 active:bg-blue-700">
				 {isFocused ? 'Hide Timer' : 'Show Timer'}
			 </button>
		 </div>		 

		<!-- Controls -->
		<div class="mb-8 flex justify-center gap-4">
			{#if !isRunning && !isPaused}
				<button
					onclick={startTimer}
					class="rounded-lg bg-blue-500 px-8 py-3 text-lg font-semibold text-white transition-colors hover:bg-blue-600 active:bg-blue-700"
				>
					▶ Start
				</button>
				<button
					onclick={updateCurrentTime}
					class="rounded-lg bg-gray-500 px-8 py-3 text-lg font-semibold text-white transition-colors hover:bg-gray-600 active:bg-gray-700"
				>
					↻ Reset
				</button>
			{:else if isRunning}
				<button
					onclick={pauseTimer}
					class="rounded-lg bg-yellow-500 px-8 py-3 text-lg font-semibold text-white transition-colors hover:bg-yellow-600 active:bg-yellow-700"
				>
					⏸ Pause
				</button>
				<button
					onclick={resetTimer}
					class="rounded-lg bg-gray-500 px-8 py-3 text-lg font-semibold text-white transition-colors hover:bg-gray-600 active:bg-gray-700"
				>
					⏹ Stop
				</button>
			{:else if isPaused}
				<button
					onclick={startTimer}
					class="rounded-lg bg-blue-500 px-8 py-3 text-lg font-semibold text-white transition-colors hover:bg-blue-600 active:bg-blue-700"
				>
					▶ Resume
				</button>
				<button
					onclick={resetTimer}
					class="rounded-lg bg-gray-500 px-8 py-3 text-lg font-semibold text-white transition-colors hover:bg-gray-600 active:bg-gray-700"
				>
					↻ Reset
				</button>
			{/if}
		</div>

		<!-- Quick Presets -->
		<div class="text-center">
			<h3 class="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">Quick Presets:</h3>
			<div class="flex flex-wrap justify-center gap-2">
				<button
					onclick={() => {
						workMinutes = 15;
						workSeconds = 0;
						breakMinutes = 5;
						breakSeconds = 0;
					}}
					disabled={isRunning}
					class="rounded bg-blue-500 px-3 py-1 text-sm text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
				>
					Classic (25/5)
				</button>
				<button
					onclick={() => {
						workMinutes = 15;
						workSeconds = 0;
						breakMinutes = 5;
						breakSeconds = 0;
					}}
					disabled={isRunning}
					class="rounded bg-blue-500 px-3 py-1 text-sm text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
				>
					Medium (15/5)
				</button>
				<button
					onclick={() => {
						workMinutes = 5;
						workSeconds = 0;
						breakMinutes = 0;
						breakSeconds = 10;
					}}
					disabled={isRunning}
					class="rounded bg-blue-500 px-3 py-1 text-sm text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
				>
					Short (5/10 sec)
				</button>
			</div>
		</div>
	</div>
</div>
