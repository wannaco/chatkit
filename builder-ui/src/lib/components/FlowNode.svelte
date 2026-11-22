<script lang="ts">
	// Custom node for the flow view — clean card style.
	// Connection points are small round DOTS on the node edges:
	//   AMBER dots on LEFT/RIGHT (roots only) → link the top-level chain
	//   EMERALD dot on TOP (EVERY node)      → drop zone: any node can be nested under a parent
	//   PRIMARY dot on BOTTOM (every node)    → drag onto another node's TOP to make it a child
	// Children also get an "unlink" (⤓) button on hover to detach them from their parent.
	import { Handle, Position } from '@xyflow/svelte';

	const { data, id = '', selected = false } = $props<{
		data: any;
		id?: string;
		selected?: boolean;
	}>();

	const isRoot = $derived(!!data?.isRoot);
	const isSubmenuNode = $derived(data?.subItems > 0);
	const level = $derived((data?.depth ?? 0) + 1); // 1-based for humans

	function edit() {
		data?.onEdit?.(id);
	}
	function del(e: MouseEvent) {
		e.stopPropagation();
		data?.onDelete?.(id);
	}
	function addChild(e: MouseEvent) {
		e.stopPropagation();
		data?.onAddChild?.(id);
	}
	function unlink(e: MouseEvent) {
		e.stopPropagation();
		data?.onUnlink?.(id);
	}
</script>

<div
	class="group relative w-[230px] rounded-2xl border bg-base-200/70 shadow-md backdrop-blur-sm transition-all duration-150 hover:border-primary/50 hover:shadow-lg {selected ? 'border-primary/70 ring-2 ring-primary/25 shadow-lg' : isRoot ? 'border-primary/35' : isSubmenuNode ? 'border-info/40' : 'border-base-300'}"
	role="button"
	tabindex="0"
	onclick={edit}
	onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); edit(); } }}
>
	<!-- TOP: emerald dot on EVERY node — a parent's BOTTOM dot drops here to nest this under it.
	     Roots have this too, so any node can become a child of any other node. -->
	<Handle
		type="target"
		id="top"
		position={Position.Top}
		style="top:-7px; left:50%; transform:translateX(-50%); width:14px; height:14px;"
		class="!w-3.5 !h-3.5 !rounded-full !bg-emerald-500 !border-2 !border-base-100 cursor-crosshair transition-transform duration-150 hover:!scale-125"
		title="Drop a parent's BOTTOM dot here to nest this under it"
	/>

	{#if isRoot}
		<!-- LEFT: amber dot — drag onto another root's RIGHT dot to place this AFTER it in the chain -->
		<Handle
			type="source"
			id="left"
			position={Position.Left}
			style="left:-7px; top:50%; transform:translateY(-50%); width:14px; height:14px;"
			class="!w-3.5 !h-3.5 !rounded-full !bg-amber-400 !border-2 !border-base-100 cursor-crosshair transition-transform duration-150 hover:!scale-125"
			title="Top-level chain: drag to another root's RIGHT dot to place this AFTER it"
		/>

		<!-- RIGHT: amber dot — drag onto another root's LEFT dot to place this BEFORE it in the chain -->
		<Handle
			type="source"
			id="right"
			position={Position.Right}
			style="right:-7px; top:50%; transform:translateY(-50%); width:14px; height:14px;"
			class="!w-3.5 !h-3.5 !rounded-full !bg-amber-400 !border-2 !border-base-100 cursor-crosshair transition-transform duration-150 hover:!scale-125"
			title="Top-level chain: drag to another root's LEFT dot to place this BEFORE it"
		/>
	{/if}

	<div class="p-3 flex items-start justify-between gap-2">
		<div class="min-w-0 flex-1">
			<div class="flex flex-wrap items-center gap-1.5">
				{#if isRoot}
					<span class="badge badge-xs badge-primary shrink-0">Root</span>
				{:else}
					<span class="badge badge-xs badge-outline shrink-0 opacity-80">L{level}</span>
				{/if}
				<span class="font-semibold text-sm text-base-content truncate">{data?.label || '(untitled)'}</span>
			</div>
			{#if !isRoot && data?.parentLabel}
				<div class="text-[11px] text-base-content/50 mt-0.5 truncate">↳ {data.parentLabel}</div>
			{/if}
			<div class="flex items-center gap-1.5 mt-1">
				<span class="badge badge-xs badge-outline opacity-70">{data?.typeLabel || 'Text'}</span>
				{#if isSubmenuNode}
					<span class="badge badge-xs badge-info badge-outline opacity-80">{data.subItems}</span>
				{/if}
			</div>
			{#if data?.summary}
				<p class="text-[11px] text-base-content/55 mt-1.5 leading-snug line-clamp-2">{data?.summary}</p>
			{/if}
		</div>
		<div class="flex flex-col items-end gap-0.5 shrink-0 -mr-1 -mt-1">
			<button
				type="button"
				class="btn btn-ghost btn-xs text-primary/70 hover:text-primary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
				onclick={addChild}
				title="Add sub-menu item under this node"
				aria-label="Add sub-menu item"
			>＋</button>
			{#if !isRoot}
				<button
					type="button"
					class="btn btn-ghost btn-xs text-amber-500/80 hover:text-amber-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
					onclick={unlink}
					title="Detach from parent (make it a top-level item)"
					aria-label="Unlink from parent"
				>⤓</button>
			{/if}
			<button
				type="button"
				class="btn btn-ghost btn-xs text-base-content/40 hover:text-error shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
				onclick={del}
				title="Delete item"
				aria-label="Delete item"
			>✕</button>
		</div>
	</div>

	<!-- BOTTOM: primary dot (every node) — drag onto another node's TOP dot to nest it under this one -->
	<Handle
		type="source"
		id="bottom"
		position={Position.Bottom}
		style="bottom:-7px; left:50%; transform:translateX(-50%); width:14px; height:14px;"
		class="!w-3.5 !h-3.5 !rounded-full !bg-primary !border-2 !border-base-100 cursor-crosshair transition-transform duration-150 hover:!scale-125"
		title="Link a child: drag to another node's TOP dot to nest it under this one"
	/>
</div>
