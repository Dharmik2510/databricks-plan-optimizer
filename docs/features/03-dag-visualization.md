# DAG Visualization

## Feature Overview

Interactive directed acyclic graph (DAG) visualization of Spark execution plans using D3.js force-directed layout, enabling users to explore plan structure, identify bottlenecks, and navigate complex execution flows with minimap support.

---

## Technical Architecture

### Frontend Components

#### 1. **EnhancedDagVisualizer (Main Container)**
- **Location:** [frontend/EnhancedDagVisualizer.tsx](../frontend/EnhancedDagVisualizer.tsx)
- **Purpose:** Wrapper component managing DAG state and user interactions
- **Key Features:**
  - Node selection handling
  - Expansion/collapse of node details
  - Optimization highlighting
  - Props interface with parent App component

**Props Interface:**
```typescript
{
  nodes: DagNode[];                    // DAG nodes from analysis
  links: DagLink[];                    // DAG edges
  optimizations: Optimization[];       // For highlighting
  onNodeClick?: (nodeId: string) => void;
  onNodeDoubleClick?: (nodeId: string) => void;
  selectedNodeId?: string;
  highlightedNodeIds?: string[];       // Problematic nodes
}
```

#### 2. **DAGCanvas (Core Visualization)**
- **Location:** [frontend/components/dag/DAGCanvas.tsx](../frontend/components/dag/DAGCanvas.tsx)
- **Purpose:** D3.js-powered interactive graph rendering
- **Technology:** D3.js v7 with force simulation

**Rendering Pipeline:**
1. SVG container setup (viewport + minimap)
2. Force simulation initialization
3. Node/link element creation
4. Zoom/pan behavior binding
5. Minimap synchronization
6. Animation loop (tick updates)

**Visual Elements:**
```typescript
// Node Representation
<g class="dag-node">
  <circle r={radius} fill={colorByType} />
  <text>{node.label}</text>
  {/* Badges for partitions, data size */}
  <rect class="badge" />
</g>

// Link Representation
<line class="dag-link"
      stroke={isProblematic ? 'red' : 'gray'}
      stroke-width={thickness}
      marker-end="url(#arrowhead)" />
```

#### 3. **useDagLayout Hook**
- **Location:** [frontend/hooks/useDagLayout.ts](../frontend/hooks/useDagLayout.ts)
- **Purpose:** D3 force simulation logic and layout calculations
- **Features:**
  - Force configuration (collision, links, charge)
  - Dynamic node positioning
  - Hierarchy detection (layered layout for DAGs)
  - Performance optimization (reduced tick count for large graphs)

**Force Configuration:**
```typescript
const simulation = d3.forceSimulation(nodes)
  .force("link", d3.forceLink(links)
    .id(d => d.id)
    .distance(120)           // Edge length
  )
  .force("charge", d3.forceManyBody()
    .strength(-300)          // Node repulsion
  )
  .force("collision", d3.forceCollide()
    .radius(40)              // Prevent overlap
  )
  .force("center", d3.forceCenter(width/2, height/2))
  .force("y", d3.forceY()    // Vertical stratification
    .strength(0.1)
  );
```

#### 4. **NodeDetailsPanel**
- **Location:** [frontend/components/dag/NodeDetailsPanel.tsx](../frontend/components/dag/NodeDetailsPanel.tsx)
- **Purpose:** Display detailed information about selected node
- **Content:**
  - Node type and label
  - Stage number
  - Resource metrics (partitions, bytes read/written, duration)
  - Related optimizations
  - Mapped code (if available)

**Displayed Metrics:**
```typescript
- Node ID: scan_customers_1
- Type: Scan
- Table: delta.`s3://bucket/customers`
- Partitions: 200
- Data Read: 45.2 GB
- Duration: 8.3 seconds
- Related Issues:
  * "Add Partition Pruning" (MEDIUM)
  * "Optimize File Format" (LOW)
```

---

## Data Flow

### Visualization Rendering Pipeline

```
┌─────────────────────────────────────┐
│ Backend: Analysis Complete          │
│ - dagNodes: DagNode[]                │
│ - dagLinks: DagLink[]                │
└──────────────┬──────────────────────┘
               │
               │ 1. Analysis result fetched
               ▼
┌─────────────────────────────────────┐
│ Frontend: App.tsx                   │
│ - Stores analysis in state          │
│ - Passes to EnhancedDagVisualizer   │
└──────────────┬──────────────────────┘
               │
               │ 2. Props passed down
               ▼
┌─────────────────────────────────────┐
│ EnhancedDagVisualizer               │
│ - Manages selection state           │
│ - Computes highlighted nodes        │
│   (from optimizations.relatedNodeIds)│
└──────────────┬──────────────────────┘
               │
               │ 3. Data + callbacks
               ▼
