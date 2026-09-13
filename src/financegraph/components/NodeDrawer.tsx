import type { FinanceNode } from '../types';
import { DRAWER_DND_TYPE } from './GraphCanvas';

interface Props {
  lockedNodes: FinanceNode[]; // sorted by unlockRank ascending
  nextNodeId: string | null;
}

// Locked concepts live here, not on the board — drag the next one (top of the queue)
// onto the canvas to place + unlock it. Preserves "concepts unlock one at a time," but
// as a drag gesture instead of an automatic reveal.
export default function NodeDrawer({ lockedNodes, nextNodeId }: Props) {
  return (
    <div className="fg-panel fg-drawer">
      <p className="fg-eyebrow">Drawer</p>
      <p className="fg-muted" style={{ marginBottom: 9 }}>Drag the next concept onto the board.</p>
      <ul className="fg-drawer-list">
        {lockedNodes.map((node) => {
          const draggableNow = node.id === nextNodeId;
          return (
            <li
              key={node.id}
              className={`fg-drawer-item${draggableNow ? ' next' : ''}`}
              draggable={draggableNow}
              title={draggableNow ? node.reasoning : undefined}
              onDragStart={draggableNow ? (e) => {
                e.dataTransfer.setData(DRAWER_DND_TYPE, node.id);
                e.dataTransfer.effectAllowed = 'move';
              } : undefined}
            >
              {draggableNow ? node.label : '???'}
            </li>
          );
        })}
        {lockedNodes.length === 0 && <li className="fg-muted">Everything unlocked.</li>}
      </ul>
    </div>
  );
}
