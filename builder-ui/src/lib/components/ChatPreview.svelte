<script lang="ts">
	import { tick } from 'svelte';

	let {
		initialResponse = '',
		menuPrompt = '',
		menuItems = [] as any[],
		backLabel = 'Back',
		homeLabel = 'Home',
		formIntroMessage = '',
		formCompleteMessage = '',
		channelType = 'website'
	} = $props();

	const botIcon = '🤖';

	let isFormSequential = $derived(channelType !== 'website');

	let itemByKey = $derived(new Map((menuItems || []).map((it) => [it.key, it])));
	let childKeys = $derived((() => {
		const set = new Set<string>();
		for (const it of menuItems || []) {
			const children = Array.isArray(it.children_options) ? it.children_options : [];
			for (const ch of children) { if (ch?.key) set.add(ch.key.trim()); }
		}
		for (const it of menuItems || []) {
			const pk = it._parentKey?.trim();
			if (pk && itemByKey.has(pk)) set.add(it.key);
		}
		return set;
	})());
	let rootItems = $derived((menuItems || []).filter((it) => !childKeys.has(it.key)));

	let messages = $state<any[]>([]);
	let navigationStack = $state<string[]>([]);
	let currentItemKey = $state<string | null>(null);
	let formSubmitted = $state(false);
	let seqFormIndex = $state(0);
	let seqFormAnswers = $state<any[]>([]);
	let chatContainer = $state<HTMLElement | null>(null);

	function isSubmenu(item: any) {
		return item && typeof item.response === 'object' && item.response?.content_type === 'submenu';
	}

	function getResponseTypeLabel(item: any) {
		const resp = item?.response;
		if (typeof resp === 'string') return 'text';
		const type = resp?.content_type;
		return type ? type.replace(/_/g, ' ') : 'text';
	}

	function getDisplayItems(item: any) {
		if (!item) return rootItems;
		if (isSubmenu(item)) return (item.children_options || []).map((ch: any) => itemByKey.get(ch.key)).filter(Boolean);
		return [];
	}

	function pushMessage(msg: any) { messages = [...messages, msg]; }

	function renderMenu(items: any[], opts: { showBack?: boolean; showHome?: boolean } = {}) {
		const { showBack = false, showHome = false } = opts;
		if (menuPrompt && items.length > 0) pushMessage({ type: 'bot-text', text: menuPrompt });
		const buttons: { label: string; index?: number; icon?: string; isNav?: boolean; action: () => void }[] =
			items.map((item, i) => ({ label: item.key, index: i + 1, action: () => selectOption(item) }));
		if (showBack) buttons.push({ label: backLabel || 'Back', icon: '←', action: goBack, isNav: true });
		if (showHome) buttons.push({ label: homeLabel || 'Home', icon: '⌂', action: goHome, isNav: true });
		if (buttons.length > 0) pushMessage({ type: 'bot-buttons', buttons });
	}

	function selectOption(item: any) {
		if (!item) return;
		pushMessage({ type: 'user', text: item.key });
		if (currentItemKey) navigationStack = [...navigationStack, currentItemKey];
		currentItemKey = item.key;
		formSubmitted = false;
		seqFormIndex = 0;
		seqFormAnswers = [];
		const current = itemByKey.get(item.key);
		if (isSubmenu(current)) {
			renderMenu(getDisplayItems(current), { showBack: true, showHome: true });
		} else {
			renderResponse(current);
		}
	}

	function renderResponse(item: any) {
		if (!item) return;
		const resp = item.response;
		if (typeof resp === 'string') { pushMessage({ type: 'bot-text', text: resp }); return; }
		const ct = resp?.content_type;
		if (ct === 'article') {
			pushMessage({ type: 'bot-article', items: resp.content_attributes?.items || [] });
		} else if (ct === 'input_select') {
			pushMessage({ type: 'bot-text', text: resp.content || 'Select an option:' });
			pushMessage({ type: 'bot-input-select', items: resp.content_attributes?.items || [] });
		} else if (ct === 'form' || ct === 'sequential_form') {
			if (isFormSequential || ct === 'sequential_form') {
				pushMessage({ type: 'bot-text', text: formIntroMessage || 'Please share a few details:' });
				renderSeqFormQuestion(resp);
			} else {
				pushMessage({ type: 'bot-text', text: formIntroMessage || 'Please fill out this form:' });
				pushMessage({ type: 'bot-form-card', fields: resp.content_attributes?.items || [] });
			}
		} else if (ct === 'cards') {
			pushMessage({ type: 'bot-cards', items: resp.content_attributes?.items || [] });
		} else {
			pushMessage({ type: 'bot-text', text: `[${getResponseTypeLabel(item)} response]`, italic: true });
		}
	}

	function renderSeqFormQuestion(resp: any) {
		const fields = resp?.content_attributes?.items || [];
		const field = fields[seqFormIndex];
		if (!field) return;
		const label = field.label || field.name || 'Field';
		const type = (field.type || 'text').toLowerCase();
		let text = type === 'select'
			? label + ':\n' + (Array.isArray(field.options) ? field.options : []).map((o: any, i: number) => `${i + 1}. ${o.label || o.value}`).join('\n')
			: `${label}:`;
		pushMessage({ type: 'bot-text', text, mono: true });
		pushMessage({ type: 'bot-seq-answer', field, index: seqFormIndex });
	}

	function answerSeqQuestion(answer: string) {
		const current = itemByKey.get(currentItemKey!);
		const resp = current?.response;
		const fields = resp?.content_attributes?.items || [];
		const field = fields[seqFormIndex];
		if (!field) return;
		seqFormAnswers = [...seqFormAnswers, { label: field.label || field.name, value: answer }];
		pushMessage({ type: 'user', text: answer });
		if (seqFormIndex + 1 >= fields.length) {
			formSubmitted = true;
			pushMessage({ type: 'bot-text', text: formCompleteMessage || 'Thank you! Your response has been recorded.' });
		} else { seqFormIndex++; renderSeqFormQuestion(resp); }
	}

	function submitCardForm() {
		formSubmitted = true;
		pushMessage({ type: 'user', text: '(Form submitted)' });
		pushMessage({ type: 'bot-text', text: formCompleteMessage || 'Thank you! Your response has been recorded.' });
	}

	function goBack() {
		pushMessage({ type: 'user', text: backLabel || 'Back' });
		if (navigationStack.length === 0) { goHome(true); return; }
		currentItemKey = navigationStack.pop()!;
		navigationStack = [...navigationStack];
		const current = itemByKey.get(currentItemKey);
		if (isSubmenu(current)) {
			renderMenu(getDisplayItems(current), { showBack: navigationStack.length > 0, showHome: true });
		} else { renderResponse(current); }
	}

	function goHome(skipUserMsg = false) {
		if (!skipUserMsg) pushMessage({ type: 'user', text: homeLabel || 'Home' });
		currentItemKey = null; navigationStack = []; formSubmitted = false;
		renderMenu(rootItems, { showBack: false, showHome: false });
	}

	function resetPreview() {
		messages = []; navigationStack = []; currentItemKey = null;
		formSubmitted = false; seqFormIndex = 0; seqFormAnswers = [];
		initChat();
	}

	function initChat() {
		if (initialResponse) pushMessage({ type: 'bot-text', text: initialResponse });
		renderMenu(rootItems, { showBack: false, showHome: false });
	}

	$effect(() => {
		messages;
		if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
	});

	let lastMenuItemsKey = '';
	$effect(() => {
		if (menuItems && JSON.stringify(menuItems.map((it: any) => it.key)) !== lastMenuItemsKey) {
			lastMenuItemsKey = JSON.stringify(menuItems.map((it: any) => it.key));
			resetPreview();
		}
	});