┌─────────────────────────────────────┐
│ DAGCanvas                           │
│ - Initialize D3 simulation          │
│ - Create SVG elements               │
└──────────────┬──────────────────────┘
               │
               │ 4. Layout calculation
               ▼
┌─────────────────────────────────────┐
│ useDagLayout Hook                   │
│ - Apply force simulation            │
│ - Calculate node positions (x, y)   │
│ - Run 300 ticks for stabilization   │
└──────────────┬──────────────────────┘
               │
               │ 5. Positions computed
               ▼
┌─────────────────────────────────────┐
│ DAGCanvas (continued)               │
│ - Render nodes at (x, y)            │
│ - Draw links between nodes          │
│ - Apply zoom/pan behavior           │
│ - Setup event listeners             │
└──────────────┬──────────────────────┘
               │
               │ 6. User interaction
               ▼
┌─────────────────────────────────────┐
│ User clicks node                    │
└──────────────┬──────────────────────┘
               │
               │ 7. Event bubbles up
               ▼
┌─────────────────────────────────────┐
│ EnhancedDagVisualizer               │
│ - Updates selectedNodeId state      │
│ - Triggers re-render                │
└──────────────┬──────────────────────┘
               │
               │ 8. Selection updated
               ▼
┌─────────────────────────────────────┐
│ DAGCanvas                           │
│ - Highlights selected node (border) │
│ - Fades unrelated nodes (opacity)   │
└──────────────┬──────────────────────┘
               │
               │ 9. Details displayed
               ▼
┌─────────────────────────────────────┐
│ NodeDetailsPanel                    │
│ - Shows node metrics                │
│ - Displays related optimizations    │
│ - Shows mapped code snippet         │
└─────────────────────────────────────┘
```

---

## D3.js Implementation Details

### Force Simulation Configuration

**Purpose:** Automatic layout of nodes and edges for optimal visualization

**Forces Applied:**

1. **Link Force**
   - Treats edges as springs
   - Pulls connected nodes together
   - Distance: 120px (configurable)
   ```typescript
   .force("link", d3.forceLink(links)
     .id(d => d.id)
     .distance(120)
     .strength(1)
   )
   ```

2. **Charge Force**
   - Simulates electrical repulsion
   - Prevents node clustering
   - Strength: -300 (negative = repulsion)
   ```typescript
   .force("charge", d3.forceManyBody()
     .strength(-300)
   )
   ```

3. **Collision Force**
   - Prevents node overlap
   - Radius: 40px (node size + padding)
   ```typescript
   .force("collision", d3.forceCollide()
     .radius(40)
   )
   ```

4. **Center Force**
   - Keeps graph centered in viewport
   ```typescript
   .force("center", d3.forceCenter(width/2, height/2))
   ```

5. **Y-Axis Force (Hierarchy)**
   - Weak vertical stratification
   - Creates layered effect for DAG structure
   ```typescript
   .force("y", d3.forceY()
     .y(d => d.stage ? d.stage * 100 : 0)
     .strength(0.1)
   )
   ```

### Zoom & Pan Behavior

**Implementation:**
```typescript
const zoom = d3.zoom()
  .scaleExtent([0.1, 4])        // Min/max zoom levels
  .on("zoom", (event) => {
    g.attr("transform", event.transform);
    updateMinimap(event.transform);
  });

svg.call(zoom);
```

**Features:**
- Mouse wheel zoom
- Click-drag panning
- Programmatic zoom (fit to bounds)
- Minimap viewport tracking

### Node Rendering

**Dynamic Styling:**
```typescript
// Color by node type
const colorMap = {
  'Scan': '#3b82f6',         // Blue
  'Filter': '#10b981',       // Green
  'Join': '#f59e0b',         // Orange
  'Aggregate': '#8b5cf6',    // Purple
  'Shuffle': '#ef4444',      // Red
  'Write': '#06b6d4'         // Cyan
};

// Size by data volume
const radius = d => {
  const bytes = d.bytesRead || d.bytesWritten || 0;
  const gb = bytes / (1024 ** 3);
  return Math.min(50, Math.max(20, 20 + gb / 10));
};

// Problematic node styling
if (node.isProblematic) {
  circle.attr("stroke", "red")
        .attr("stroke-width", 3)
        .attr("stroke-dasharray", "5,5");
}
```

### Link Rendering

**Edge Styling:**
```typescript
// Thickness proportional to data transfer
const strokeWidth = link => {
  if (!link.dataTransferGB) return 2;
  return Math.min(10, 2 + link.dataTransferGB / 10);
};

// Problematic links (expensive shuffles)
if (link.isProblematic) {
  line.attr("stroke", "#ef4444")
      .attr("stroke-dasharray", "5,5");
}

// Arrowhead markers
svg.append("defs").selectAll("marker")
  .data(["end"])
  .enter().append("marker")
    .attr("id", "arrowhead")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 20)
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
  .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", "#999");
