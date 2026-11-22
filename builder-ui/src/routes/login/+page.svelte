<script lang="ts">
	import { pb } from '$lib/pocketbase';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleLogin(e: Event) {
		e.preventDefault();
		error = '';
		loading = true;
		try {
			// Builder users first; fall back to the PocketBase superuser created
			// from PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD on first boot.
			try {
				await pb.collection('users').authWithPassword(email, password);
			} catch {
				await pb.collection('_superusers').authWithPassword(email, password);
			}
			window.location.href = '/';
		} catch (err: any) {
			error = err?.message || 'Login failed';
		} finally {
			loading = false;
		}
	}
</script>

<div class="min-h-screen flex items-center justify-center bg-base-200" data-theme="dark">
	<div class="card bg-base-100 shadow-xl w-96">
		<div class="card-body">
			<h1 class="text-2xl font-bold text-center text-base-content">ChatKit</h1>
			<p class="text-center text-sm text-base-content/60 mb-4">Sign in to your builder</p>

			{#if error}
				<div class="alert alert-error text-sm">{error}</div>
			{/if}

			<form onsubmit={handleLogin} class="flex flex-col gap-3">
				<label class="form-control w-full">
					<div class="label"><span class="label-text">Email</span></div>
					<input type="email" bind:value={email} required placeholder="admin@example.com" class="input input-bordered w-full" />
				</label>

				<label class="form-control w-full">
					<div class="label"><span class="label-text">Password</span></div>
					<input type="password" bind:value={password} required placeholder="••••••••" class="input input-bordered w-full" />
				</label>

				<button type="submit" disabled={loading} class="btn btn-primary w-full mt-2">
					{loading ? 'Signing in…' : 'Sign in'}
				</button>
			</form>
		</div>
	</div>
</div>
