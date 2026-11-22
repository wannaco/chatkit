<script lang="ts">
	import { pb, botFetch } from '$lib/pocketbase';

	let chatwootInboxes = $state<any[]>([]);
	let menuDocs = $state<any[]>([]);
	let agentBots = $state<any[]>([]);
	let loading = $state(true);
	let error = $state('');
	let configured = $state(false);

	function getInboxType(channelType: string): string {
		if (!channelType) return 'website';
		const c = channelType.toLowerCase();
		if (c.includes('webwidget') || c.includes('web_widget')) return 'website';
		if (c.includes('whatsapp')) return 'whatsapp';
		if (c.includes('facebook')) return 'facebook';
		if (c.includes('telegram')) return 'telegram';
		return 'website';
	}

	function getMenuDoc(chatwootId: any) {
		const cid = String(chatwootId);
		return menuDocs.find(d => String(d.chatwoot_inbox_id) === cid) || null;
	}

	function getAssignedBotName(menuDoc: any): string {
		if (!menuDoc?.assigned_agent_bot_id) return '';
		const bot = agentBots.find(b => b.id === menuDoc.assigned_agent_bot_id);
		return bot?.name || '';
	}

	async function loadAll() {
		loading = true;
		error = '';
		try {
			const settingsResult = await pb.collection('settings').getList(1, 1);
			configured = settingsResult.items.length > 0;

			try {
				const inboxResult = await pb.collection('inboxes').getList(1, 100);
				menuDocs = inboxResult.items;
			} catch { menuDocs = []; }

			if (configured) {
				const [inboxesResp, botsResp] = await Promise.all([
					botFetch(`/api/inboxes`),
					botFetch(`/api/agent_bots`)
				]);
				if (inboxesResp.ok) chatwootInboxes = await inboxesResp.json();
				if (botsResp.ok) agentBots = await botsResp.json();
			}
		} catch (err: any) {
			error = err?.message || 'Failed to load';
		} finally {
			loading = false;
		}
	}

	async function createMenu(chatwootInbox: any) {
		try {
			const record = await pb.collection('inboxes').create({
				chatwoot_inbox_id: chatwootInbox.id,
				name: chatwootInbox.name,
				channel_type: getInboxType(chatwootInbox.channel_type),
				config: JSON.stringify({
					INITIAL_RESPONSE: '',
					MENU_PROMPT: '',
					MENU_ITEMS: [],
					FORM_INTRO_MESSAGE: '',
					FORM_COMPLETE_MESSAGE: '',
					BACK_KEYWORDS: [],
					HOME_KEYWORDS: []
				}),
				assigned_agent_bot_id: null
			});
			window.location.href = `/inbox/${record.id}`;
		} catch (err: any) {
			error = err?.message || 'Failed to create menu';
		}
	}

	async function removeMenu(menuDoc: any) {
		if (!confirm(`Remove menu for "${menuDoc.name}"? The Chatwoot inbox will remain.`)) return;
		try {
			await pb.collection('inboxes').delete(menuDoc.id);
			await loadAll();
		} catch (err: any) {
			error = err?.message || 'Failed to remove menu';
		}
	}

	loadAll();
</script>

<div>
	<div class="flex justify-between items-center mb-6">
		<h1 class="text-2xl font-bold text-base-content">Inboxes</h1>
		<button class="btn btn-ghost btn-sm" onclick={loadAll}>↻ Refresh</button>
	</div>

	{#if loading}
		<div class="space-y-4">
			{#each [1,2,3] as _}
				<div class="card bg-base-100 border border-base-300">
					<div class="card-body">
						<div class="skeleton h-6 w-48"></div>
						<div class="skeleton h-4 w-32 mt-2"></div>
					</div>
				</div>
			{/each}
		</div>
	{:else if !configured}
		<div class="card bg-base-200 p-6">
			<h3 class="font-bold text-lg mb-4 text-base-content">Chatwoot Not Configured</h3>
			<p class="mb-4 text-sm text-base-content/70">Configure your Chatwoot connection in Settings to pull inboxes.</p>
			<a href="/settings" class="btn btn-primary">Go to Settings</a>
		</div>
	{:else if error}
		<div class="alert alert-error">{error}</div>
	{:else}
		<p class="text-sm text-base-content/70 mb-4">Inboxes are pulled from Chatwoot. Create a menu for each inbox you want to configure.</p>

		{#if chatwootInboxes.length === 0}
			<div class="alert alert-info">No inboxes found in Chatwoot.</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{#each chatwootInboxes as ci (ci.id)}
					{@const menuDoc = getMenuDoc(ci.id)}
					{@const type = getInboxType(ci.channel_type)}
					<div class="card bg-base-100 border border-base-300 hover:shadow-lg transition-shadow">
						<div class="card-body">
							<div class="flex justify-between items-start">
								<div class="flex-1">
									<span class="font-semibold text-base-content">{ci.name}</span>
									<div class="flex gap-2 mt-1">
										<span class="badge badge-sm badge-outline capitalize">{type}</span>
										<span class="badge badge-sm badge-ghost">#{ci.id}</span>
									</div>
								</div>
								{#if menuDoc}
									<span class="badge badge-sm badge-success">Menu</span>
								{:else}
									<span class="badge badge-sm badge-ghost">No menu</span>
								{/if}
							</div>

							{#if menuDoc?.assigned_agent_bot_id}
								<div class="text-xs text-base-content/60 mt-2">
									Bot: <span class="font-semibold">{getAssignedBotName(menuDoc)}</span>
								</div>
							{/if}

							<div class="card-actions justify-end mt-3">
								{#if menuDoc}
									<a href="/inbox/{menuDoc.id}" class="btn btn-sm btn-primary">Edit Menu</a>
									<button class="btn btn-sm btn-ghost text-error" onclick={() => removeMenu(menuDoc)}>Remove</button>
								{:else}
									<button class="btn btn-sm btn-outline" onclick={() => createMenu(ci)}>+ Create Menu</button>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>
