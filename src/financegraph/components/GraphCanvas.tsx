import { useCallback, useMemo, useRef, useState } from 'react';
import { ReactFlow, ReactFlowProvider, Background, useReactFlow, type Node, type Edge, Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { FinanceNode, GraphState, GraphPosition } from '../types';

export const DRAWER_DND_TYPE = 'application/financegraph-node';

interface NodeData extends Record<string, unknown> {
  node: FinanceNode;
  value: number;
  selectedForConnect: boolean;
}

function FinanceNodeView({ data }: { data: NodeData }) {
  const { node, value, selectedForConnect } = data;
  return (
    <div className={`fg-node ${node.category}${selectedForConnect ? ' fg-connect-selected' : ''}`}>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      {node.label}
      <span className="fg-node-value">${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}{node.category === 'income' ? '/mo' : ''}</span>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}

const nodeTypes = { financeNode: FinanceNodeView };

interface Props {
  graph: GraphState;
  nodeValues: Record<string, number>;
  onNodeClick: (node: FinanceNode) => void;
  onDropNode: (nodeId: string, position: GraphPosition) => void;
  onMoveNode: (nodeId: string, position: GraphPosition) => void;
  onConnectRequest: (nodeAId: string, nodeBId: string) => void;
  onReturnToDrawer: (nodeId: string) => void;
}

function clientPoint(e: unknown): { x: number; y: number } | null {
  if (e && typeof e === 'object' && 'clientX' in e && 'clientY' in e) {
    return { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };
  }
  return null;
}

function GraphCanvasInner({ graph, nodeValues, onNodeClick, onDropNode, onMoveNode, onConnectRequest, onReturnToDrawer }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const [selectedForConnect, setSelectedForConnect] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ nodeId: string; text: string; x: number; y: number } | null>(null);

  const { flowNodes, flowEdges } = useMemo(() => {
    const layout = graph.layout ?? {};
    // Only placed (unlocked) nodes ever render on the board — locked concepts live in the drawer.
    const flowNodes: Node[] = graph.nodes
      .filter(n => n.unlocked && layout[n.id])
      .map((node) => ({
        id: node.id,
        type: 'financeNode',
        position: layout[node.id],
        data: { node, value: nodeValues[node.id] ?? node.currentValue, selectedForConnect: node.id === selectedForConnect },
        draggable: true,
      }));

    const flowEdges: Edge[] = graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      animated: true,
      style: { stroke: edge.type === 'payment' ? '#e4ab56' : '#d4dfc7' },
      label: edge.amountType === 'percent' ? `${edge.value}%` : `$${edge.value}`,
      labelStyle: { fill: '#f5f1e7', fontSize: 10 },
      labelBgStyle: { fill: '#344238' },
    }));

    return { flowNodes, flowEdges };
  }, [graph, nodeValues, selectedForConnect]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(DRAWER_DND_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    const nodeId = e.dataTransfer.getData(DRAWER_DND_TYPE);
    if (!nodeId) return;
    e.preventDefault();
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    onDropNode(nodeId, position);
  }, [screenToFlowPosition, onDropNode]);

  // Right-click a node to select it as the connection source; right-click a second node
  // to complete the connection (opens the allocation editor for that pair). Right-clicking
  // the same node again, or the empty canvas, clears the selection.
  const handleNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    setSelectedForConnect(current => {
      if (!current) return node.id;
      if (current === node.id) return null;
      onConnectRequest(current, node.id);
      return null;
    });
  }, [onConnectRequest]);

  return (
    <div ref={wrapperRef} style={{ width: '100%', height: '100%', position: 'relative' }} onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, n) => {
          const node = graph.nodes.find(gn => gn.id === n.id);
          if (node && node.unlocked && node.category !== 'income') onNodeClick(node);
        }}
        onNodeDragStop={(e, n) => {
          const point = clientPoint(e);
          const overDrawer = point && document.elementFromPoint(point.x, point.y)?.closest('.fg-drawer');
          if (overDrawer) onReturnToDrawer(n.id);
          else onMoveNode(n.id, n.position);
        }}
        onNodeContextMenu={handleNodeContextMenu}
        onPaneContextMenu={(e) => { e.preventDefault(); setSelectedForConnect(null); }}
        onNodeMouseEnter={(e, n) => {
          const node = graph.nodes.find(gn => gn.id === n.id);
          if (node?.reasoning) setTooltip({ nodeId: n.id, text: node.reasoning, x: e.clientX, y: e.clientY });
        }}
        onNodeMouseMove={(e, n) => setTooltip(t => (t && t.nodeId === n.id ? { ...t, x: e.clientX, y: e.clientY } : t))}
        onNodeMouseLeave={() => setTooltip(null)}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#41513c" gap={24} />
      </ReactFlow>

      {selectedForConnect && (
        <div className="fg-connect-hint">Right-click a second node to connect it to {graph.nodes.find(n => n.id === selectedForConnect)?.label}.</div>
      )}

      {tooltip && (
        <div className="fg-node-tooltip" style={{ left: tooltip.x + 16, top: tooltip.y + 16 }}>{tooltip.text}</div>
      )}
    </div>
  );
}

export default function GraphCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
