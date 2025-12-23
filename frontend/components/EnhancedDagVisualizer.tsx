
import React from 'react';
import { DagNode, DagLink, OptimizationTip } from '../../shared/types';
import { DAGCanvas } from './dag/DAGCanvas';

interface Props {
  nodes: DagNode[];
  links: DagLink[];
  optimizations: OptimizationTip[];
  isExpanded?: boolean;
  onToggleExpand?: (expanded: boolean) => void;
  highlightedNodeId?: string | null;
  onSelectNode?: (nodeId: string | null) => void;
  onMapToCode?: () => void;
}

export const EnhancedDagVisualizer: React.FC<Props> = ({
  nodes,
  links,
  optimizations,
  isExpanded,
  onToggleExpand,
  highlightedNodeId,
  onSelectNode,
  onMapToCode
}) => {
  return (
    <DAGCanvas
      nodes={nodes}
      links={links}
      optimizations={optimizations}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
      highlightedNodeId={highlightedNodeId}
      onSelectNode={onSelectNode}
      onMapToCode={onMapToCode}
    />
  );
};
