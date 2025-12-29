// Web Worker for DAG layout computation
// This offloads expensive layout calculations from the main thread

interface DagNode {
  id: string;
  label: string;
  operator: string;
  stage: number;
  isBottleneck?: boolean;
}

interface DagLink {
  source: string;
  target: string;
}

interface LayoutNode extends DagNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LayoutResult {
  nodes: LayoutNode[];
  links: DagLink[];
  width: number;
  height: number;
  stages: Array<{ id: number; label: string; x: number }>;
}

// Layout constants
const NODE_WIDTH = 280;
const NODE_HEIGHT = 120;
const HORIZONTAL_GAP = 100;
const VERTICAL_GAP = 40;
const STAGE_PADDING = 50;

function computeLayout(nodes: DagNode[], links: DagLink[]): LayoutResult {
  // Group nodes by stage
  const stageMap = new Map<number, DagNode[]>();
  nodes.forEach(node => {
    if (!stageMap.has(node.stage)) {
      stageMap.set(node.stage, []);
    }
    stageMap.get(node.stage)!.push(node);
  });

  // Sort stages
  const sortedStages = Array.from(stageMap.keys()).sort((a, b) => a - b);

  // Calculate positions
  const layoutNodes: LayoutNode[] = [];
  const stages: Array<{ id: number; label: string; x: number }> = [];
  let currentX = STAGE_PADDING;

  sortedStages.forEach((stageNum, stageIndex) => {
    const stageNodes = stageMap.get(stageNum)!;
    const stageHeight = stageNodes.length * (NODE_HEIGHT + VERTICAL_GAP);
    let currentY = STAGE_PADDING;

    stageNodes.forEach(node => {
      layoutNodes.push({
        ...node,
        x: currentX,
        y: currentY,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      });
      currentY += NODE_HEIGHT + VERTICAL_GAP;
    });

    stages.push({
      id: stageNum,
      label: `Stage ${stageNum}`,
      x: currentX,
    });

    currentX += NODE_WIDTH + HORIZONTAL_GAP;
  });

  const totalWidth = currentX + STAGE_PADDING;
  const maxStageHeight = Math.max(...Array.from(stageMap.values()).map(nodes =>
    nodes.length * (NODE_HEIGHT + VERTICAL_GAP)
  ));
  const totalHeight = maxStageHeight + 2 * STAGE_PADDING;

  return {
    nodes: layoutNodes,
    links,
    width: totalWidth,
    height: totalHeight,
    stages,
  };
}

// Listen for messages from the main thread
self.addEventListener('message', (event: MessageEvent) => {
  const { nodes, links } = event.data;

  try {
    const result = computeLayout(nodes, links);
    self.postMessage({ success: true, result });
  } catch (error) {
    self.postMessage({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
