<script lang="ts">
	import { pb, botFetch } from '$lib/pocketbase';

	let loading = $state(true);
	let saving = $state(false);
	let error = $state('');
	let success = $state('');

	let chatwootBaseUrl = $state('');
	let chatwootAccountId = $state(0);

	// The API token is write-only: it is stored ENCRYPTED at rest and can never
	// be viewed again (neither from PocketBase nor from this page's memory).
	// `hasToken` only tells us whether one is currently configured.
	let hasToken = $state(false);
	let editingToken = $state(false);
	let newToken = $state('');

	let recordId = $state('');

	const connected = $derived(!!(chatwootBaseUrl && hasToken));
	const tokenAction = $derived(editingToken && !newToken.trim() ? 'removing' : 'replacing');

	async function loadSettings() {
		loading = true;
		try {
			const result = await pb.collection('settings').getList(1, 1);
			if (result.items.length > 0) {
				const r = result.items[0];
				recordId = r.id;
				chatwootBaseUrl = r.chatwoot_base_url || '';
				chatwootAccountId = r.chatwoot_account_id || 0;
				// Never copy the stored token into the page — it is encrypted and
				// write-only. We only remember that one is configured.
				hasToken = !!(r.chatwoot_api_token || '');
			}
		} catch (_) {}
		loading = false;
	}

	loadSettings();

	async function encryptForStorage(value: string): Promise<string> {
		// The browser never holds ENCRYPTION_KEY. Ask the bot-service (the only
		// process with the key) to encrypt the value before it is persisted.
		const resp = await botFetch(`/api/settings/encrypt`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ value })
		});
		if (!resp.ok) {
			const d = await resp.json().catch(() => ({}));
			throw new Error(d.error || `Encryption failed (${resp.status})`);
		}
		const data = await resp.json();
		if (data.mode === 'plaintext') {
			console.warn('ENCRYPTION_KEY is not set on the bot-service — token will be stored in plaintext.');
		}
		return data.encrypted;
	}

	function startChange() {
		newToken = '';
		editingToken = true;
	}

	function startRemove() {
		newToken = '';
		editingToken = true;
	}

	function cancelEdit() {
		newToken = '';
		editingToken = false;
	}

	async function save(e: Event) {
		e.preventDefault();
		saving = true;
		error = '';
		success = '';
		try {
			const data: any = {
				chatwoot_base_url: chatwootBaseUrl,
				chatwoot_account_id: Number(chatwootAccountId)
			};

			if (editingToken) {
				if (newToken.trim()) {
					data.chatwoot_api_token = await encryptForStorage(newToken.trim());
					hasToken = true;
				} else {
					// Empty input while editing = remove the stored token.
					data.chatwoot_api_token = '';
					hasToken = false;
				}
				newToken = '';
				editingToken = false;
			}
			// If the token was not touched, it is omitted entirely so the
			// existing encrypted value is preserved as-is.

			if (recordId) {
				await pb.collection('settings').update(recordId, data);
			} else {
				const r = await pb.collection('settings').create(data);
				recordId = r.id;
			}
			success = 'Settings saved';
		} catch (err: any) {
			error = err?.message || 'Failed to save settings';
		} finally {
			saving = false;
		}
	}
</script>

