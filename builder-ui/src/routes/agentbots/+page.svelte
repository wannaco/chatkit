<script lang="ts">
	import { pb, botFetch } from '$lib/pocketbase';

	let loading = $state(true);
	let error = $state('');
	let success = $state('');

	let configured = $state(false);

	let agentBots = $state<any[]>([]);
	let botsLoading = $state(false);
	let showCreateForm = $state(false);
	let creating = $state(false);
	let editingBot = $state<any | null>(null);
	// AgentBot tokens are hidden by default — only shown on an explicit click.
	let revealedTokens = $state<Record<string, boolean>>({});

	let formData = $state({ name: '', description: '', outgoingUrl: '', avatarUrl: '' });

	async function checkSettings() {
		try {
			const result = await pb.collection('settings').getList(1, 1);
			configured = result.items.length > 0;
		} catch (_) {}
		loading = false;
		if (configured) loadAgentBots();
	}

	async function loadAgentBots() {
		botsLoading = true;
		error = '';
		try {
			const resp = await botFetch(`/api/agent_bots`);
			if (!resp.ok) {
				const d = await resp.json().catch(() => ({}));
				throw new Error(d.error || `Failed (${resp.status})`);
			}
			const data = await resp.json();
			agentBots = Array.isArray(data) ? data : (data.agent_bots || []);
		} catch (err: any) {
			error = err?.message || 'Failed to load AgentBots';
		} finally {
			botsLoading = false;
		}
	}

	async function createAgentBot() {
		if (!formData.name.trim()) { error = 'AgentBot name is required'; return; }
		creating = true; error = ''; success = '';
		try {
			const payload: any = {
				name: formData.name.trim(),
				description: formData.description.trim() || `AgentBot for ${formData.name.trim()}`,
				account_id: 0
			};
			if (formData.outgoingUrl.trim()) payload.outgoing_url = formData.outgoingUrl.trim();
			if (formData.avatarUrl.trim()) payload.avatar_url = formData.avatarUrl.trim();
			const resp = await botFetch(`/api/agent_bots`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			if (!resp.ok) {
				const d = await resp.json().catch(() => ({}));
				throw new Error(d.error || `Failed (${resp.status})`);
			}
			const bot = await resp.json();
			success = `AgentBot "${bot.name}" created!`;
			formData = { name: '', description: '', outgoingUrl: '', avatarUrl: '' };
			showCreateForm = false;
			await loadAgentBots();
		} catch (err: any) { error = err?.message; } finally { creating = false; }
	}

	async function updateAgentBot(bot: any) {
		if (!editingBot) return;
		creating = true; error = ''; success = '';
		try {
			const payload: any = { name: editingBot.name.trim(), description: editingBot.description?.trim() || '' };
			if (editingBot.outgoing_url?.trim()) payload.outgoing_url = editingBot.outgoing_url.trim();
			if (editingBot.avatar_url?.trim()) payload.avatar_url = editingBot.avatar_url.trim();
			const resp = await botFetch(`/api/agent_bots/${bot.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			if (!resp.ok) {
				const d = await resp.json().catch(() => ({}));
				throw new Error(d.error || `Failed (${resp.status})`);
			}
			success = 'AgentBot updated!';
			editingBot = null;
			await loadAgentBots();
		} catch (err: any) { error = err?.message; } finally { creating = false; }
	}

	async function deleteAgentBot(bot: any) {
		if (!confirm(`Delete AgentBot "${bot.name}"?`)) return;
		creating = true; error = ''; success = '';
		try {
			const resp = await botFetch(`/api/agent_bots/${bot.id}`, { method: 'DELETE' });
			if (!resp.ok) {
				const d = await resp.json().catch(() => ({}));
				throw new Error(d.error || `Failed (${resp.status})`);
			}
			success = `AgentBot "${bot.name}" deleted`;
			await loadAgentBots();
		} catch (err: any) { error = err?.message; } finally { creating = false; }
	}

	function startEdit(bot: any) {
		editingBot = { id: bot.id, name: bot.name, description: bot.description || '', outgoing_url: bot.outgoing_url || '', avatar_url: bot.avatar_url || '' };
	}

	checkSettings();
</script>

<div class="max-w-6xl">
	<div class="mb-6">
		<h1 class="text-2xl font-bold text-base-content">AgentBot Management</h1>
		<p class="text-base-content/70 text-sm mt-1">Manage Chatwoot AgentBots for automated conversations.</p>
	</div>

	{#if loading}
		<div class="flex justify-center py-8"><span class="loading loading-spinner loading-lg"></span></div>
	{:else if !configured}
		<div class="card bg-base-200 p-6">
			<h3 class="font-bold text-lg mb-4 text-base-content">Chatwoot Not Configured</h3>
			<p class="mb-4 text-sm text-base-content/70">Configure your Chatwoot connection in Settings first.</p>
			<a href="/settings" class="btn btn-primary">Go to Settings</a>
		</div>
	{:else}
		{#if error}<div class="alert alert-error mb-4">{error}</div>{/if}
		{#if success}<div class="alert alert-success mb-4">{success}</div>{/if}

		<div class="card bg-base-100 border border-base-300">
			<div class="card-body">
				<div class="flex justify-between items-center mb-4">
					<h3 class="font-bold text-base-content">AgentBots</h3>
					{#if !showCreateForm}
						<button class="btn btn-sm btn-primary" onclick={() => showCreateForm = true}>+ Create AgentBot</button>
					{/if}
				</div>

				{#if showCreateForm}
					<div class="card bg-base-200 p-4 mb-4">
						<h4 class="font-bold mb-3 text-base-content">Create New AgentBot</h4>
						<div class="space-y-3 max-w-2xl">
							<label class="form-control w-full">
								<div class="label"><span class="label-text">Name *</span></div>
								<input type="text" class="input input-bordered w-full" bind:value={formData.name} placeholder="My AgentBot" required />
							</label>
							<label class="form-control w-full">
								<div class="label"><span class="label-text">Description</span></div>
								<textarea class="textarea textarea-bordered w-full" bind:value={formData.description} placeholder="Optional" rows="2"></textarea>
							</label>
							<label class="form-control w-full">
								<div class="label"><span class="label-text">Webhook URL</span></div>
								<input type="url" class="input input-bordered w-full" bind:value={formData.outgoingUrl} placeholder="https://chatkit.example.com/webhook/website?inboxId=1" />
							</label>
							<label class="form-control w-full">
								<div class="label"><span class="label-text">Avatar URL</span></div>
								<input type="url" class="input input-bordered w-full" bind:value={formData.avatarUrl} placeholder="https://example.com/avatar.png" />
							</label>
							<div class="flex gap-2">
								<button class="btn btn-primary btn-sm" onclick={createAgentBot} disabled={creating || !formData.name.trim()}>
									{#if creating}<span class="loading loading-spinner loading-xs"></span>{/if} Create
								</button>
								<button class="btn btn-ghost btn-sm" onclick={() => { showCreateForm = false; formData = { name: '', description: '', outgoingUrl: '', avatarUrl: '' }; }} disabled={creating}>Cancel</button>
							</div>
						</div>
					</div>
				{/if}

				{#if botsLoading}
					<div class="flex justify-center py-8"><span class="loading loading-spinner loading-lg"></span></div>
				{:else if agentBots.length === 0}
					<div class="alert alert-info">No AgentBots found. Create one to get started!</div>
				{:else}
					<div class="flex flex-col gap-3">
						{#each agentBots as bot (bot.id)}
							<div class="card bg-base-100 border border-base-300">
								<div class="card-body">
									{#if editingBot && editingBot.id === bot.id}
										<div class="space-y-3">
											<label class="form-control w-full">
												<div class="label"><span class="label-text font-bold">Name</span></div>
												<input type="text" class="input input-bordered input-sm w-full" bind:value={editingBot.name} />
											</label>
											<label class="form-control w-full">
												<div class="label"><span class="label-text font-bold">Description</span></div>
												<textarea class="textarea textarea-bordered textarea-sm w-full" bind:value={editingBot.description} rows="2"></textarea>
											</label>
											<label class="form-control w-full">
												<div class="label"><span class="label-text font-bold">Webhook URL</span></div>
												<input type="url" class="input input-bordered input-sm w-full" bind:value={editingBot.outgoing_url} />
											</label>
											<div class="flex gap-2">
												<button class="btn btn-sm btn-primary" onclick={() => updateAgentBot(bot)} disabled={creating}>
													{#if creating}<span class="loading loading-spinner loading-xs"></span>{/if} Save
												</button>
												<button class="btn btn-sm btn-ghost" onclick={() => editingBot = null} disabled={creating}>Cancel</button>
											</div>
										</div>
									{:else}
										<div class="flex justify-between items-start">
											<div class="flex-1">
												<div class="flex items-center gap-2 mb-2">
													<div class="avatar placeholder">
														<div class="bg-neutral text-neutral-content rounded-full w-8 flex items-center justify-center"><span class="text-sm">🤖</span></div>
													</div>
													<h4 class="font-bold text-lg text-base-content">{bot.name}</h4>
													{#if bot.system_bot}<span class="badge badge-sm badge-info">System</span>{/if}
												</div>
												{#if bot.description}<p class="text-sm text-base-content/70 mb-2">{bot.description}</p>{/if}
												<div class="grid grid-cols-1 gap-1 text-xs text-base-content/70">
													<div><span class="font-semibold">ID:</span> {bot.id}</div>
													{#if bot.outgoing_url}<div><span class="font-semibold">Webhook:</span> <code class="text-xs bg-base-200 px-1 rounded">{bot.outgoing_url}</code></div>{/if}
													{#if bot.access_token}
														<div class="flex items-center gap-1">
															<span class="font-semibold">Token:</span>
															<code class="text-xs bg-base-200 px-1 rounded">{revealedTokens[bot.id] ? bot.access_token : '••••••••••'}</code>
															<button class="btn btn-ghost btn-xs" type="button" title={revealedTokens[bot.id] ? 'Hide token' : 'Reveal token'} onclick={() => revealedTokens[bot.id] = !revealedTokens[bot.id]}>{revealedTokens[bot.id] ? '🙈' : '👁️'}</button>
														</div>
													{/if}
												</div>
											</div>
											<div class="flex gap-1">
												<button class="btn btn-sm btn-ghost" onclick={() => startEdit(bot)} disabled={creating || bot.system_bot}>✏️</button>
												<button class="btn btn-sm btn-ghost text-error" onclick={() => deleteAgentBot(bot)} disabled={creating || bot.system_bot}>🗑️</button>
											</div>
										</div>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<div class="mt-8 card bg-base-200 p-6">
			<h3 class="font-bold text-lg mb-3 text-base-content">About AgentBots</h3>
			<div class="space-y-3 text-sm text-base-content/80">
				<p><strong>What are AgentBots?</strong><br/>Automated agents in Chatwoot that receive webhook events and respond via the Chatwoot API.</p>
				<p><strong>How to use:</strong><br/>1. Create an AgentBot with a webhook URL<br/>2. Assign it to an inbox in Chatwoot settings<br/>3. The bot service responds automatically</p>
				<p><strong>Webhook URL:</strong><br/>Point to your bot service: <code>https://your-domain/webhook/website?inboxId=1</code> (add <code>&amp;secret=…</code> if you set <code>WEBHOOK_SECRET</code>)</p>
			</div>
		</div>
	{/if}
</div>
