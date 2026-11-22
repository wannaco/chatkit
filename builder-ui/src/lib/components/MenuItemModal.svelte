<script lang="ts">
	let {
		item,
		index,
		onClose,
		onSave,
		onDelete,
		onCreateChild,
		onOpenChild,
		onMoveChild,
		onUnlinkChild,
		allKeys = [] as string[]
	} = $props();

	let draftKey = $state('');
	let modalType = $state('Text');
	let modalError = $state('');

	$effect(() => {
		draftKey = item.key || '';
		modalType = getResponseTypeValue(item);
		modalError = '';
	});

	function normalizeKey(s: string) {
		return (s || '').replace(/\s+/g, ' ').trim();
	}

	function isDuplicateKey(key: string, skipIndex: number) {
		const norm = normalizeKey(key);
		return allKeys.some((k, i) => i !== skipIndex && normalizeKey(k) === norm);
	}

	function getResponseTypeValue(it: any): string {
		const resp = it?.response;
		if (typeof resp === 'string') return 'Text';
		const type = resp?.content_type;
		if (!type) return 'Text';
		return type;
	}

	function getResponseTypeLabel(it: any): string {
		const value = getResponseTypeValue(it);
		switch (value) {
			case 'Text': return 'Text';
			case 'article': return 'Article';
			case 'input_select': return 'Input Select';
			case 'form': return 'Form';
			case 'sequential_form': return 'Sequential Form';
			case 'cards': return 'Cards';
			case 'submenu': return 'Submenu';
			default: return value ? value.replace(/_/g, ' ') : 'Unknown';
		}
	}

	function isSubmenu(it: any) {
		return it && typeof it.response === 'object' && it.response?.content_type === 'submenu';
	}

	function summarizeResponse(it: any): string {
		const resp = it?.response;
		if (typeof resp === 'string') {
			const trimmed = resp.trim();
			if (!trimmed) return 'No message yet';
			return trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed;
		}
		const type = resp?.content_type;
		const items = resp?.content_attributes?.items;
		switch (type) {
			case 'article': return `${items?.length || 0} article item(s)`;
			case 'input_select': return `${items?.length || 0} selectable option(s)`;
			case 'form':
			case 'sequential_form': return `${items?.length || 0} form field(s)`;
			case 'cards': return `${items?.length || 0} card(s)`;
			case 'submenu': return `${it?.children_options?.length || 0} child item(s)`;
			default: return 'Click Edit to configure';
		}
	}

	function slugify(s: string) {
		const out = String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
		return out || 'field';
	}

	function changeResponseType(type: string) {
		const current = item.response;
		let updated = { ...item };

		if (type !== 'submenu' && isSubmenu(item)) {
			updated.children_options = [];
		}

		if (type === 'submenu') {
			updated.response = { content_type: 'submenu' };
			updated.children_options = Array.isArray(updated.children_options) ? [...updated.children_options] : [];
			onSave(index, updated);
			modalType = 'submenu';
			return;
		}

		if (type === 'Text') {
			updated.response = typeof current === 'string' ? current : 'Your response text here';
		} else if (type === 'article') {
			updated.response = (typeof current === 'object' && current?.content_type === 'article') ? current : {
				content: 'articles', content_type: 'article',
				content_attributes: { items: [{ title: 'Article Title', description: 'Article description', link: 'https://example.com' }] }
			};
		} else if (type === 'input_select') {
			updated.response = (typeof current === 'object' && current?.content_type === 'input_select') ? current : {
				content: 'Select an option:', content_type: 'input_select',
				content_attributes: { items: [{ title: 'Option 1', value: 'Option 1' }] }
			};
		} else if (type === 'cards') {
			updated.response = (typeof current === 'object' && current?.content_type === 'cards') ? current : {
				content: 'card message', content_type: 'cards',
				content_attributes: { items: [{
					media_url: 'https://example.com/image.jpg', title: 'Card Title', description: 'Card description',
					actions: [{ type: 'link', text: 'View Details', uri: 'https://example.com' }, { type: 'postback', text: 'Card Title', payload: 'Card Title' }]
				}] }
			};
		} else if (type === 'form') {
			updated.response = (typeof current === 'object' && current?.content_type === 'form') ? current : {
				content: 'form', content_type: 'form',
				content_attributes: { items: [{ name: 'field_1', label: 'Field 1', type: 'text', placeholder: 'Enter value', default: '' }] }
			};
		} else if (type === 'sequential_form') {
			updated.response = (typeof current === 'object' && current?.content_type === 'sequential_form') ? current : {
				content: 'form', content_type: 'sequential_form',
				content_attributes: { items: [{ name: 'email', label: 'Email', type: 'email', placeholder: 'name@example.com', default: '' }] }
			};
		}

		onSave(index, updated);
		modalType = type;
	}

	function updateKey() {
		const norm = normalizeKey(draftKey);
		if (!norm) { modalError = 'Menu title cannot be empty.'; return; }
		if (isDuplicateKey(norm, index)) { modalError = 'A response with that title already exists.'; return; }
		modalError = '';
		onSave(index, { ...item, key: norm });
	}

	function updateResponse(value: string) {
		onSave(index, { ...item, response: value });
	}

	function addListItem() {
		const resp = item.response;
		if (!resp || typeof resp !== 'object') return;
		let newItem: any = null;
		if (resp.content_type === 'article') {
			newItem = { title: 'New Article', description: 'Article description', link: 'https://example.com' };
		} else if (resp.content_type === 'input_select') {
			newItem = { title: 'New Option', value: 'New Option' };
		} else if (resp.content_type === 'cards') {
			newItem = { media_url: 'https://example.com/image.jpg', title: 'New Card', description: 'Card description', actions: [{ type: 'postback', text: 'New Card', payload: 'New Card' }] };
		} else if (resp.content_type === 'form' || resp.content_type === 'sequential_form') {
			const fields = resp?.content_attributes?.items || [];
			newItem = { name: `field_${fields.length + 1}`, label: `Field ${fields.length + 1}`, type: 'text', placeholder: 'Enter value', default: '', options: [] };
		}
		if (!newItem) return;
		const items = [...(resp?.content_attributes?.items || []), newItem];
		const updated = { ...resp, content_attributes: { ...resp.content_attributes, items } };
		onSave(index, { ...item, response: updated });
	}

	function removeListItem(itemIndex: number) {
		const resp = item.response;
		if (!resp || typeof resp !== 'object') return;
		const items = (resp?.content_attributes?.items || []).filter((_: any, i: number) => i !== itemIndex);
		const updated = { ...resp, content_attributes: { ...resp.content_attributes, items } };
		onSave(index, { ...item, response: updated });
	}

	function addCardAction(cardIndex: number) {
		const resp = item.response;
		const items = resp?.content_attributes?.items || [];
		const card = items[cardIndex];
		if (!card) return;
		if (!Array.isArray(card.actions)) card.actions = [];
		card.actions.push({ type: 'link', text: 'View Details', uri: 'https://example.com' });
		onSave(index, { ...item });
	}

	function removeCardAction(cardIndex: number, actionIndex: number) {
		const resp = item.response;
		const items = resp?.content_attributes?.items || [];
		const card = items[cardIndex];
		if (!card || !Array.isArray(card.actions)) return;
		card.actions.splice(actionIndex, 1);
		onSave(index, { ...item });
	}

	function addFormSelectOption(fieldIndex: number) {
		const resp = item.response;
		const field = resp?.content_attributes?.items?.[fieldIndex];
		if (!field) return;
		if (!field.options) field.options = [];
		field.options.push({ label: 'New Option', value: 'New Option' });
		onSave(index, { ...item });
	}

	function removeFormSelectOption(fieldIndex: number, optIndex: number) {
		const resp = item.response;
		const field = resp?.content_attributes?.items?.[fieldIndex];
		if (!field?.options) return;
		field.options.splice(optIndex, 1);
		onSave(index, { ...item });
	}

	function handleDone() {
		updateKey();
		if (!modalError) onClose();
	}