<div class="max-w-2xl">
	<!-- Page header -->
	<div class="flex flex-wrap items-center justify-between gap-3 mb-6">
		<div>
			<h1 class="text-2xl font-bold text-base-content">Settings</h1>
			<p class="text-sm text-base-content/70 mt-1">
				Configure your Chatwoot connection for the bot service and AgentBots page.
			</p>
		</div>
		{#if !loading}
			{#if connected}
				<span class="badge badge-success badge-lg gap-1.5">
					<span class="w-2 h-2 rounded-full bg-success-content"></span>
					Connected
				</span>
			{:else}
				<span class="badge badge-neutral badge-lg gap-1.5">
					<span class="w-2 h-2 rounded-full bg-base-content/40"></span>
					Not configured
				</span>
			{/if}
		{/if}
	</div>

	{#if loading}
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body">
				<div class="skeleton h-6 w-48"></div>
				<div class="skeleton h-11 w-full mt-4"></div>
				<div class="skeleton h-11 w-full mt-2"></div>
				<div class="skeleton h-11 w-full mt-2"></div>
			</div>
		</div>
	{:else}
		<form onsubmit={save} class="flex flex-col gap-4">
			{#if error}<div class="alert alert-error">{error}</div>{/if}
			{#if success}<div class="alert alert-success">{success}</div>{/if}

			<div class="card bg-base-100 border border-base-300">
				<div class="card-body gap-5">
					<div class="flex flex-wrap items-center justify-between gap-2">
						<h2 class="card-title text-base-content">Chatwoot Connection</h2>
						<span class="badge badge-outline badge-neutral gap-1" title="Sensitive values are AES-256-GCM encrypted before storage; the key lives only on the bot service.">
							🔒 Encrypted at rest
						</span>
					</div>

					<label class="form-control w-full">
						<div class="label pb-1"><span class="label-text font-medium">Base URL *</span></div>
						<input bind:value={chatwootBaseUrl} type="url" placeholder="https://chat.yourcompany.com"
							class="input input-bordered w-full" />
						<p class="label-text-alt text-base-content/60 mt-1 leading-relaxed">
							The URL of your Chatwoot instance, e.g. <code>https://chat.yourcompany.com</code>.
						</p>
					</label>

					<label class="form-control w-full">
						<div class="label pb-1"><span class="label-text font-medium">Account ID *</span></div>
						<input type="number" bind:value={chatwootAccountId} min="1" class="input input-bordered w-full sm:max-w-xs" />
						<p class="label-text-alt text-base-content/60 mt-1 leading-relaxed">
							Find it in your Chatwoot URL: <code>app.chatwoot.com/app/accounts/<strong>123</strong></code>
						</p>
					</label>

					<div class="divider my-0"></div>

					<label class="form-control w-full">
						<div class="label pb-1"><span class="label-text font-medium">API Access Token *</span></div>
						{#if hasToken && !editingToken}
							<div class="flex flex-col sm:flex-row gap-2">
								<input class="input input-bordered flex-1 min-w-0 font-mono" type="password" disabled
									value="••••••••••" aria-label="Stored API token (hidden)" />
								<div class="flex gap-2 shrink-0">
									<button type="button" class="btn btn-outline btn-sm" onclick={startChange}>Change</button>
									<button type="button" class="btn btn-ghost btn-sm text-error" onclick={startRemove}>Remove</button>
								</div>
							</div>
							<p class="label-text-alt text-base-content/60 mt-1.5 flex items-start gap-1.5 leading-relaxed">
								<span class="mt-0.5">🔒</span>
								<span>Stored encrypted at rest and write-only — the value is never shown. Use <strong>Change</strong> to replace it, or <strong>Remove</strong> then <strong>Save</strong> to delete it.</span>
							</p>
						{:else}
							<div class="flex flex-col sm:flex-row gap-2">
								<input type="password" autocomplete="new-password" bind:value={newToken}
									class="input input-bordered flex-1 min-w-0"
									placeholder={hasToken ? 'Paste new API access token' : 'Paste API access token'} />
								{#if editingToken}
									<button type="button" class="btn btn-ghost btn-sm shrink-0" onclick={cancelEdit}>Cancel</button>
								{/if}
							</div>
							{#if editingToken}
								<p class="label-text-alt text-base-content/60 mt-1.5 leading-relaxed">
									{tokenAction === 'removing'
										? 'Save with an empty field to remove the current token. Paste a new value instead to replace it.'
										: 'The current token will be replaced when you save.'}
								</p>
							{:else}
								<p class="label-text-alt text-base-content/60 mt-1.5 leading-relaxed">
									Get your token from <strong>Profile Settings &gt; Access Token</strong>. It is encrypted before storage and can only be replaced, never viewed.
								</p>
							{/if}
						{/if}
					</label>
				</div>

				<div class="card-body border-t border-base-300 !pt-4 flex-col sm:flex-row sm:items-center justify-between gap-3">
					<p class="text-xs text-base-content/60">
						Changes are saved immediately and used by the bot service.
					</p>
					<button type="submit" class="btn btn-primary sm:self-auto" disabled={saving}>
						{#if saving}<span class="loading loading-spinner loading-sm"></span>{/if}
						{saving ? 'Saving…' : 'Save Settings'}
					</button>
				</div>
			</div>
		</form>
	{/if}
</div>
