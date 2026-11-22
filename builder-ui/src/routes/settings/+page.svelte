<script lang="ts">
	import { pb } from '$lib/pocketbase';

	let loading = $state(true);
	let saving = $state(false);
	let error = $state('');
	let success = $state('');

	let chatwootBaseUrl = $state('');
	let chatwootApiToken = $state('');
	let chatwootAccountId = $state(0);
	let editingToken = $state(false);

	let recordId = $state('');

	async function loadSettings() {
		loading = true;
		try {
			const result = await pb.collection('settings').getList(1, 1);
			if (result.items.length > 0) {
				const r = result.items[0];
				recordId = r.id;
				chatwootBaseUrl = r.chatwoot_base_url || '';
				chatwootApiToken = r.chatwoot_api_token || '';
				chatwootAccountId = r.chatwoot_account_id || 0;
			}
		} catch (_) {}
		loading = false;
	}

	loadSettings();

	async function save(e: Event) {
		e.preventDefault();
		saving = true;
		error = '';
		success = '';
		try {
			const data = {
				chatwoot_base_url: chatwootBaseUrl,
				chatwoot_api_token: chatwootApiToken,
				chatwoot_account_id: Number(chatwootAccountId)
			};
			if (recordId) {
				await pb.collection('settings').update(recordId, data);
			} else {
				const r = await pb.collection('settings').create(data);
				recordId = r.id;
			}
			success = 'Settings saved';
			editingToken = false;
		} catch (err: any) {
			error = err?.message || 'Failed to save settings';
		} finally {
			saving = false;
		}
	}
</script>

<div>
	<h1 class="text-2xl font-bold text-base-content mb-2">Settings</h1>
	<p class="text-sm text-base-content/70 mb-6">
		Configure your Chatwoot connection. This is used by the bot service and AgentBots page.
		Find your Account ID in your Chatwoot URL (e.g., <code>app.chatwoot.com/app/accounts/<strong>123</strong></code>).
		Get your API token from <strong>Profile Settings &gt; Access Token</strong>.
	</p>

	{#if loading}
		<div class="space-y-4">
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<div class="skeleton h-6 w-48"></div>
					<div class="skeleton h-11 w-full mt-4"></div>
					<div class="skeleton h-11 w-full mt-2"></div>
				</div>
			</div>
		</div>
	{:else}
		<form onsubmit={save} class="flex flex-col gap-4 max-w-2xl">
			{#if error}<div class="alert alert-error">{error}</div>{/if}
			{#if success}<div class="alert alert-success">{success}</div>{/if}

			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h2 class="card-title text-base-content">Chatwoot Connection</h2>
					<label class="form-control w-full">
						<div class="label"><span class="label-text">Base URL *</span></div>
						<input bind:value={chatwootBaseUrl} placeholder="https://chat.example.com" class="input input-bordered w-full" />
					</label>
					<label class="form-control w-full">
						<div class="label"><span class="label-text">Account ID *</span></div>
						<input type="number" bind:value={chatwootAccountId} min="1" class="input input-bordered w-full" />
					</label>
					<label class="form-control w-full">
						<div class="label"><span class="label-text">API Access Token *</span></div>
						{#if chatwootApiToken && !editingToken}
							<div class="join w-full">
								<input class="input input-bordered join-item flex-1" type="password" disabled value={chatwootApiToken} />
								<button class="btn btn-outline join-item" type="button"
									onclick={() => { chatwootApiToken = ''; editingToken = true; }}>Change</button>
							</div>
						{:else}
							<input type="password" autocomplete="new-password" bind:value={chatwootApiToken}
								placeholder="Paste API access token" class="input input-bordered w-full" />
						{/if}
					</label>
				</div>
			</div>

			<button type="submit" class="btn btn-primary self-start" disabled={saving}>
				{#if saving}<span class="loading loading-spinner loading-sm"></span>{/if}
				{saving ? 'Saving…' : 'Save Settings'}
			</button>
		</form>
	{/if}
</div>
