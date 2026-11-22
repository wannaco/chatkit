<script lang="ts">
	import '../app.css';
	import { pb, loadRuntimeConfig } from '$lib/pocketbase';
	import { page } from '$app/stores';

	let { children } = $props();

	let theme = $state('dark');
	let configReady = $state(false);

	$effect(() => {
		loadRuntimeConfig().then(() => { configReady = true; });
	});

	function applyTheme(t: string) {
		theme = t;
		if (typeof document !== 'undefined') {
			document.documentElement.setAttribute('data-theme', t);
		}
	}

	function toggleTheme() {
		const next = theme === 'dark' ? 'nord' : 'dark';
		applyTheme(next);
		try { localStorage.setItem('theme', next); } catch {}
	}

	$effect(() => {
		try {
			const saved = localStorage.getItem('theme');
			if (saved === 'nord' || saved === 'dark') {
				applyTheme(saved);
			} else {
				applyTheme('dark');
			}
		} catch {
			applyTheme('dark');
		}
	});

	function logout() {
		pb.authStore.clear();
		window.location.href = '/login';
	}

	let isSidebarOpen = $state(false);
	let sidebarCollapsed = $state(false);

	$effect(() => {
		try {
			const saved = localStorage.getItem('sidebarCollapsed');
			if (saved === '1') sidebarCollapsed = true;
		} catch {}
	});
	function toggleSidebar() {
		sidebarCollapsed = !sidebarCollapsed;
		try { localStorage.setItem('sidebarCollapsed', sidebarCollapsed ? '1' : '0'); } catch {}
	}
</script>

<svelte:head>
	<link rel="icon" href="/favicon.svg" />
	<title>ChatKit Builder</title>
</svelte:head>

{#if !configReady}
	<div class="min-h-screen flex items-center justify-center bg-base-200" data-theme="dark">
		<span class="loading loading-spinner loading-lg"></span>
	</div>
{:else if $page.url.pathname === '/login'}
	{@render children()}
{:else if !pb.authStore.isValid}
	<meta http-equiv="refresh" content="0; url=/login" />
{:else}
	<div class="drawer {sidebarCollapsed ? '' : 'lg:drawer-open'} bg-base-200 min-h-screen overflow-x-clip">
		<input id="dashboard-drawer" type="checkbox" class="drawer-toggle" bind:checked={isSidebarOpen}>
		<div class="drawer-content">
			<header class="top-bar bg-base-100 border-b border-base-300 min-h-16 px-4 lg:px-6 flex items-center justify-between">
				<div class="flex items-center gap-2">
					<label for="dashboard-drawer" class="btn btn-square btn-ghost lg:hidden drawer-button" aria-label="open sidebar">
						&#9776;
					</label>
					<button class="btn btn-square btn-ghost hidden lg:inline-flex" onclick={toggleSidebar} aria-label="toggle sidebar" title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
						&#9776;
					</button>
				</div>
				<div class="user-info flex items-center gap-3 text-base-content ml-auto">
					<button class="btn btn-outline btn-sm" onclick={toggleTheme} aria-label="Toggle theme" title="Toggle theme">
						{#if theme === 'dark'}
							&#9728;
						{:else}
							&#9790;
						{/if}
					</button>
					<span class="text-sm md:text-base leading-none">{pb.authStore.model?.email || 'User'}</span>
					<button onclick={logout} class="btn btn-error btn-sm normal-case">Logout</button>
				</div>
			</header>

			<main class="flex flex-col overflow-hidden w-full">
				<div class="p-6 overflow-y-auto flex-1">
					{@render children()}
				</div>
			</main>
		</div>

		<div class="drawer-side">
			<label for="dashboard-drawer" aria-label="close sidebar" class="drawer-overlay"></label>
			<aside class="w-72 bg-base-100 border-r border-base-300 min-h-screen flex flex-col">
				<div class="px-6 pt-5 pb-4">
					<div class="flex items-center gap-2">
						<div class="flex flex-col leading-tight">
							<h2 class="m-0 text-xl font-bold text-base-content">ChatKit Builder</h2>
							<p class="m-0 mt-1 text-sm text-base-300">Rule-based conversation automation</p>
						</div>
					</div>
				</div>
				<nav class="px-6 py-4 flex-1 overflow-y-auto">
					<div class="flex flex-col h-full gap-3">
						<ul class="menu bg-base-200 rounded-box w-full mt-4">
							<li>
								<a href="/" class:active={$page.url.pathname === '/'} class="gap-3">
									<span>Inboxes</span>
								</a>
							</li>
							<li>
								<a href="/agentbots" class:active={$page.url.pathname === '/agentbots'} class="gap-3">
									<span>AgentBots</span>
								</a>
							</li>
							<li>
								<a href="/settings" class:active={$page.url.pathname === '/settings'} class="gap-3">
									<span>Settings</span>
								</a>
							</li>
						</ul>
					</div>
				</nav>
			</aside>
		</div>
	</div>
{/if}
