<script lang="ts">
	import { pb } from '$lib/pocketbase';
	import { page } from '$app/stores';
	import ChatPreview from '$lib/components/ChatPreview.svelte';
	import MenuItemModal from '$lib/components/MenuItemModal.svelte';
	import FlowView from '$lib/components/FlowView.svelte';
	import { MENU_TEMPLATES } from '$lib/menuTemplates';
	import { botFetch } from '$lib/pocketbase';

	let id = $derived($page.params.id);

	let loading = $state(true);
	let saving = $state(false);
	let error = $state('');
	let success = $state('');

	let name = $state('');
	let chatwootInboxId = $state(0);
	let channelType = $state('website');
	let active = $state(true);
	let assignedAgentBotId = $state<any>(null);
	let agentBots = $state<any[]>([]);
	let assigningBot = $state(false);
	let config = $state<any>({
		INITIAL_RESPONSE: 'Hello! How can we help you today?',
		MENU_PROMPT: 'Please choose an option:',
		MENU_ITEMS: [],
		BACK_KEYWORDS: ['back'],
		HOME_KEYWORDS: ['home', 'menu'],
		BACK_HOME_HINT: '',
		AGENT_REQUEST_KEYWORDS: ['agent', 'human'],
		HANDOFF_MESSAGE: 'Connecting you to a team member...',
		ATTACHMENT_ACK_MESSAGE: '',
		FORM_INTRO_MESSAGE: 'Please answer the following questions:',
		FORM_COMPLETE_MESSAGE: 'Thank you! Your response has been recorded.',
		crmWebhookUrl: '',
		crmWebhookSecret: '',
		enableContactEnrichment: true,
		enableIntentLabels: true,
		enableHandoffContext: true,
		enableLeadAlerts: true,
		leadAlertMessage: '',
		leadAlertTeam: '',
		FOLLOW_UP_MESSAGE: '',
		FOLLOW_UP_DELAY_SECONDS: 120,
		FOLLOW_UP_MAX_REMINDERS: 1
	});

	let hasWebhookSecret = $state(false);
	let editingSecret = $state(false);
	let newWebhookSecret = $state('');

	let isNew = $derived(id === 'new');

	async function loadInbox() {
		if (isNew) {
			loading = false;
			return;
		}
		if (!id) return;
		try {
			const record = await pb.collection('inboxes').getOne(id);
			name = record.name;
			chatwootInboxId = record.chatwoot_inbox_id;
			channelType = record.channel_type;
			active = record.active;
			assignedAgentBotId = record.assigned_agent_bot_id || null;
			const cfg = typeof record.config === 'string' ? JSON.parse(record.config) : (record.config || {});
			config = { ...config, ...cfg };
			// The CRM secret is stored encrypted and is write-only: never load its
			// value into the page, only remember that one is configured.
			hasWebhookSecret = !!(cfg.crmWebhookSecret || '');
			// Load agent bots for assignment
			try {
				const resp = await botFetch(`/api/agent_bots`);
				if (resp.ok) agentBots = await resp.json();
			} catch {}
		} catch (err: any) {
			error = err?.message || 'Failed to load inbox';
		} finally {
			loading = false;
			loaded = true;
			skipNextAutoSave = true;
		}
	}

	// Reactively load when id becomes available
	$effect(() => { if (id) loadInbox(); });

	let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
	let loaded = $state(false);
	let skipNextAutoSave = $state(true);

	// Debounced auto-save — triggers 2s after any tracked field changes.
	// NOTE: `void config` alone does NOT track nested mutations (e.g. MENU_ITEMS
	// reassigned by nest/unlink/move) — deep-read the whole config so every change
	// re-runs this effect.
	$effect(() => {
		void JSON.stringify(config);
		void name;
		void channelType;
		void active;
		void assignedAgentBotId;
		void editingSecret;

		if (!loaded || isNew) return;
		// While a secret edit is in progress, don't auto-save — the secret change
		// is only applied on an explicit Save.
		if (editingSecret) return;
		if (skipNextAutoSave) { skipNextAutoSave = false; return; }
		if (autoSaveTimer) clearTimeout(autoSaveTimer);
		autoSaveTimer = setTimeout(() => save(true), 2000);
	});

	async function encryptForStorage(value: string): Promise<string> {
		// The browser never holds ENCRYPTION_KEY — ask the bot-service (the only
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
			console.warn('ENCRYPTION_KEY is not set on the bot-service — CRM secret will be stored in plaintext.');
		}
		return data.encrypted;
	}

	async function save(silent = false) {
		saving = true;
		error = '';
		if (!silent) success = '';
		if (!id) return;
		try {
			// CRM secret handling: applied on save, only when the user edited it.
			if (editingSecret) {
				if (newWebhookSecret.trim()) {
					config.crmWebhookSecret = await encryptForStorage(newWebhookSecret.trim());
					hasWebhookSecret = true;
				} else {
					config.crmWebhookSecret = '';
					hasWebhookSecret = false;
				}
				newWebhookSecret = '';
				editingSecret = false;
			}
			const data = {
				name,
				chatwoot_inbox_id: chatwootInboxId,
				channel_type: channelType,
				active,
				config,
				assigned_agent_bot_id: assignedAgentBotId || null
			};
			if (isNew) {
				const record = await pb.collection('inboxes').create(data);
				success = 'Inbox created';
				window.location.href = `/inbox/${record.id}`;
			} else {
				await pb.collection('inboxes').update(id, data);
				success = silent ? 'Auto-saved' : 'Saved successfully';
			}
		} catch (err: any) {
			error = err?.message || 'Failed to save';
		} finally {
			saving = false;
		}
	}

	let modalIndex = $state<number | null>(null);
	let parentModalStack: number[] = [];
	let showDeleteModal = $state(false);
	let pendingDeleteIndex = $state(-1);
	let pendingDeleteKey = $state('');
	let showSettings = $state(false);
	let settingsTab = $state<'general' | 'messages' | 'crm' | 'followup'>('general');
	let showTemplateModal = $state(false);
	let templateConfirmId = $state<string | null>(null);
	let viewMode = $state<'list' | 'flow'>('list');

	function flowEdit(key: string) {
		const idx = config.MENU_ITEMS?.findIndex((it: any) => it.key === key) ?? -1;
		if (idx >= 0) openModal(idx);
	}
	function flowDelete(key: string) {
		const idx = config.MENU_ITEMS?.findIndex((it: any) => it.key === key) ?? -1;
		if (idx >= 0) openDeleteModal(idx);
	}
	// Add a new SUB-MENU item under the given node (converts the node to a submenu if needed).
	function flowAddChild(key: string) {
		const idx = config.MENU_ITEMS?.findIndex((it: any) => it.key === key) ?? -1;
		if (idx < 0) return;
		createChild(idx);
	}

	// Top-level ordering: drag a node's LEFT/RIGHT handle onto another node to place it
	// before/after at the top level. The dragged node is made a ROOT (parent cleared) and
	// re-inserted in the menu order relative to the target — no nesting, no submenu conversion.
	function flowOrder(sourceKey: string, targetKey: string, before: boolean) {
		const items: any[] = config.MENU_ITEMS || [];
		const si = items.findIndex((it: any) => it.key === sourceKey);
		const ti = items.findIndex((it: any) => it.key === targetKey);
		if (si < 0 || ti < 0 || si === ti) return;
		const source = items[si];
		const target = items[ti];
		// Only meaningful if the TARGET is a root (we place the source around it in the chain).
		if (target._parentKey) return;
		// Remove the source from its old parent's children_options (if any), so it becomes a root.
		let next = items;
		const oldParentKey = source._parentKey;
		if (oldParentKey) {
			next = next.map((it: any) =>
				it.key === oldParentKey
					? { ...it, children_options: (it.children_options || []).filter((c: any) => c.key !== sourceKey) }
					: it
			);
		}
		// Clear the source's parent and re-insert it before/after the target (as a root).
		const sourceClean = { ...source, _parentKey: '', _parentLabel: '' };
		const without = next.filter((it: any) => it.key !== sourceKey);
		const ti2 = without.findIndex((it: any) => it.key === targetKey);
		if (ti2 < 0) return;
		const insertAt = before ? ti2 : ti2 + 1;
		config.MENU_ITEMS = [...without.slice(0, insertAt), sourceClean, ...without.slice(insertAt)];
		success = `Moved "${sourceKey}" ${before ? 'before' : 'after'} "${targetKey}" (top level)`;
		setTimeout(() => { success = ''; }, 2500);
	}

	function flowConnect(sourceKey: string, targetKey: string) {
		const items: any[] = config.MENU_ITEMS || [];
		const si = items.findIndex((it: any) => it.key === sourceKey);
		const ti = items.findIndex((it: any) => it.key === targetKey);
		if (si < 0 || ti < 0 || si === ti) return;
		const source = items[si];
		const target = items[ti];

		// Prevent cycles: if target is already inside source's subtree, connecting would loop.
		const byKey = new Map(items.map((it: any) => [it?.key, it]));
		let cur: any = target;
		const seen = new Set<string>();
		while (cur?._parentKey && !seen.has(cur._parentKey)) {
			if (cur._parentKey === sourceKey) return; // already a child
			seen.add(cur._parentKey);
			cur = byKey.get(cur._parentKey);
		}

		// Also reject if the target is an ANCESTOR of the source — connecting would make
		// the source the parent of its own ancestor (cycle), which orphanes the whole subtree.
		let anc: any = source;
		const seenAnc = new Set<string>();
		while (anc?._parentKey && !seenAnc.has(anc._parentKey)) {
			if (anc._parentKey === targetKey) return;
			seenAnc.add(anc._parentKey);
			anc = byKey.get(anc._parentKey);
		}

		let next = items;
		// Remove from any previous parent's children_options (re-parent).
		const oldParentKey = target._parentKey;
		if (oldParentKey && oldParentKey !== sourceKey) {
			next = next.map((it: any) =>
				it.key === oldParentKey
					? { ...it, children_options: (it.children_options || []).filter((c: any) => c.key !== targetKey) }
					: it
			);
		}
		// Ensure the source is a submenu so it can have children.
		next = next.map((it: any, i: number) =>
			i === si && !isSubmenu(it)
				? { ...it, response: { content_type: 'submenu' } }
				: it
		);
		// Add the child to the source's children_options (dedupe).
		next = next.map((it: any, i: number) =>
			i === si
				? {
						...it,
						children_options: (it.children_options || []).some((c: any) => c.key === targetKey)
							? it.children_options
							: [...(it.children_options || []), { key: targetKey, label: targetKey }]
				  }
				: it
		);
		// Set the target's parent.
		next = next.map((it: any, i: number) =>
			i === ti ? { ...it, _parentKey: sourceKey, _parentLabel: sourceKey } : it
		);
		config.MENU_ITEMS = next;
		success = `Linked "${targetKey}" under "${sourceKey}"`;
		setTimeout(() => { success = ''; }, 2500);
	}

	// The parent a row is EFFECTIVELY nested under: only counts if the parent actually
	// lists the item in children_options. Stale _parentKey (parent missing or no
	// longer listing us) is ignored so the dropdown never lies.
	function effectiveParentKey(it: any): string {
		if (!it?._parentKey) return '';
		const p = (config.MENU_ITEMS || []).find((x: any) => x.key === it._parentKey);
		return p && (p.children_options || []).some((c: any) => c?.key === it.key) ? it._parentKey : '';
	}

	// A submenu with no children is meaningless — demote it back to a plain text item.
	function demoteIfEmptySubmenu(x: any): any {
		if (isSubmenu(x) && (x.children_options || []).length === 0) {
			return { ...x, response: 'Your response text here' };
		}
		return x;
	}

	// Detach a child from its parent — makes it a top-level item again (both views agree).
	function flowUnlink(key: string) {
		const items: any[] = config.MENU_ITEMS || [];
		const it = items.find((x: any) => x.key === key);
		if (!it?._parentKey) return;
		const parentKey = it._parentKey;
		config.MENU_ITEMS = items.map((x: any) => {
			if (x.key === key) return { ...x, _parentKey: '', _parentLabel: '' };
			if (x.key === parentKey) {
				const kids = (x.children_options || []).filter((c: any) => c.key !== key);
				return demoteIfEmptySubmenu({ ...x, children_options: kids });
			}
			return x;
		});
		success = `Unlinked "${key}" (now top level)`;
		setTimeout(() => { success = ''; }, 2500);
	}

	// All descendants of a key (for cycle guards + nest-under options).
	function descendantKeys(key: string): Set<string> {
		const items: any[] = config.MENU_ITEMS || [];
		const byKey = new Map(items.map((it: any) => [it.key, it]));
		const out = new Set<string>();
		const stack = [key];
		while (stack.length) {
			const cur = stack.pop()!;
			const it = byKey.get(cur);
			for (const c of (it?.children_options || [])) {
				const ck = c?.key;
				if (ck && !out.has(ck)) { out.add(ck); stack.push(ck); }
			}
		}
		return out;
	}

	// Candidate parents for the list "move under" select (self + descendants excluded).
	function parentOptionsFor(key: string): string[] {
		const items: any[] = config.MENU_ITEMS || [];
		if (!key) return [''];
		const desc = descendantKeys(key);
		return ['', ...items.filter((o: any) => o.key && o.key !== key && !desc.has(o.key)).map((o: any) => o.key)];
	}

	// Re-parent an item: '' = top level, otherwise make it a child of targetKey
	// (auto-converts target to a submenu, cycle-safe).
	function listSetParent(key: string, targetKey: string) {
		const items: any[] = config.MENU_ITEMS || [];
		if (key === targetKey) return;
		const it = items.find((x: any) => x.key === key);
		if (!it) return;
		const desc = descendantKeys(key);
		if (targetKey && desc.has(targetKey)) return; // would be a cycle
		const oldParentKey = it._parentKey || '';
		const next = items.map((x: any) => {
			if (oldParentKey && x.key === oldParentKey) {
				const kids = (x.children_options || []).filter((c: any) => c.key !== key);
				return demoteIfEmptySubmenu({ ...x, children_options: kids });
			}
			if (targetKey && x.key === targetKey) {
				const kids = (x.children_options || []).some((c: any) => c.key === key)
					? x.children_options
					: [...(x.children_options || []), { key, label: key }];
				return {
					...x,
					response: isSubmenu(x) ? x.response : { content_type: 'submenu' },
					children_options: kids
				};
			}
			if (x.key === key) {
				return targetKey
					? { ...x, _parentKey: targetKey, _parentLabel: targetKey }
					: { ...x, _parentKey: '', _parentLabel: '' };
			}
			return x;
		});
		config.MENU_ITEMS = next;
		success = targetKey ? `"${key}" is now a sub-item of "${targetKey}"` : `"${key}" is now top level`;
		setTimeout(() => { success = ''; }, 2500);
	}

	// Move an item up/down within its level (roots reorder the chain, children reorder among siblings).
	function listMove(key: string, delta: number) {
		const items: any[] = config.MENU_ITEMS || [];
		const idx = items.findIndex((x: any) => x.key === key);
		if (idx < 0) return;
		const item = items[idx];
		if (item._parentKey) {
			const parent = items.find((x: any) => x.key === item._parentKey);
			if (!parent) return;
			const kids = [...(parent.children_options || [])];
			const ki = kids.findIndex((c: any) => c.key === key);
			const swap = ki + delta;
			if (ki < 0 || swap < 0 || swap >= kids.length) return;
			[kids[ki], kids[swap]] = [kids[swap], kids[ki]];
			config.MENU_ITEMS = items.map((x: any) => x.key === parent.key ? { ...x, children_options: kids } : x);
		} else {
			const rootIdx = items.map((x: any, i: number) => ({ x, i })).filter(({ x }) => !x._parentKey).map(({ i }) => i);
			const ri = rootIdx.indexOf(idx);
			const swap = ri + delta;
			if (ri < 0 || swap < 0 || swap >= rootIdx.length) return;
			const a = rootIdx[ri], b = rootIdx[swap];
			const next = [...items];
			[next[a], next[b]] = [next[b], next[a]];
			config.MENU_ITEMS = next;
		}
	}

	function normalizeKey(s: string) { return (s || '').replace(/\s+/g, ' ').trim(); }

	function isSubmenu(it: any) {
		return it && typeof it.response === 'object' && it.response?.content_type === 'submenu';
	}

	function getResponseTypeLabel(it: any): string {
		const resp = it?.response;
		if (typeof resp === 'string') return 'Text';
		const type = resp?.content_type;
		switch (type) {
			case 'article': return 'Article';
			case 'input_select': return 'Input Select';
			case 'form': return 'Form';
			case 'sequential_form': return 'Sequential Form';
			case 'cards': return 'Cards';
			case 'submenu': return 'Submenu';
			default: return type ? type.replace(/_/g, ' ') : 'Text';
		}
	}

	function summarizeResponse(it: any): string {
		const resp = it?.response;
		if (typeof resp === 'string') {
			const t = resp.trim();
			if (!t) return 'No message yet';
			return t.length > 80 ? `${t.slice(0, 77)}…` : t;
		}
		const type = resp?.content_type;
		const items = resp?.content_attributes?.items;
		switch (type) {
			case 'article': return `${items?.length || 0} article(s)`;
			case 'input_select': return `${items?.length || 0} option(s)`;
			case 'form': case 'sequential_form': return `${items?.length || 0} field(s)`;
			case 'cards': return `${items?.length || 0} card(s)`;
			case 'submenu': return `${it?.children_options?.length || 0} sub-item(s)`;
			default: return 'Click Edit to configure';
		}
	}

	function getOrderedIndexes(): number[] {
		const items = config.MENU_ITEMS || [];
		const byKey = new Map<string, number>(items.map((it: any, i: number) => [it.key, i] as [string, number]));
		const childSet = new Set<number>();
		for (const it of items) {
			if (Array.isArray(it.children_options)) {
				for (const ch of it.children_options) {
					const ci = byKey.get(ch.key);
					if (ci !== undefined) childSet.add(ci);
				}
			}
		}
		const roots = items.map((_: any, i: number) => i).filter((i: number) => !childSet.has(i));
		const ordered: number[] = [];
		function walk(parentIdx: number) {
			ordered.push(parentIdx);
			const parent = items[parentIdx];
			if (isSubmenu(parent) && Array.isArray(parent.children_options)) {
				for (const ch of parent.children_options) {
					const ci = byKey.get(ch.key);
					if (ci !== undefined) walk(ci);
				}
			}
		}
		for (const r of roots) walk(r);
		return ordered;
	}

	function getDepth(realIndex: number): number {
		const items = config.MENU_ITEMS || [];
		const item = items[realIndex];
		if (!item?._parentKey) return 0;
		const byKey = new Map<string, any>(items.map((it: any) => [it.key, it] as [string, any]));
		let depth = 0;
		let cur: any = item;
		const seen = new Set<string>();
		while (cur?._parentKey && !seen.has(cur._parentKey)) {
			const parent = byKey.get(cur._parentKey);
			// Only count this level if the parent actually lists us as a child — same rule
			// as the flow view (children_options is the source of truth). A stale _parentKey
			// (parent missing or no longer lists us) means we're really a root.
			if (!parent || !(parent.children_options || []).some((c: any) => c?.key === cur.key)) break;
			seen.add(cur._parentKey);
			depth++;
			cur = parent;
		}
		return depth;
	}

	let orderedIndexes = $derived(getOrderedIndexes());
	let rowMenu = $state<string | null>(null); // which row's ⋯ menu is open
	let rowMenuPos = $state<{ top: number; left: number } | null>(null);

	function addMenuItem() {
		let n = (config.MENU_ITEMS?.length || 0) + 1;
		let newKey = `Option ${n}`;
		const existing = new Set((config.MENU_ITEMS || []).map((it: any) => it.key));
		while (existing.has(newKey)) { n++; newKey = `Option ${n}`; }
		config.MENU_ITEMS = [...config.MENU_ITEMS, { key: newKey, response: 'Your response text here', children_options: [], _parentKey: '', _parentLabel: '' }];
		openModal(config.MENU_ITEMS.length - 1);
	}

	function openModal(idx: number) {
		modalIndex = idx;
	}

	function closeModal() {
		const prev = parentModalStack.shift();
		if (typeof prev === 'number' && config.MENU_ITEMS[prev]) {
			openModal(prev);
			return;
		}
		modalIndex = null;
	}

	function saveMenuItem(idx: number, updated: any) {
		const prevKey = config.MENU_ITEMS[idx]?.key;
		const stillSubmenu = isSubmenu(updated);
		config.MENU_ITEMS = config.MENU_ITEMS.map((it: any, i: number) => {
			if (i === idx) return updated;
			// If this node is no longer a submenu, any child pointing at it becomes a root —
			// otherwise list view (via _parentKey) and flow view (via children/submenu type)
			// disagree and the child looks disconnected in the flow.
			if (!stillSubmenu && it._parentKey && it._parentKey === prevKey) {
				return { ...it, _parentKey: '', _parentLabel: '' };
			}
			return it;
		});
	}

	function deleteMenuItem(idx: number) {
		const item = config.MENU_ITEMS[idx];
		const prevKey = item?.key;
		config.MENU_ITEMS = config.MENU_ITEMS.filter((_: any, i: number) => i !== idx);
		if (prevKey) {
			config.MENU_ITEMS = config.MENU_ITEMS.map((it: any) => {
				const kids = Array.isArray(it.children_options) ? it.children_options.filter((ch: any) => ch.key !== prevKey) : [];
				const cleaned = { ...it, children_options: kids };
				// Demote if we just emptied it; also clear stale _parentKey pointing at the deleted item.
				const demoted = demoteIfEmptySubmenu(cleaned);
				return demoted._parentKey === prevKey ? { ...demoted, _parentKey: '', _parentLabel: '' } : demoted;
			});
		}
		modalIndex = null;
	}

	function moveItem(idx: number, dir: -1 | 1) {
		const items = [...config.MENU_ITEMS];
		const newIdx = idx + dir;
		if (newIdx < 0 || newIdx >= items.length) return;
		[items[idx], items[newIdx]] = [items[newIdx], items[idx]];
		config.MENU_ITEMS = items;
	}

	function createChild(parentIdx: number) {
		const parent = config.MENU_ITEMS[parentIdx];
		if (!parent) return;
		if (!isSubmenu(parent)) {
			config.MENU_ITEMS = config.MENU_ITEMS.map((it: any, i: number) => i === parentIdx ? { ...it, response: { content_type: 'submenu' } } : it);
		}
		let n = (config.MENU_ITEMS?.length || 0) + 1;
		const existing = new Set((config.MENU_ITEMS || []).map((it: any) => it.key));
		let newKey = `Item ${n}`;
		while (existing.has(newKey)) { n++; newKey = `Item ${n}`; }
		const child = { key: newKey, response: 'Your response text here', _parentKey: parent.key, _parentLabel: parent.key, children_options: [] };
		config.MENU_ITEMS = [...config.MENU_ITEMS, child];
		const parentItem = config.MENU_ITEMS[parentIdx];
		parentItem.children_options = [...(parentItem.children_options || []), { key: newKey, label: newKey }];
		config.MENU_ITEMS = [...config.MENU_ITEMS];
		parentModalStack = [parentIdx, ...parentModalStack.filter(v => v !== parentIdx)];
		openModal(config.MENU_ITEMS.length - 1);
	}

	function openChild(parentKey: string) {
		const idx = config.MENU_ITEMS.findIndex((it: any) => it.key === parentKey);
		if (idx < 0) return;
		if (typeof modalIndex === 'number') {
			parentModalStack = [modalIndex, ...parentModalStack.filter(v => v !== modalIndex)];
		}
		openModal(idx);
	}

	function moveChild(parentIdx: number, childIndex: number, delta: number) {
		const parent = config.MENU_ITEMS[parentIdx];
		if (!parent?.children_options) return;
		const arr = parent.children_options;
		const target = childIndex + delta;
		if (target < 0 || target >= arr.length) return;
		const [entry] = arr.splice(childIndex, 1);
		arr.splice(target, 0, entry);
		config.MENU_ITEMS = [...config.MENU_ITEMS];
	}

	function unlinkChild(parentIdx: number, childIndex: number) {
		const parent = config.MENU_ITEMS[parentIdx];
		if (!parent?.children_options) return;
		const [removed] = parent.children_options.splice(childIndex, 1);
		config.MENU_ITEMS = [...config.MENU_ITEMS];
		if (removed?.key) {
			config.MENU_ITEMS = config.MENU_ITEMS.map((it: any) =>
				it.key === removed.key ? { ...it, _parentKey: '', _parentLabel: '' } : it
			);
		}
	}

	function openDeleteModal(idx: number) {
		pendingDeleteIndex = idx;
		pendingDeleteKey = config.MENU_ITEMS[idx]?.key || '';
		showDeleteModal = true;
	}

	function cancelDelete() {
		showDeleteModal = false;
		pendingDeleteIndex = -1;
		pendingDeleteKey = '';
	}

	function confirmDelete() {
		if (pendingDeleteIndex >= 0) deleteMenuItem(pendingDeleteIndex);
		showDeleteModal = false;
		pendingDeleteIndex = -1;
		pendingDeleteKey = '';
		success = 'Response deleted';
		setTimeout(() => { success = ''; }, 2500);
	}

	function applyTemplate(templateId: string) {
		const tpl = MENU_TEMPLATES.find(t => t.id === templateId);
		if (!tpl) return;
		config.MENU_ITEMS = tpl.menuItems.map(it => ({
			...it,
			children_options: Array.isArray(it.children_options) ? [...it.children_options] : []
		}));
		if (tpl.botMessages) {
			config.INITIAL_RESPONSE = tpl.botMessages.INITIAL_RESPONSE || config.INITIAL_RESPONSE;
			config.MENU_PROMPT = tpl.botMessages.MENU_PROMPT || config.MENU_PROMPT;
			config.FORM_INTRO_MESSAGE = tpl.botMessages.FORM_INTRO_MESSAGE || config.FORM_INTRO_MESSAGE;
			config.FORM_COMPLETE_MESSAGE = tpl.botMessages.FORM_COMPLETE_MESSAGE || config.FORM_COMPLETE_MESSAGE;
			if (tpl.botMessages.BACK_KEYWORDS?.length) config.BACK_KEYWORDS = [...tpl.botMessages.BACK_KEYWORDS];
			if (tpl.botMessages.HOME_KEYWORDS?.length) config.HOME_KEYWORDS = [...tpl.botMessages.HOME_KEYWORDS];
		}
		showTemplateModal = false;
		templateConfirmId = null;
		success = `Template "${tpl.label}" applied`;
		setTimeout(() => { success = ''; }, 2500);
	}

	function setBackKeyword(v: string) {
		config.BACK_KEYWORDS = v.trim() ? [v.trim()] : [];
	}
	function setHomeKeyword(v: string) {
		config.HOME_KEYWORDS = v.trim() ? [v.trim()] : [];
	}

	let backKeywordSingle = $derived(config.BACK_KEYWORDS?.[0] || '');
	let homeKeywordSingle = $derived(config.HOME_KEYWORDS?.[0] || '');

	let allKeys = $derived((config.MENU_ITEMS || []).map((it: any) => it.key || ''));

	let agentKeywordsInput = $derived(config.AGENT_REQUEST_KEYWORDS?.join(', ') || '');

	function setAgentKeywords(v: string) {
		config.AGENT_REQUEST_KEYWORDS = v.split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
	}

	async function assignBot(botId: any) {
		assigningBot = true;
		error = '';
		success = '';
		try {
			const resp = await botFetch(`/api/assign_agent_bot`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ chatwootInboxId, agentBotId: botId || null, channel: channelType })
			});
			if (!resp.ok) {
				const d = await resp.json().catch(() => ({}));
				throw new Error(d.error || 'Assignment failed');
			}
			assignedAgentBotId = botId || null;
			// Save to PocketBase too
			if (!id) return;
			await pb.collection('inboxes').update(id, { assigned_agent_bot_id: botId || null });
			success = botId ? 'AgentBot assigned' : 'AgentBot unassigned';
		} catch (err: any) {
			error = err?.message;
		} finally {
			assigningBot = false;
		}
	}
