# DAG Interaction Flow: "View in DAG"

This document explains the technical implementation of the "View in DAG" feature, which allows users to navigate from an optimization recommendation directly to the relevant stage in the visual execution plan.

The implementation relies on a chain of state updates that propagates from the top-level application down to the D3 rendering engine.

## 1. The Trigger: Identifying the Target (`App.tsx`)

The process begins in the `App.tsx` component. The `OptimizationPanel` triggers the `onViewInDag` callback when the button is clicked.

**Key Actions:**
1.  **State Update (Expansion):** We set `dagExpanded` to `true`, forcing the DAG visualizer to enter full-screen mode via React Portals.
2.  **Node Resolving:** We take the `affected_stages` from the optimization object and search the `dagNodes` array for a matching ID.
3.  **State Update (Selection):** We update `selectedNodeId` with the ID of the matched node.

```typescript
// App.tsx
onViewInDag={(opt) => {
    // 1. Force expansion
    setDagExpanded(true); 

    // 2. Resolve the abstract stage name to a concrete Node ID
    if (opt.affected_stages && opt.affected_stages.length > 0) {
        const targetStage = opt.affected_stages[0];
        // "Stage 55" -> "node_55_hash..."
        const matchingNode = result.dagNodes.find(n => n.id.includes(targetStage));
        
        // 3. Update selection state
        if (matchingNode) {
            setSelectedNodeId(matchingNode.id); 
        }
    }
    
    // 4. Ensure the container is in view (for non-expanded mode)
    setTimeout(() => {
        const element = document.getElementById('dag-visualizer-section');
        if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}}
```

## 2. The Bridge: Passing Props (`EnhancedDagVisualizer.tsx`)

The `EnhancedDagVisualizer` acts as a pass-through component. It was updated to accept the controlled state props and forward them to the underlying canvas.

```typescript
// EnhancedDagVisualizer.tsx
export const EnhancedDagVisualizer: React.FC<Props> = ({ 
  // ...
  highlightedNodeId, // Prop received from App
  onSelectNode       // Callback received from App
}) => {
  return (
    <DAGCanvas 
      // ...
      highlightedNodeId={highlightedNodeId} // Passed down to Canvas
      onSelectNode={onSelectNode}
    />
  );
};
```

## 3. The Reaction: D3 Animation (`DAGCanvas.tsx`)

This is where the React state meets the D3 imperative animation API. We use a `useEffect` hook that listens specifically for changes to `selectedNodeId`.

**The Animation Sequence:**
1.  **Lookup:** Find the `(x, y)` coordinates of the selected node in the calculated layout.
2.  **Calculate Center:** Determine the translate vector required to move that node to the center of the viewport based on the current container dimensions.
3.  **Transition:** Use `d3.transition()` to interpolate the pan and zoom values over 750ms.

```typescript
// DAGCanvas.tsx
useEffect(() => {
    // Only run if we have a valid selection and references
    if (selectedNodeId && containerRef.current && zoomRef.current) {
        
        const node = layout.nodes.find(n => n.id === selectedNodeId);
        if (node) {
             const scale = 1.2; // Target zoom level
             
             // Calculate center position
             // container_center - (node_position * scale)
             const x = -node.x * scale + (containerRef.current.clientWidth / 2);
             const y = -node.y * scale + (containerRef.current.clientHeight / 2);
             
             // Execute D3 Transition
             d3.select(containerRef.current)
               .transition()
               .duration(750) // Duration in ms
               .call(
                   zoomRef.current.transform, 
                   d3.zoomIdentity.translate(x, y).scale(scale)
               );
        }
    }
}, [selectedNodeId, isExpanded, layout.nodes]); // Re-run when selection changes
```

## Summary

The feature works by lifting the selection state up to the parent `App` component, allowing it to coordinate two disparate UI elements: the HTML-based `OptimizationCard` and the SVG/D3-based `DAGCanvas`.
