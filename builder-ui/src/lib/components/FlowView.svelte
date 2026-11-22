<script lang="ts">
	// Flow view for the menu builder.
	//   RIGHT bar → LEFT bar   : link top-level nodes into a chain (source placed BEFORE target)
	//   LEFT  bar → RIGHT bar  : link top-level nodes into a chain (source placed AFTER target)
	//   BOTTOM bar → TOP bar   : nest a child under a parent (submenu)
	// Anything else is ignored.
	//
	// Only ROOT nodes expose LEFT/RIGHT bars (they form the top-level chain) and only
	// CHILD nodes expose a TOP bar — so a bottom→top connector can NEVER appear on a
	// root node, and the chain between roots always renders horizontally.
	//
	// Colour coding: AMBER = top-level chain, PRIMARY = nest (parent → child), EMERALD = drop zone.
	import { SvelteFlow, Background, BackgroundVariant, MarkerType, ConnectionLineType, ConnectionMode, type Node, type Edge, type Connection } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import * as dagre from 'dagre';
	import FlowNode from './FlowNode.svelte';

	const { menuItems = [], onEdit = () => {}, onAdd = () => {}, onDelete = () => {}, onConnect = () => {}, onOrder = () => {}, onAddChild = () => {}, onUnlink = () => {} } = $props<{
		menuItems?: any[];
		onEdit?: (key: string) => void;
		onAdd?: () => void;
		onDelete?: (key: string) => void;
		onConnect?: (source: string, target: string) => void;      // nest child (bottom→top)
		onOrder?: (source: string, target: string, before: boolean) => void; // root chain (right→left / left→right)
		onAddChild?: (key: string) => void;                        // add a sub-menu item under a node
		onUnlink?: (key: string) => void;                         // detach a child from its parent
	}>();

	const nodeTypes = { menu: FlowNode };
	const NODE_W = 230;
	const NODE_H = 72;

	// Colour palette: amber = top-level chain, primary = nest (parent → child).
	const NEST_EDGE = 'var(--color-primary, #2563eb)'; // solid    : parent → child (vertical)
	const CHAIN_EDGE = '#f59e0b';                       // dashed   : root → root (horizontal, left-to-right)

	function isSubmenu(it: any): boolean {
		return it && typeof it.response === 'object' && it.response?.content_type === 'submenu';
	}
	function typeLabel(it: any): string {
		const resp = it?.response;
		if (typeof resp === 'string') return 'Text';
		const t = resp?.content_type;
		switch (t) {
			case 'article': return 'Article';
			case 'input_select': return 'Input Select';
			case 'form': return 'Form';
			case 'sequential_form': return 'Sequential Form';
			case 'cards': return 'Cards';
			case 'submenu': return 'Submenu';
			default: return t ? t.replace(/_/g, ' ') : 'Text';
		}
	}
	function summary(it: any): string {
		const resp = it?.response;
		if (typeof resp === 'string') {
			const t = resp.trim();
			if (!t) return 'No message yet';
			return t.length > 70 ? `${t.slice(0, 67)}…` : t;
		}
		const items = resp?.content_attributes?.items;
		switch (resp?.content_type) {
			case 'article': return `${items?.length || 0} article(s)`;
			case 'input_select': return `${items?.length || 0} option(s)`;
			case 'form':
			case 'sequential_form': return `${items?.length || 0} field(s)`;
			case 'cards': return `${items?.length || 0} card(s)`;
			case 'submenu': return `${it?.children_options?.length || 0} sub-item(s)`;
			default: return 'Click to configure';
		}
	}

	function computeDepth(): Map<string, number> {
		const items: any[] = menuItems || [];
		const byKey = new Map(items.map((it) => [it?.key, it]));
		const depthMap = new Map<string, number>();
		const visited = new Set<string>();
		function walk(item: any, depth: number) {
			if (!item?.key || visited.has(item.key)) return;
			visited.add(item.key);
			depthMap.set(item.key, depth);
			if (Array.isArray(item.children_options)) {
				for (const ch of item.children_options) {
					const child = byKey.get(ch?.key);
					if (child) walk(child, depth + 1);
				}
			}
		}
		for (const it of items) {
			// Walk as a root unless it's a genuine child (parent exists AND still lists it).
			// This self-heals orphaned items (e.g. parent was changed to a non-submenu type
			// without clearing children) so they never render as disconnected.
			const parent = it?._parentKey ? byKey.get(it._parentKey) : null;
			const isRealChild = parent && (parent.children_options || []).some((c: any) => c?.key === it.key);
			if (!isRealChild) walk(it, 0);
		}
		for (const it of items) if (!visited.has(it?.key)) depthMap.set(it.key, 0);
		return depthMap;
	}

	function layout() {
		const items: any[] = menuItems || [];
		const g = new dagre.graphlib.Graph();
		g.setDefaultEdgeLabel(() => ({}));
		g.setGraph({ rankdir: 'TB', nodesep: 30, ranksep: 70, marginx: 20, marginy: 20 });
		const validKeys = new Set(items.map((it) => it?.key).filter(Boolean));
		for (const it of items) if (it?.key) g.setNode(it.key, { width: NODE_W, height: NODE_H });
		for (const it of items) {
			if (Array.isArray(it.children_options)) {
				for (const ch of it.children_options) if (ch?.key && validKeys.has(ch.key)) g.setEdge(it.key, ch.key);
			}
		}
		try { dagre.layout(g); } catch {}
		const depthMap = computeDepth();
		const nodes: Node[] = [];
		const edges: Edge[] = [];
		for (const it of items) {
			if (!it?.key) continue;
			const p = g.node(it.key) || { x: 0, y: 0 };
			const depth = depthMap.get(it.key) ?? 0;
			nodes.push({
				id: it.key,
				type: 'menu',
				position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 },
				data: {
					label: it.key,
					typeLabel: typeLabel(it),
					summary: summary(it),
					subItems: Array.isArray(it.children_options) ? it.children_options?.length || 0 : 0,
					depth,
					isRoot: depth === 0,
					parentLabel: it?._parentLabel || '',
					onEdit,
					onDelete,
					onAddChild,
					onUnlink
				}
			});
		}
		// Nested edges: solid PRIMARY (parent → child), always vertical via bottom→top handles.
		for (const e of g.edges()) {
			edges.push({
				id: `${e.v}--${e.w}`,
				source: e.v,
				target: e.w,
				sourceHandle: 'bottom',
				targetHandle: 'top',
				type: 'smoothstep',
				style: `stroke:${NEST_EDGE}; stroke-width:2;`,
				markerEnd: { type: MarkerType.ArrowClosed, color: NEST_EDGE, width: 14, height: 14 }
			});
		}
		// Root chain edges: dashed AMBER, explicitly RIGHT→LEFT so they render HORIZONTAL
		// (left-to-right arrows between consecutive roots) — never vertical.
		const rootKeys = items.filter((it: any) => {
			if (!it?.key) return false;
			if (!it._parentKey) return true;
			// An item whose parent no longer lists it is effectively a root — give it a chain
			// edge so it doesn't float disconnected.
			const p = items.find((x: any) => x.key === it._parentKey);
			return !p || !(p.children_options || []).some((c: any) => c?.key === it.key);
		}).map((it: any) => it.key);
		for (let i = 0; i < rootKeys.length - 1; i++) {
			edges.push({
				id: `order-${i}`,
				source: rootKeys[i],
				target: rootKeys[i + 1],
				sourceHandle: 'right',
				targetHandle: 'left',
				type: 'smoothstep',
				style: `stroke:${CHAIN_EDGE}; stroke-width:2; stroke-dasharray:6 5;`,
				markerEnd: { type: MarkerType.ArrowClosed, color: CHAIN_EDGE, width: 14, height: 14 }
			});
		}
		return { nodes, edges };
	}

	function onconnect(conn: Connection) {
		if (!conn.source || !conn.target || conn.source === conn.target) return;
		const sh = String(conn.sourceHandle || '');
		const th = String(conn.targetHandle || '');

		// EXACT spec — nothing else does anything:
		//   right → left : chain, source placed BEFORE target (top level)
		//   left  → right: chain, source placed AFTER target (top level)
		//   bottom → top : nest, target becomes a child of source (submenu)
		if (sh === 'right' && th === 'left') {
			onOrder(conn.source, conn.target, true);
		} else if (sh === 'left' && th === 'right') {
			onOrder(conn.source, conn.target, false);
		} else if (sh === 'bottom' && th === 'top') {
			onConnect(conn.source, conn.target);
		}
	}

	let sig = '';
	let nodes = $state<Node[]>([]);
	let edges = $state<Edge[]>([]);
	$effect(() => {
		const items: any[] = menuItems || [];
		const nextSig = JSON.stringify(items.map((it) => [it?.key, typeLabel(it), it?.response, isSubmenu(it) ? (it.children_options || []).map((c: any) => c?.key) : [], it?._parentKey]));
		if (nextSig !== sig) { sig = nextSig; const l = layout(); nodes = l.nodes; edges = l.edges; }
	});