</script>

<div class="flex flex-col h-full">
	<div class="flex items-center justify-between p-3 border-b border-base-300 bg-base-200/50">
		<div class="flex items-center gap-2">
			<div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
				<span class="text-primary-content text-sm">{botIcon}</span>
			</div>
			<span class="font-semibold text-sm text-base-content">Chat Preview</span>
		</div>
		<button class="btn btn-ghost btn-xs" onclick={resetPreview} title="Reset preview">↻</button>
	</div>

	<div class="flex-1 overflow-y-auto p-4 space-y-3 bg-base-100" bind:this={chatContainer}>
		{#each messages as msg, i (i)}
			{#if msg.type === 'bot-text'}
				<div class="chat chat-start">
					<div class="chat-image">
						<div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
							<span class="text-primary-content text-xs">{botIcon}</span>
						</div>
					</div>
					<div class="chat-bubble chat-bubble-primary {msg.mono ? 'whitespace-pre-wrap font-mono' : ''} {msg.italic ? 'opacity-60 italic' : ''}">{msg.text}</div>
				</div>
			{:else if msg.type === 'bot-buttons'}
				<div class="chat chat-start">
					<div class="chat-image">
						<div class="w-8"></div>
					</div>
					<div class="flex flex-col gap-2">
						{#each msg.buttons as btn, bi (bi)}
							<button
								class="btn btn-sm {btn.isNav ? 'btn-ghost' : 'btn-outline'} justify-start text-left normal-case"
								onclick={btn.action}
							>
								{#if btn.icon}
									<span class="text-xs mr-1">{btn.icon}</span>
								{:else}
									<span class="badge badge-sm badge-primary mr-2">{btn.index}</span>
								{/if}
								{btn.label}
							</button>
						{/each}
					</div>
				</div>
			{:else if msg.type === 'user'}
				<div class="chat chat-end">
					<div class="chat-image">
						<div class="w-8 h-8 rounded-full bg-neutral flex items-center justify-center">
							<span class="text-neutral-content text-xs">👤</span>
						</div>
					</div>
					<div class="chat-bubble chat-bubble-neutral">{msg.text}</div>
				</div>
			{:else if msg.type === 'bot-article'}
				<div class="chat chat-start">
					<div class="chat-image">
						<div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
							<span class="text-primary-content text-xs">{botIcon}</span>
						</div>
					</div>
					<div class="chat-bubble chat-bubble-primary p-0 overflow-hidden">
						<div class="p-3 pb-2">Here are some helpful articles:</div>
						<div class="flex flex-col">
							{#each msg.items as art, ai (ai)}
								<a href={art.link || '#'} target="_blank" rel="noopener"
									class="block p-3 border-t border-primary-content/20 hover:bg-primary-content/10 transition-colors">
									<div class="font-semibold text-sm">{art.title || 'Untitled'}</div>
									<div class="text-xs opacity-80 mt-1">{art.description || ''}</div>
								</a>
							{/each}
						</div>
					</div>
				</div>
			{:else if msg.type === 'bot-input-select'}
				<div class="chat chat-start">
					<div class="chat-image">
						<div class="w-8"></div>
					</div>
					<div class="flex flex-wrap gap-2">
						{#each msg.items as opt, oi (oi)}
							<button class="btn btn-sm btn-outline">{opt.title || opt.value}</button>
						{/each}
					</div>
				</div>
			{:else if msg.type === 'bot-seq-answer'}
				<div class="chat chat-end">
					<div class="chat-image">
						<div class="w-8"></div>
					</div>
					<button
						class="btn btn-sm btn-outline btn-neutral"
						onclick={() => answerSeqQuestion(msg.field.type === 'select' ? '1' : 'Sample answer')}
					>
						↩ Simulate answer
					</button>
				</div>
			{:else if msg.type === 'bot-form-card'}
				<div class="chat chat-start">
					<div class="chat-image">
						<div class="w-8"></div>
					</div>
					<div class="card bg-base-200 border border-base-300 w-full max-w-xs">
						<div class="card-body gap-3 p-4">
							{#each msg.fields as field, fi (fi)}
								<div class="form-control gap-1">
									<label class="label py-0" for="cp-field-{fi}">
										<span class="label-text text-xs">{field.label || field.name}</span>
									</label>
									{#if field.type === 'text_area'}
										<textarea id="cp-field-{fi}" class="textarea textarea-bordered textarea-sm" placeholder={field.placeholder || ''} rows="2"></textarea>
									{:else if field.type === 'select'}
										<select id="cp-field-{fi}" class="select select-bordered select-sm">
											<option disabled selected>{field.placeholder || 'Select...'}</option>
											{#each field.options || [] as opt, oi (oi)}
												<option value={opt.value}>{opt.label}</option>
											{/each}
										</select>
									{:else}
										<input id="cp-field-{fi}" type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : 'text'}
											class="input input-bordered input-sm" placeholder={field.placeholder || ''} />
									{/if}
								</div>
							{/each}
							<button class="btn btn-primary btn-sm w-full mt-3" onclick={submitCardForm}>Submit</button>
						</div>
					</div>
				</div>
			{:else if msg.type === 'bot-cards'}
				<div class="chat chat-start">
					<div class="chat-image">
						<div class="w-8"></div>
					</div>
					<div class="flex flex-col gap-2 w-full max-w-xs">
						{#each msg.items as card, ci (ci)}
							<div class="card bg-base-200 border border-base-300 overflow-hidden">
								{#if card.media_url}
									<figure class="h-24 bg-base-300">
										<img src={card.media_url} alt={card.title || 'Card image'} class="w-full h-full object-cover" />
									</figure>
								{/if}
								<div class="card-body p-3 gap-2">
									<h3 class="card-title text-sm">{card.title || 'Card'}</h3>
									{#if card.description}
										<p class="text-xs opacity-80">{card.description}</p>
									{/if}
									{#if card.actions?.length > 0}
										<div class="card-actions justify-start mt-1">
											{#each card.actions as action (action.text)}
												{#if action.type === 'link'}
													<a href={action.uri || '#'} target="_blank" rel="noopener" class="btn btn-xs btn-outline">{action.text}</a>
												{:else}
													<button class="btn btn-xs btn-outline">{action.text}</button>
												{/if}
											{/each}
										</div>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		{/each}

		{#if messages.length === 0}
			<div class="text-center text-sm opacity-60 py-4">
				No menu options configured yet.<br />
				Add responses to see them here.
			</div>
		{/if}
	</div>

	<div class="flex items-center justify-between p-2 border-t border-base-300 bg-base-200/50">
		<span class="text-xs opacity-60">
			{#if currentItemKey}
				{#if navigationStack.length > 0}Nested menu{:else}Viewing: {currentItemKey}{/if}
			{:else}
				Main menu
			{/if}
		</span>
		<button class="btn btn-ghost btn-xs" onclick={resetPreview} title="Reset preview">↻ Reset</button>
	</div>
</div>
