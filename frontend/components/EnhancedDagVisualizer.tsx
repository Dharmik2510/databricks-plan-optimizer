
import React from 'react';
import { DagNode, DagLink, OptimizationTip } from '../../shared/types';
import { DAGCanvas } from './dag/DAGCanvas';

interface Props {
  nodes: DagNode[];
  links: DagLink[];
  optimizations: OptimizationTip[];
}

export const EnhancedDagVisualizer: React.FC<Props> = ({ nodes, links, optimizations }) => {
  return (
    <DAGCanvas nodes={nodes} links={links} optimizations={optimizations} />
  );
};