</script>

<div class="modal modal-open" role="dialog" aria-modal="true">
	<div class="modal-box max-w-5xl" role="button" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
		<div class="flex items-start justify-between gap-4">
			<div>
				<h3 class="font-bold text-lg">Edit menu item</h3>
				<p class="text-sm opacity-70">Configure what happens when this option is selected.</p>
			</div>
			<button class="btn btn-ghost btn-sm" onclick={onClose}>✕ Close</button>
		</div>

		<div class="form-control mt-4 gap-1">
			<label class="label py-0" for="modalKey">
				<span class="label-text text-xs opacity-70">Option label</span>
				<span class="label-text-alt text-[10px] opacity-50">Shown to the user</span>
			</label>
			<input id="modalKey" class="input input-sm input-bordered w-full" bind:value={draftKey} placeholder="e.g. Pricing" onblur={updateKey} />
			{#if modalError}<span class="text-sm text-error mt-1">{modalError}</span>{/if}
		</div>

		<div class="form-control mt-4 gap-1">
			<label class="label py-0" for="modalType"><span class="label-text text-xs opacity-70">When selected, show:</span></label>
			<select id="modalType" class="select select-sm select-bordered w-full" value={modalType} onchange={(e) => changeResponseType(e.currentTarget.value)}>
				<option value="Text">Text</option>
				<option value="article">Article</option>
				<option value="input_select">Input Select</option>
				<option value="form">Form</option>
				<option value="sequential_form">Sequential Form</option>
				<option value="cards">Cards</option>
				<option value="submenu">Submenu</option>
			</select>
		</div>

		<hr class="my-4" />

		{#if typeof item.response === 'string'}
			<div class="form-control gap-1">
				<label class="label py-0" for="modalBody"><span class="label-text text-xs opacity-70">Message body</span></label>
				<textarea id="modalBody" class="textarea textarea-sm textarea-bordered w-full" rows="6" value={item.response} oninput={(e) => updateResponse(e.currentTarget.value)}></textarea>
			</div>
		{:else if item.response?.content_type === 'article'}
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<h4 class="font-semibold">Article items</h4>
					<button class="btn btn-primary btn-sm" onclick={addListItem}>+ Add article card</button>
				</div>
				{#each item.response.content_attributes.items as art, i (i)}
					<div class="card bg-base-200/30 border border-base-300">
						<div class="card-body gap-3">
							<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
								<input class="input input-sm input-bordered w-full" bind:value={art.title} placeholder="Title" />
								<input class="input input-sm input-bordered w-full" bind:value={art.link} placeholder="https://example.com" />
							</div>
							<textarea class="textarea textarea-sm textarea-bordered w-full" rows="2" bind:value={art.description} placeholder="Short description"></textarea>
							<div class="flex justify-end border-t border-base-300 pt-3">
								<button class="btn btn-error btn-sm btn-outline" onclick={() => removeListItem(i)}>Remove</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{:else if item.response?.content_type === 'input_select'}
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<h4 class="font-semibold">Select options</h4>
					<button class="btn btn-primary btn-sm" onclick={addListItem}>+ Add option</button>
				</div>
				{#each item.response.content_attributes.items as it, i (i)}
					<div class="grid grid-cols-[1fr_auto] gap-2 items-center">
						<input class="input input-sm input-bordered w-full" bind:value={it.title} placeholder="Option title" oninput={() => { it.value = it.title; }} />
						<button class="btn btn-error btn-sm btn-outline" onclick={() => removeListItem(i)}>✕</button>
					</div>
				{/each}
			</div>
		{:else if item.response?.content_type === 'form' || item.response?.content_type === 'sequential_form'}
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<h4 class="font-semibold">{item.response.content_type === 'sequential_form' ? 'Sequential form steps' : 'Form fields'}</h4>
					<button class="btn btn-primary btn-sm" onclick={addListItem}>+ Add {item.response.content_type === 'sequential_form' ? 'step' : 'field'}</button>
				</div>
				{#each item.response.content_attributes.items as field, fieldIndex (fieldIndex)}
					<div class="card bg-base-200/30 border border-base-300">
						<div class="card-body gap-4">
							<div class="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
								<div class="form-control gap-1">
									<label class="label py-0" for="field-type-{fieldIndex}"><span class="label-text text-xs opacity-70">Type</span></label>
									<select id="field-type-{fieldIndex}" class="select select-sm select-bordered w-full" bind:value={field.type}>
										<option value="text">Text</option>
										<option value="email">Email</option>
										<option value="number">Number</option>
										<option value="text_area">Text Area</option>
										<option value="select">Select</option>
									</select>
								</div>
								<div class="form-control gap-1">
									<label class="label py-0" for="field-label-{fieldIndex}"><span class="label-text text-xs opacity-70">Label</span></label>
									<input id="field-label-{fieldIndex}" class="input input-sm input-bordered w-full" bind:value={field.label} placeholder="Shown to user" oninput={(e) => { field.name = slugify(e.currentTarget.value); }} />
								</div>
							</div>
							<div class="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
								<div class="form-control gap-1">
									<label class="label py-0" for="field-placeholder-{fieldIndex}"><span class="label-text text-xs opacity-70">Placeholder</span></label>
									<input id="field-placeholder-{fieldIndex}" class="input input-sm input-bordered w-full" bind:value={field.placeholder} placeholder="Enter value" />
								</div>
								<div class="form-control gap-1">
									<label class="label py-0" for="field-default-{fieldIndex}"><span class="label-text text-xs opacity-70">Default value</span></label>
									<input id="field-default-{fieldIndex}" class="input input-sm input-bordered w-full" bind:value={field.default} placeholder="Default" />
								</div>
							</div>
							{#if field.type === 'select'}
								<div class="form-control gap-1.5">
									<span class="label-text text-xs opacity-70">Options</span>
									{#if field.options && field.options.length > 0}
										<div class="flex flex-col gap-1.5">
											{#each field.options as opt, optIndex (optIndex)}
												<div class="grid grid-cols-[1fr_auto] gap-2 items-center">
													<input class="input input-sm input-bordered w-full" bind:value={opt.label} placeholder="Option label" oninput={() => { opt.value = opt.label; }} />
													<button class="btn btn-error btn-sm btn-outline" onclick={() => removeFormSelectOption(fieldIndex, optIndex)} aria-label="Remove option">✕</button>
												</div>
											{/each}
										</div>
									{:else}
										<p class="text-sm opacity-60">No options yet.</p>
									{/if}
									<button class="btn btn-outline btn-primary btn-sm w-fit" onclick={() => addFormSelectOption(fieldIndex)}>+ Add option</button>
								</div>
							{/if}
							<div class="flex justify-end border-t border-base-300 pt-3">
								<button class="btn btn-error btn-sm btn-outline" onclick={() => removeListItem(fieldIndex)}>Remove {item.response.content_type === 'sequential_form' ? 'step' : 'field'}</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{:else if item.response?.content_type === 'cards'}
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<h4 class="font-semibold">Cards</h4>
					<button class="btn btn-primary btn-sm" onclick={addListItem}>+ Add card</button>
				</div>
				{#each item.response.content_attributes.items as card, i (i)}
					<div class="card bg-base-200/30 border border-base-300">
						<div class="card-body gap-4">
							<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
								<input class="input input-sm input-bordered w-full" bind:value={card.media_url} placeholder="Image URL" />
								<input class="input input-sm input-bordered w-full" bind:value={card.title} placeholder="Card title" />
							</div>
							<textarea class="textarea textarea-sm textarea-bordered w-full" rows="2" bind:value={card.description} placeholder="Description"></textarea>
							<div class="space-y-2">
								<div class="flex items-center justify-between">
									<h5 class="font-semibold text-sm">Actions</h5>
									<button class="btn btn-primary btn-sm" onclick={() => addCardAction(i)}>Add action</button>
								</div>
								{#if Array.isArray(card.actions) && card.actions.length > 0}
									{#each card.actions as action, actionIndex (actionIndex)}
										<div class="grid grid-cols-1 md:grid-cols-[140px_1fr_1fr_auto] gap-2 items-center">
											<select class="select select-sm select-bordered w-full" bind:value={action.type}>
												<option value="link">Link</option>
												<option value="postback">Postback</option>
											</select>
											<input class="input input-sm input-bordered w-full" bind:value={action.text} placeholder="Button text" />
											{#if action.type === 'link'}
												<input class="input input-sm input-bordered w-full" placeholder="https://example.com" bind:value={action.uri} />
											{:else}
												<input class="input input-sm input-bordered w-full" placeholder="Payload" bind:value={action.payload} />
											{/if}
											<button class="btn btn-error btn-sm btn-outline" onclick={() => removeCardAction(i, actionIndex)}>✕</button>
										</div>
									{/each}
								{:else}
									<p class="text-sm opacity-70">No actions yet.</p>
								{/if}
							</div>
							<div class="flex justify-end border-t border-base-300 pt-3">
								<button class="btn btn-error btn-sm btn-outline" onclick={() => removeListItem(i)}>Remove card</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{:else if isSubmenu(item)}
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<h4 class="font-semibold">Sub-menu items</h4>
					<button class="btn btn-primary btn-sm" onclick={() => onCreateChild?.(index)}>+ Add sub-menu item</button>
				</div>
				{#if Array.isArray(item.children_options) && item.children_options.length > 0}
					<div class="flex flex-col gap-2">
						{#each item.children_options as ch, childIndex (ch.key)}
							<div class="card bg-base-200/30 border border-base-300">
								<div class="card-body gap-3">
									<div>
										<label class="label-text text-[11px] opacity-60" for="child-key-{childIndex}">Option label</label>
										<input id="child-key-{childIndex}" class="input input-bordered input-sm w-full" value={ch.key} disabled />
									</div>
									<div class="flex flex-wrap gap-2">
										<button class="btn btn-outline btn-xs" onclick={() => onOpenChild?.(ch.key)}>Edit</button>
										<button class="btn btn-outline btn-xs" onclick={() => onMoveChild?.(index, childIndex, -1)} disabled={childIndex === 0}>↑</button>
										<button class="btn btn-outline btn-xs" onclick={() => onMoveChild?.(index, childIndex, 1)} disabled={childIndex === item.children_options.length - 1}>↓</button>
										<button class="btn btn-error btn-xs btn-outline" onclick={() => onUnlinkChild?.(index, childIndex)}>Remove</button>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-sm opacity-70">No sub-menu items yet. Add one above.</p>
				{/if}
			</div>
		{:else}
			<p class="text-sm opacity-70">Select what to show when this option is selected.</p>
		{/if}

		<div class="modal-action">
			<button class="btn btn-error btn-sm" onclick={() => onDelete?.(index)}>Delete</button>
			<button class="btn btn-ghost" onclick={onClose}>Cancel</button>
			<button class="btn btn-primary" onclick={handleDone}>Done</button>
		</div>
	</div>
	<button class="modal-backdrop" aria-label="Close" onclick={onClose}></button>
</div>