```

---

## Minimap Feature

**Purpose:** Navigation aid for large DAGs (50+ nodes)

**Implementation:**
- **Location:** Bottom-right corner overlay
- **Size:** 200x150px
- **Content:** Simplified view of entire graph
- **Viewport Indicator:** Red rectangle showing current view

**Rendering:**
```typescript
// Minimap SVG (separate from main canvas)
const minimap = d3.select("#minimap-svg");

// Scale factor
const scale = 0.1; // 10% of main canvas

// Draw nodes (simplified)
minimap.selectAll("circle")
  .data(nodes)
  .join("circle")
    .attr("cx", d => d.x * scale)
    .attr("cy", d => d.y * scale)
    .attr("r", 2)
    .attr("fill", "#666");

// Draw viewport rectangle
const viewportRect = minimap.append("rect")
  .attr("stroke", "red")
  .attr("fill", "none")
  .attr("stroke-width", 1);

// Update on zoom/pan
function updateMinimap(transform) {
  const viewWidth = width / transform.k * scale;
  const viewHeight = height / transform.k * scale;
  const viewX = -transform.x / transform.k * scale;
  const viewY = -transform.y / transform.k * scale;

  viewportRect
    .attr("x", viewX)
    .attr("y", viewY)
    .attr("width", viewWidth)
    .attr("height", viewHeight);
}
```

---

## Interaction Features

### 1. Node Selection

**Click Behavior:**
```typescript
node.on("click", (event, d) => {
  event.stopPropagation();
  setSelectedNodeId(d.id);

  // Visual feedback
  d3.selectAll(".dag-node")
    .classed("selected", false)
    .attr("opacity", 0.3);

  d3.select(event.currentTarget)
    .classed("selected", true)
    .attr("opacity", 1);
});
```

**Double-Click Behavior:**
- Zoom to fit selected node and its neighbors
- Useful for focusing on specific stage

### 2. Node Hover

**Tooltip Display:**
```typescript
node.on("mouseenter", (event, d) => {
  const tooltip = d3.select("#tooltip");
  tooltip.style("display", "block")
         .html(`
           <strong>${d.label}</strong><br/>
           Type: ${d.nodeType}<br/>
           Partitions: ${d.partitions || 'N/A'}<br/>
           Data: ${formatBytes(d.bytesRead)}
         `)
         .style("left", (event.pageX + 10) + "px")
         .style("top", (event.pageY - 20) + "px");
});

node.on("mouseleave", () => {
  d3.select("#tooltip").style("display", "none");
});
```

### 3. Link Hover

**Edge Highlighting:**
```typescript
link.on("mouseenter", (event, d) => {
  d3.select(event.currentTarget)
    .attr("stroke-width", strokeWidth(d) + 2)
    .attr("stroke", "#3b82f6");

  // Show edge label
  d3.select(`#link-label-${d.source.id}-${d.target.id}`)
    .style("display", "block");
});
```

### 4. Canvas Panning

**Click-Drag on Background:**
```typescript
svg.on("mousedown", (event) => {
  if (event.target === svg.node()) {
    const startX = event.clientX;
    const startY = event.clientY;

    svg.on("mousemove", (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      // Apply transform
    });
  }
});
```

### 5. Optimization Highlighting

**Automatic Node Marking:**
```typescript
// In EnhancedDagVisualizer
const highlightedNodeIds = useMemo(() => {
  return optimizations.flatMap(opt => opt.relatedNodeIds || []);
}, [optimizations]);

// In DAGCanvas
nodes.forEach(node => {
  if (highlightedNodeIds.includes(node.id)) {
    d3.select(`#node-${node.id}`)
      .classed("problematic", true)
      .attr("stroke", "#ef4444")
      .attr("stroke-width", 3);
  }
});
```

---

## Node Types & Visual Encoding

### Node Type Definitions

| Type | Color | Icon | Description |
|------|-------|------|-------------|
| **Scan** | Blue (#3b82f6) | 📁 | Read from storage (Parquet, Delta, CSV) |
| **Filter** | Green (#10b981) | 🔍 | Row filtering (WHERE clause) |
| **Join** | Orange (#f59e0b) | 🔗 | Joining datasets |
| **Aggregate** | Purple (#8b5cf6) | 📊 | GROUP BY, SUM, COUNT operations |
| **Shuffle** | Red (#ef4444) | 🔀 | Data redistribution across partitions |
| **Write** | Cyan (#06b6d4) | 💾 | Write to storage |
| **Broadcast** | Yellow (#facc15) | 📡 | Broadcast join (small table) |
| **Sort** | Pink (#ec4899) | ⬆️ | ORDER BY operation |

### Visual Indicators

**1. Data Volume (Node Size)**
- Small node (20px radius): < 1 GB
- Medium node (35px): 1-50 GB
- Large node (50px): > 50 GB

**2. Partition Count (Badge)**
```typescript
<g class="partition-badge">
  <rect x={nodeX + 15} y={nodeY - 20}
        width={30} height={15}
        fill="#1f2937" rx={3} />
  <text x={nodeX + 30} y={nodeY - 10}
        fill="white" font-size={10}>
    {node.partitions}
  </text>