</script>

<div class="relative h-[calc(100vh-280px)] min-h-[400px] border border-base-300 rounded-xl overflow-hidden bg-base-100">
	{#if nodes.length === 0}
		<div class="absolute inset-0 flex flex-col items-center justify-center text-center gap-3">
			<svg class="opacity-40" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
			<p class="text-sm opacity-60">No menu items yet.</p>
			<button type="button" class="btn btn-primary btn-sm" onclick={onAdd}>+ Add your first item</button>
		</div>
	{:else}
		<SvelteFlow
			{nodes} {edges} {nodeTypes}
			fitView minZoom={0.2} maxZoom={1.5} nodesDraggable
			connectionLineType={ConnectionLineType.SmoothStep}
			connectionLineStyle={`stroke:${CHAIN_EDGE}; stroke-width:2; stroke-dasharray:5 3;`}
			connectionMode={ConnectionMode.Loose}
			{onconnect}
		>
			<Background variant={BackgroundVariant.Dots} gap={20} />
		</SvelteFlow>
	{/if}

	<button type="button" class="absolute bottom-3 left-3 z-10 btn btn-primary btn-sm shadow" onclick={onAdd}>+ Add Root</button>

	<div class="absolute top-2 left-2 z-10 text-[11px] text-base-content/60 bg-base-100/85 backdrop-blur border border-base-300/80 rounded-full px-3 py-1 shadow-sm">
		<span class="font-medium text-amber-400">●</span> side dots = top-level order &nbsp;·&nbsp; <span class="font-medium" style="color: var(--color-primary)">●</span> bottom → <span class="font-medium text-emerald-400">●</span> top = nest &nbsp;·&nbsp; <span class="font-medium text-amber-500">⤓</span> = unlink &nbsp;·&nbsp; <span class="font-medium text-primary">＋</span> = add sub-item
	</div>

	<div class="absolute bottom-3 right-3 z-10 flex items-center gap-3 text-[11px] text-base-content/70 bg-base-100/85 backdrop-blur border border-base-300/80 rounded-full px-3 py-1.5 shadow-sm">
		<span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>Chain</span>
		<span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full inline-block" style="background: var(--color-primary)"></span>Nest</span>
		<span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>Drop</span>
	</div>
</div>