</script>

<div class="flex flex-col gap-4">
	{#if loading}
		<p class="opacity-60">Loading...</p>
	{:else}
		<div class="flex flex-wrap items-center justify-between gap-2">
			<div class="flex items-center gap-3 min-w-0">
				<a href="/" class="btn btn-ghost btn-sm">&larr; Back</a>
				<div class="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0">
					<span class="text-primary-content text-lg font-bold">{name ? name[0].toUpperCase() : '?'}</span>
				</div>
				<span class="font-medium text-base-content text-lg truncate max-w-[40vw]">{name || 'Unnamed Inbox'}</span>
				<span class="badge badge-sm badge-outline capitalize">{channelType}</span>
			</div>
			<div class="flex flex-wrap items-center gap-1.5 ml-auto">
				<button class="btn btn-ghost btn-sm" onclick={() => showSettings = true}>
					Settings
				</button>
				<button class="btn btn-ghost btn-sm" onclick={() => showTemplateModal = true}>Templates</button>
				<button class="btn btn-outline btn-sm" onclick={addMenuItem}>+ Add Menu Item</button>
				<button class="btn btn-primary btn-sm" onclick={() => save()} disabled={saving}>
					{#if saving}<span class="loading loading-spinner loading-xs"></span> Saving...{:else}Save{/if}
				</button>
			</div>
		</div>

		{#if showSettings}
			<div class="modal modal-open">
				<div class="modal-box max-w-2xl">
					<div class="flex items-center justify-between mb-3">
						<h3 class="text-lg font-bold">Inbox Settings</h3>
						<button class="btn btn-sm btn-circle btn-ghost" onclick={() => showSettings = false}>✕</button>
					</div>

					<div role="tablist" class="tabs tabs-bordered mb-4">
						<button role="tab" class="tab {settingsTab === 'general' ? 'tab-active' : ''}" onclick={() => settingsTab = 'general'}>General</button>
						<button role="tab" class="tab {settingsTab === 'messages' ? 'tab-active' : ''}" onclick={() => settingsTab = 'messages'}>Messages</button>
						<button role="tab" class="tab {settingsTab === 'crm' ? 'tab-active' : ''}" onclick={() => settingsTab = 'crm'}>Leads & Alerts</button>
						<button role="tab" class="tab {settingsTab === 'followup' ? 'tab-active' : ''}" onclick={() => settingsTab = 'followup'}>Follow-up</button>
					</div>

					{#if settingsTab === 'general'}
						<div class="space-y-4">
							<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
								<label class="form-control">
									<span class="label-text text-xs opacity-70">Name</span>
									<input bind:value={name} placeholder="My Inbox" class="input input-bordered input-sm" />
								</label>
								<label class="form-control">
									<span class="label-text text-xs opacity-70">Chatwoot Inbox ID</span>
									<input value={chatwootInboxId} readonly class="input input-bordered input-sm opacity-60" />
								</label>
								<label class="form-control">
									<span class="label-text text-xs opacity-70">Channel Type</span>
									<select bind:value={channelType} class="select select-sm select-bordered w-full">
										<option value="website">Website</option>
										<option value="whatsapp">WhatsApp</option>
										<option value="telegram">Telegram</option>
									</select>
								</label>
								<div class="form-control gap-1">
									<span class="label-text text-xs opacity-70">Status</span>
									<label class="flex items-center gap-2 pt-1 cursor-pointer">
										<input type="checkbox" bind:checked={active} class="toggle toggle-primary toggle-sm" />
										<span class="text-sm">Active</span>
									</label>
								</div>
							</div>

							<div class="divider my-1"></div>

							<h4 class="font-semibold text-sm">AgentBot Assignment</h4>
							<div class="flex gap-2 items-center">
								<select class="select select-sm select-bordered w-full" value={assignedAgentBotId} onchange={(e) => assignBot(e.currentTarget.value)} disabled={assigningBot}>
									<option value={null}>No AgentBot (manual handling)</option>
									{#each agentBots as bot}
										<option value={bot.id}>{bot.name}{bot.system_bot ? ' (System)' : ''}</option>
									{/each}
								</select>
								{#if assigningBot}<span class="loading loading-spinner loading-sm"></span>{/if}
							</div>
						</div>
					{:else if settingsTab === 'messages'}
						<div class="space-y-4">
							<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
								<div class="form-control gap-1">
									<span class="text-xs opacity-70">Initial response</span>
									<textarea class="textarea textarea-bordered textarea-sm" rows="2" bind:value={config.INITIAL_RESPONSE} placeholder="Optional greeting..."></textarea>
								</div>
								<div class="form-control gap-1">
									<span class="text-xs opacity-70">Menu prompt</span>
									<input class="input input-bordered input-sm" bind:value={config.MENU_PROMPT} placeholder="e.g. Please select an option:" />
								</div>
								<div class="form-control gap-1">
									<span class="text-xs opacity-70">Form intro</span>
									<input class="input input-bordered input-sm" bind:value={config.FORM_INTRO_MESSAGE} placeholder="Please share a few details..." />
								</div>
								<div class="form-control gap-1">
									<span class="text-xs opacity-70">Form complete</span>
									<input class="input input-bordered input-sm" bind:value={config.FORM_COMPLETE_MESSAGE} placeholder="Thanks — we got your details..." />
								</div>
								<div class="form-control gap-1">
									<span class="text-xs opacity-70">Handoff message</span>
									<input class="input input-bordered input-sm" bind:value={config.HANDOFF_MESSAGE} placeholder="Connecting you to an agent..." />
								</div>
								<div class="form-control gap-1">
									<span class="text-xs opacity-70">Attachment ack</span>
									<input class="input input-bordered input-sm" bind:value={config.ATTACHMENT_ACK_MESSAGE} placeholder="Thanks for the attachment..." />
								</div>
								<div class="form-control gap-1">
									<span class="text-xs opacity-70">Back label</span>
									<input class="input input-bordered input-sm" value={backKeywordSingle} oninput={(e) => setBackKeyword(e.currentTarget.value)} placeholder="Back" />
								</div>
								<div class="form-control gap-1">
									<span class="text-xs opacity-70">Home label</span>
									<input class="input input-bordered input-sm" value={homeKeywordSingle} oninput={(e) => setHomeKeyword(e.currentTarget.value)} placeholder="Home" />
								</div>
								<div class="form-control gap-1 md:col-span-2">
									<span class="text-xs opacity-70">Back/Home hint</span>
									<input class="input input-bordered input-sm" bind:value={config.BACK_HOME_HINT} placeholder="Reply 'back' to go back, 'home' for main menu" />
								</div>
								<div class="form-control gap-1 md:col-span-2">
									<span class="text-xs opacity-70">Agent request keywords (comma-sep)</span>
									<input class="input input-bordered input-sm" value={agentKeywordsInput} oninput={(e) => setAgentKeywords(e.currentTarget.value)} placeholder="agent, human" />
								</div>
							</div>
						</div>
					{:else if settingsTab === 'crm'}
						<div class="space-y-4">
							<p class="text-xs opacity-70">Turn form submissions and handoffs into real leads — everything stays inside Chatwoot. No external CRM or service needed.</p>

							<div class="grid grid-cols-1 gap-2.5">
								<label class="flex items-center justify-between gap-3 rounded-lg border border-base-300 bg-base-200/30 px-3 py-2.5 cursor-pointer">
									<div>
										<span class="text-sm font-medium">Enrich contact on form submit</span>
										<p class="text-[11px] opacity-60">Maps form answers onto the contact (email / phone / name + custom attrs) so Chatwoot's contact view, segments & labels use your bot data.</p>
									</div>
									<input type="checkbox" class="toggle toggle-primary toggle-sm" bind:checked={config.enableContactEnrichment} />
								</label>

								<label class="flex items-center justify-between gap-3 rounded-lg border border-base-300 bg-base-200/30 px-3 py-2.5 cursor-pointer">
									<div>
										<span class="text-sm font-medium">Tag conversations by intent</span>
										<p class="text-[11px] opacity-60">Auto-labels the conversation with the menu path (e.g. "Support", "Refund") — agents instantly see what the user was doing.</p>
									</div>
									<input type="checkbox" class="toggle toggle-primary toggle-sm" bind:checked={config.enableIntentLabels} />
								</label>

								<label class="flex items-center justify-between gap-3 rounded-lg border border-base-300 bg-base-200/30 px-3 py-2.5 cursor-pointer">
									<div>
										<span class="text-sm font-medium">Handoff context for agents</span>
										<p class="text-[11px] opacity-60">When the user asks for an agent, the bot drops a private note with the intent path + all collected form answers into the conversation.</p>
									</div>
									<input type="checkbox" class="toggle toggle-primary toggle-sm" bind:checked={config.enableHandoffContext} />
								</label>
							</div>

							<div class="divider my-1"></div>

							<div class="divider my-1"></div>

							<h4 class="font-semibold text-sm">Instant lead alerts</h4>
							<label class="flex items-center justify-between gap-3 rounded-lg border border-base-300 bg-base-200/30 px-3 py-2.5 cursor-pointer">
								<div>
									<span class="text-sm font-medium">Notify agents on new leads</span>
									<p class="text-[11px] opacity-60">Every completed form posts a private alert note into the conversation and mentions the team below — agents get notified in Chatwoot. No external service.</p>
								</div>
								<input type="checkbox" class="toggle toggle-primary toggle-sm" bind:checked={config.enableLeadAlerts} />
							</label>
							<div class="form-control gap-1">
								<span class="text-xs opacity-70">Mention team (optional)</span>
								<input class="input input-bordered input-sm" bind:value={config.leadAlertTeam} placeholder="e.g. Support" />
								<p class="text-[11px] opacity-60">Exact Chatwoot team name — agents in that team get the notification. Leave empty for no mention.</p>
							</div>
							<div class="form-control gap-1">
								<span class="text-xs opacity-70">Alert message (optional)</span>
								<input class="input input-bordered input-sm" bind:value={config.leadAlertMessage} placeholder="New lead submitted — check the conversation" />
							</div>

							<div class="divider my-1"></div>

							<h4 class="font-semibold text-sm">Legacy CRM webhook (optional)</h4>
							<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
								<div class="form-control gap-1">
									<span class="text-xs opacity-70">CRM Webhook URL</span>
									<input class="input input-bordered input-sm" bind:value={config.crmWebhookUrl} placeholder="https://script.google.com/..." />
								</div>
								<div class="form-control gap-1">
									<span class="text-xs opacity-70">CRM Secret</span>
									{#if hasWebhookSecret && !editingSecret}
										<div class="flex gap-2">
											<input class="input input-bordered input-sm flex-1" type="password" disabled value="••••••••••" />
											<button class="btn btn-outline btn-sm" type="button" onclick={() => { newWebhookSecret = ''; editingSecret = true; }}>Change</button>
											<button class="btn btn-outline btn-sm" type="button" onclick={() => { config.crmWebhookSecret = ''; hasWebhookSecret = false; editingSecret = false; newWebhookSecret = ''; }}>Remove</button>
										</div>
										<p class="text-[11px] opacity-60">Stored encrypted at rest — write-only, cannot be viewed. Change to replace it, Remove to delete it.</p>
									{:else}
										<input class="input input-bordered input-sm" type="password" bind:value={newWebhookSecret} placeholder="Shared secret (leave empty to remove)" />
									{/if}
								</div>
							</div>
							<p class="text-[11px] opacity-60">Still forwarded on form submit if set — Chatwoot's own webhooks usually cover this; keep it only if you really need it.</p>
						</div>
										{:else if settingsTab === 'followup'}
						<div class="space-y-4">
							<p class="text-xs opacity-70">Send an automated reminder if the user doesn't respond.</p>
							<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
								<div class="form-control gap-1">
									<span class="text-xs opacity-70">Delay (seconds)</span>
									<input class="input input-bordered input-sm" type="number" bind:value={config.FOLLOW_UP_DELAY_SECONDS} placeholder="120" />
								</div>
								<div class="form-control gap-1">
									<span class="text-xs opacity-70">Max reminders</span>
									<input class="input input-bordered input-sm" type="number" bind:value={config.FOLLOW_UP_MAX_REMINDERS} placeholder="1" />
								</div>
							</div>
							<div class="form-control gap-1">
								<span class="text-xs opacity-70">Follow-up message (leave empty to disable)</span>
								<input class="input input-bordered input-sm" bind:value={config.FOLLOW_UP_MESSAGE} placeholder="Are you still there? How can I help?" />
							</div>
						</div>
					{/if}

					<div class="modal-action mt-4">
						<button class="btn btn-sm" onclick={() => showSettings = false}>Done</button>
					</div>
				</div>
				<div class="modal-backdrop" role="button" tabindex="-1" onclick={() => showSettings = false} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showSettings = false; } }}></div>
			</div>
		{/if}

		{#if error}<div class="toast toast-top toast-center z-[200]"><div class="alert alert-error text-sm py-2 px-4 shadow-lg">{error}</div></div>{/if}
		{#if success}<div class="toast toast-top toast-center z-[200]"><div class="alert alert-success text-sm py-2 px-4 shadow-lg">{success}</div></div>{/if}

		<!-- Main Content: Editor + Preview (flow mode gives the canvas more room) -->
		<div class="grid grid-cols-1 {viewMode === 'flow' ? 'lg:grid-cols-[5fr_2fr]' : 'lg:grid-cols-2'} gap-4">
			<!-- Left: Menu Items -->
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body gap-4">
					<div class="flex items-center justify-between gap-2">
						<h3 class="m-0 text-lg font-semibold text-base-content">Menu Items</h3>
						<div class="flex items-center gap-2">
							<div class="join">
								<button type="button" class="btn btn-xs join-item {viewMode === 'list' ? 'btn-active' : ''}" onclick={() => viewMode = 'list'}>List</button>
								<button type="button" class="btn btn-xs join-item {viewMode === 'flow' ? 'btn-active' : ''}" onclick={() => viewMode = 'flow'}>Flow</button>
							</div>
							<span class="badge badge-neutral">{orderedIndexes.filter((i: number) => getDepth(i) === 0).length} root item{orderedIndexes.filter((i: number) => getDepth(i) === 0).length === 1 ? '' : 's'}</span>
						</div>
					</div>

					{#if viewMode === 'flow'}
						<FlowView
							menuItems={config.MENU_ITEMS}
							onEdit={flowEdit}
							onAdd={addMenuItem}
							onDelete={flowDelete}
							onConnect={flowConnect}
							onOrder={flowOrder}
							onAddChild={flowAddChild}
							onUnlink={flowUnlink}
						/>
					{:else}

					<div class="flex flex-col gap-1.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
						{#each orderedIndexes as realIndex (realIndex)}
							{@const item = config.MENU_ITEMS[realIndex]}
							{@const depth = getDepth(realIndex)}
							{@const isChild = depth > 0}
							<div class={isChild ? 'border-l-2 border-base-300' : ''} style={isChild ? `margin-left: ${Math.min(depth * 10, 20)}px; padding-left: 8px;` : ''}>
								<div class="border {isChild ? 'border-base-200' : 'border-base-300'} rounded-lg hover:border-primary/50 transition-colors">
									<div class="p-3 {isChild ? 'bg-base-200/20' : 'bg-base-200/40'} flex flex-wrap items-center gap-x-3 gap-y-2">
										<div class="flex-1 min-w-0">
											<div class="flex flex-wrap items-center gap-2">
												<span class={isChild ? 'text-sm' : 'font-medium'}>{item.key || '(untitled)'}</span>
												<span class="badge badge-sm badge-outline">{getResponseTypeLabel(item)}</span>
												{#if isSubmenu(item)}
													<span class="badge badge-sm badge-info badge-outline">{item.children_options?.length || 0} sub-items</span>
												{/if}
											</div>
											<p class="text-xs opacity-60 mt-1 truncate">{summarizeResponse(item)}</p>
										</div>
										<div class="relative shrink-0 ml-auto">
											<button type="button" class="btn btn-ghost btn-xs" onclick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); rowMenuPos = { top: Math.min(r.bottom + 4, window.innerHeight - 300), left: Math.min(Math.max(r.right - 224, 8), window.innerWidth - 232) }; rowMenu = rowMenu === item.key ? null : item.key; }} title="Actions" aria-label="Actions">⋯</button>
											{#if rowMenu === item.key}
												<div class="fixed inset-0 z-[90]" role="button" tabindex="-1" onclick={() => rowMenu = null} onkeydown={() => {}}></div>
												<div class="fixed z-[100] w-56 bg-base-100 border border-base-300 rounded-box shadow-xl p-2" style="top:{rowMenuPos?.top ?? 0}px; left:{rowMenuPos?.left ?? 0}px;" role="button" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
													<div class="text-[11px] opacity-60 px-1 mb-1">Move under</div>
													<select class="select select-xs select-bordered w-full mb-1.5" value={effectiveParentKey(item)} onchange={(e) => { listSetParent(item.key, e.currentTarget.value); rowMenu = null; }} title="Move under another item">
														<option value="">Top level</option>
														{#each parentOptionsFor(item.key) as ok (ok)}
															{#if ok}<option value={ok}>{ok}</option>{/if}
														{/each}
													</select>
													<ul class="menu menu-xs w-full p-0 rounded-box">
														<li><button type="button" onclick={() => { listMove(item.key, -1); rowMenu = null; }}>↑ Move up</button></li>
														<li><button type="button" onclick={() => { listMove(item.key, 1); rowMenu = null; }}>↓ Move down</button></li>
														{#if isChild}
															<li><button type="button" class="text-amber-500" onclick={() => { flowUnlink(item.key); rowMenu = null; }}>⤓ Unlink (top level)</button></li>
														{/if}
														<li><div class="divider my-0.5"></div></li>
														<li><button type="button" onclick={() => { rowMenu = null; openModal(realIndex); }}>✎ Edit</button></li>
														<li><button type="button" class="text-error" onclick={() => { rowMenu = null; openDeleteModal(realIndex); }}>✕ Delete</button></li>
													</ul>
												</div>
											{/if}
										</div>
									</div>
								</div>
							</div>
						{/each}
						{#if orderedIndexes.length === 0}
							<div class="text-center py-8 opacity-60">
								<svg class="mx-auto mb-3" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
								<p class="text-sm">No menu items yet.</p>
								<button type="button" class="btn btn-primary btn-sm mt-3" onclick={addMenuItem}>+ Add your first item</button>
							</div>
						{/if}
					</div>
					{/if}
				</div>
			</div>

			<!-- Right: Chat Preview -->
			<div class="card bg-base-100 border border-base-300 overflow-hidden">
				<div class="h-[calc(100vh-280px)] min-h-[400px]">
					<ChatPreview
						initialResponse={config.INITIAL_RESPONSE}
						menuPrompt={config.MENU_PROMPT}
						menuItems={config.MENU_ITEMS}
						backLabel={backKeywordSingle || 'Back'}
						homeLabel={homeKeywordSingle || 'Home'}
						formIntroMessage={config.FORM_INTRO_MESSAGE}
						formCompleteMessage={config.FORM_COMPLETE_MESSAGE}
						channelType={channelType}
					/>
				</div>
			</div>
		</div>
	{/if}
</div>

{#if showDeleteModal}
	<div class="modal modal-open" role="dialog" aria-modal="true">
		<div class="modal-box">
			<h3 class="font-bold text-lg">Delete menu item</h3>
			<p class="py-2">Are you sure you want to delete "{pendingDeleteKey}"? This action cannot be undone.</p>
			<div class="modal-action">
				<button class="btn btn-ghost" onclick={cancelDelete}>Cancel</button>
				<button class="btn btn-error" onclick={confirmDelete}>Delete</button>
			</div>
		</div>
		<button class="modal-backdrop" aria-label="Close" onclick={cancelDelete}></button>
	</div>
{/if}

{#if showTemplateModal}
	<div class="modal modal-open" role="dialog" aria-modal="true">
		<div class="modal-box max-w-2xl">
			<div class="flex items-start justify-between gap-4">
				<div>
					<h3 class="font-bold text-lg">Load a Template</h3>
					<p class="text-sm text-base-content/70">
						{#if config.MENU_ITEMS?.length > 0}
							This will <strong>replace</strong> your current menu items and bot messages.
						{:else}
							Start your menu from an industry-standard template.
						{/if}
					</p>
				</div>
				<button class="btn btn-ghost btn-sm" onclick={() => { showTemplateModal = false; templateConfirmId = null; }}>✕</button>
			</div>

			{#if templateConfirmId}
				{@const confirmTpl = MENU_TEMPLATES.find(t => t.id === templateConfirmId)}
				<div class="alert alert-warning mt-4">
					<span>Replace current menu with <strong>{confirmTpl?.label}</strong> template? This cannot be undone.</span>
				</div>
				<div class="flex justify-end gap-2 mt-2">
					<button class="btn btn-ghost btn-sm" onclick={() => templateConfirmId = null}>Cancel</button>
					<button class="btn btn-warning btn-sm" onclick={() => { if (templateConfirmId) applyTemplate(templateConfirmId); }}>Yes, Replace</button>
				</div>
			{:else}
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
					{#each MENU_TEMPLATES as tpl (tpl.id)}
						<button
							class="text-left p-4 rounded-xl border border-base-300 hover:border-primary hover:bg-base-200/50 transition-colors flex gap-3 items-start"
							onclick={() => {
								if (config.MENU_ITEMS?.length > 0) {
									templateConfirmId = tpl.id;
								} else {
									applyTemplate(tpl.id);
								}
							}}
						>
							<div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-xl">
								{tpl.icon}
							</div>
							<div class="min-w-0 flex-1">
								<div class="font-semibold text-sm">{tpl.label}</div>
								<div class="text-xs text-base-content/60 mt-0.5">{tpl.description}</div>
								<div class="text-xs text-base-content/40 mt-1">{tpl.menuItems.length} items</div>
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</div>
		<button class="modal-backdrop" aria-label="Close" onclick={() => { showTemplateModal = false; templateConfirmId = null; }}></button>
	</div>
{/if}

{#if modalIndex !== null && config.MENU_ITEMS[modalIndex]}
	<MenuItemModal
		item={config.MENU_ITEMS[modalIndex]}
		index={modalIndex}
		allKeys={allKeys}
		onClose={closeModal}
		onSave={saveMenuItem}
		onDelete={(idx: number) => { deleteMenuItem(idx); showDeleteModal = false; }}
		onCreateChild={createChild}
		onOpenChild={openChild}
		onMoveChild={moveChild}
		onUnlinkChild={unlinkChild}
	/>
{/if}