</g>
```

**3. Problem Indicator (Border)**
- Red dashed border: Problematic node
- Pulsing animation: Active optimization target

**4. Duration (Label)**
```typescript
<text y={nodeY + nodeRadius + 15}
      fill="#6b7280" font-size={10}>
  {formatDuration(node.duration)}
</text>
```

---

## Performance Optimizations

### 1. Canvas Rendering (SVG)
- **Why not Canvas API?** D3.js ecosystem, easier event handling
- **Trade-off:** SVG slower for 500+ nodes (future: WebGL transition)

### 2. Force Simulation Capping
```typescript
// Limit simulation ticks for large graphs
const alphaDecay = nodes.length > 100 ? 0.05 : 0.02;
simulation.alphaDecay(alphaDecay);

// Stop after stabilization
simulation.on("end", () => {
  console.log("Layout stabilized");
});
```

### 3. Lazy Rendering
- Only render nodes in viewport (future enhancement)
- Use virtual scrolling for 1000+ node graphs

### 4. Memoization
```typescript
// In EnhancedDagVisualizer
const processedNodes = useMemo(() => {
  return nodes.map(node => ({
    ...node,
    color: getNodeColor(node.nodeType),
    radius: calculateRadius(node)
  }));
}, [nodes]);
```

### 5. Throttled Zoom Updates
```typescript
const throttledZoom = _.throttle((transform) => {
  updateMinimap(transform);
}, 100);

zoom.on("zoom", (event) => {
  g.attr("transform", event.transform);
  throttledZoom(event.transform);
});
```

---

## Accessibility Features

### 1. Keyboard Navigation
```typescript
// Tab through nodes
document.addEventListener("keydown", (event) => {
  if (event.key === "Tab") {
    const nodes = document.querySelectorAll(".dag-node");
    const currentIndex = Array.from(nodes).indexOf(document.activeElement);
    const nextIndex = (currentIndex + 1) % nodes.length;
    nodes[nextIndex].focus();
  }
});
```

### 2. Screen Reader Support
```typescript
// ARIA labels
<circle role="button"
        aria-label={`${node.label}, ${node.nodeType}, ${node.partitions} partitions`}
        tabindex="0" />
```

### 3. High Contrast Mode
- Detect system preference
- Increase stroke widths
- Enhance color differentiation

---

## Error Handling

### 1. Empty DAG
```typescript
if (!nodes || nodes.length === 0) {
  return (
    <div className="empty-state">
      <p>No execution plan data available</p>
      <p>Submit a Spark plan for analysis to view the DAG</p>
    </div>
  );
}
```

### 2. Disconnected Components
- Repair heuristic on backend (connect orphan nodes)
- Frontend displays warning if still disconnected

### 3. Invalid Node Data
```typescript
// Defensive rendering
const safeNodes = nodes.filter(n => n.id && n.label);
const safeLinks = links.filter(l =>
  safeNodes.find(n => n.id === l.source) &&
  safeNodes.find(n => n.id === l.target)
);
```

---

## Integration with Other Features

### 1. Optimization Panel
- Clicking optimization card highlights related nodes in DAG
- Synced state via shared `selectedNodeId`

### 2. Code Mapping
- Nodes with mapped code show indicator icon
- Click to view code in NodeDetailsPanel

### 3. Chat Consultant
- Include DAG screenshot in chat context (future enhancement)
- Reference node IDs in conversation

### 4. Analysis History
- Store DAG layout positions for consistent visualization across sessions

---

## Future Enhancements

- [ ] **WebGL Rendering:** For 1000+ node graphs (using pixi.js)
- [ ] **Collapsible Sub-graphs:** Group stages by job
- [ ] **Timeline View:** Horizontal Gantt-style execution timeline
- [ ] **Diff Visualization:** Compare before/after optimization DAGs
- [ ] **Export SVG/PNG:** Download DAG as image
- [ ] **Custom Layout Algorithms:** Tree layout, hierarchical layout options
- [ ] **Real-time Updates:** Animate DAG as analysis progresses
- [ ] **3D Visualization:** WebGL 3D DAG for complex pipelines
- [ ] **Search/Filter Nodes:** Find nodes by name or type
- [ ] **Edge Bundling:** Reduce visual clutter in dense graphs
- [ ] **Minimap Interactions:** Click minimap to jump to area
- [ ] **Persistent Layout:** Save user-adjusted node positions
