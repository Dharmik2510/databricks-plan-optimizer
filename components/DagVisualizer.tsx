
import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { DagNode, DagLink } from '../types';
import { ZoomIn, ZoomOut } from 'lucide-react';

interface DagVisualizerProps {
  nodes: DagNode[];
  links: DagLink[];
}

// Extend D3 Simulation Node
interface SimulationNode extends d3.SimulationNodeDatum, DagNode {
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export const DagVisualizer: React.FC<DagVisualizerProps> = ({ nodes, links }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Memoize the level computation to avoid recalculating on every render
  const levels = useMemo(() => {
    const adjacency = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    
    nodes.forEach(n => {
      adjacency.set(n.id, []);
      inDegree.set(n.id, 0);
    });

    links.forEach(l => {
      adjacency.get(l.source)?.push(l.target);
      inDegree.set(l.target, (inDegree.get(l.target) || 0) + 1);
    });

    const lvlMap = new Map<string, number>();
    const queue: string[] = [];

    // Find sources
    nodes.forEach(n => {
      if ((inDegree.get(n.id) || 0) === 0) {
        lvlMap.set(n.id, 0);
        queue.push(n.id);
      }
    });

    // BFS for topological layering
    while (queue.length > 0) {
      const u = queue.shift()!;
      const currentLevel = lvlMap.get(u)!;
      
      const neighbors = adjacency.get(u) || [];
      for (const v of neighbors) {
        const existingLevel = lvlMap.get(v) || -1;
        if (currentLevel + 1 > existingLevel) {
           lvlMap.set(v, currentLevel + 1);
           queue.push(v);
        }
      }
    }
    
    nodes.forEach(n => {
        if (!lvlMap.has(n.id)) lvlMap.set(n.id, 0);
    });

    return lvlMap;
  }, [nodes, links]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || nodes.length === 0) return;

    const width = containerRef.current.clientWidth;
    const height = 600;

    // Clear previous SVG content
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .style("cursor", "grab");

    // Define Arrowhead Marker - Dark Gray for Light Theme
    const defs = svg.append("defs");
    defs.append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 32)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#64748b"); // Slate 500

    const g = svg.append("g");

    // Initialize Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        setZoomLevel(event.transform.k);
      });

    svg.call(zoom);
    svg.call(zoom.transform, d3.zoomIdentity.translate(50, height / 2).scale(0.8));

    // Prepare Simulation Data
    const simNodes: SimulationNode[] = nodes.map(n => ({
      ...n,
      x: (levels.get(n.id) || 0) * 200, 
      y: height / 2 + (Math.random() - 0.5) * 100 
    }));

    const simLinks = links.map(l => ({ ...l }));

    // Configure Simulation
    const simulation = d3.forceSimulation<SimulationNode>(simNodes)
      .force("link", d3.forceLink(simLinks).id((d: any) => d.id).distance(180))
      .force("charge", d3.forceManyBody().strength(-1500)) 
      .force("collide", d3.forceCollide().radius(80)) 
      .force("x", d3.forceX((d: any) => (levels.get(d.id) || 0) * 220).strength(1.5)) 
      .force("y", d3.forceY(height / 2).strength(0.15)); 

    // Draw Links
    const link = g.append("g")
      .attr("stroke", "#cbd5e1") // Slate 300
      .attr("stroke-opacity", 0.8)
      .selectAll("path")
      .data(simLinks)
      .join("path")
      .attr("stroke-width", 2)
      .attr("fill", "none")
      .attr("marker-end", "url(#arrowhead)");

    // Draw Nodes Group
    const node = g.append("g")
      .selectAll("g")
      .data(simNodes)
      .join("g")
      .call(d3.drag<SVGGElement, SimulationNode>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    // Node Background Circle - Updated for Light Theme Visibility
    node.append("circle")
      .attr("r", 28)
      .attr("fill", (d) => {
         const t = d.type.toLowerCase();
         if (t.includes('shuffle') || t.includes('exchange')) return '#fee2e2'; // Red 100
         if (t.includes('scan') || t.includes('read')) return '#dcfce7'; // Green 100
         if (t.includes('join')) return '#fef3c7'; // Amber 100
         if (t.includes('filter') || t.includes('project')) return '#cffafe'; // Cyan 100
         return '#f1f5f9'; // Slate 100
      })
      .attr("stroke-width", 2)
      .attr("stroke", (d) => {
        const t = d.type.toLowerCase();
        if (t.includes('shuffle') || t.includes('exchange')) return '#ef4444'; 
        if (t.includes('scan') || t.includes('read')) return '#22c55e'; 
        if (t.includes('join')) return '#f59e0b'; 
        if (t.includes('filter') || t.includes('project')) return '#06b6d4'; 
        return '#94a3b8';
      });

    // Inner Node Dot
    node.append("circle")
      .attr("r", 6)
      .attr("fill", (d) => {
        const t = d.type.toLowerCase();
        if (t.includes('shuffle') || t.includes('exchange')) return '#ef4444';
        if (t.includes('scan') || t.includes('read')) return '#22c55e';
        if (t.includes('join')) return '#f59e0b';
        if (t.includes('filter') || t.includes('project')) return '#06b6d4';
        return '#cbd5e1';
      });

    // Node Label - Dark Text with White Halo
    node.append("text")
      .attr("x", 0)
      .attr("y", -40)
      .attr("text-anchor", "middle")
      .text((d) => d.name)
      .attr("font-weight", "600")
      .attr("font-size", "12px")
      .attr("fill", "#1e293b") // Slate 800
      .style("pointer-events", "none")
      .style("paint-order", "stroke")
      .style("stroke", "#ffffff")
      .style("stroke-width", "3px")
      .style("stroke-linecap", "butt")
      .style("stroke-linejoin", "miter")
      .call(getWrapText);

    // Metric Label
    node.append("text")
      .attr("x", 0)
      .attr("y", 45)
      .attr("text-anchor", "middle")
      .text((d) => d.metric || "")
      .attr("font-size", "10px")
      .attr("fill", "#64748b") // Slate 500
      .style("pointer-events", "none");

    // Curved Links
    function linkArc(d: any) {
      const dx = d.target.x - d.source.x;
      const dy = d.target.y - d.source.y;
      if (Math.abs(dy) < 20) {
         return `M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`;
      }
      return `M${d.source.x},${d.source.y}C${d.source.x + dx/2},${d.source.y} ${d.source.x + dx/2},${d.target.y} ${d.target.x},${d.target.y}`;
    }

    // Text Wrapping Helper
    function getWrapText(selection: any) {
       selection.each(function(this: any, d: any) {
          if (d.name.length > 18) {
             d3.select(this).text(d.name.substring(0, 16) + "...");
          }
       });
    }

    // Tick Function
    simulation.on("tick", () => {
      link.attr("d", linkArc);
      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    // Drag Handlers
    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
      svg.style("cursor", "grabbing");
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
      svg.style("cursor", "grab");
    }

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [nodes, links, levels]);

  const handleZoom = (factor: number) => {
     if (!svgRef.current) return;
     const svg = d3.select(svgRef.current);
     const zoom: any = d3.zoom().on("zoom", (event) => {
        d3.select(svgRef.current).select("g").attr("transform", event.transform);
        setZoomLevel(event.transform.k);
     });
     svg.transition().duration(500).call(zoom.scaleBy, factor);
  };

  return (
    <div ref={containerRef} className="w-full bg-white/70 backdrop-blur-2xl rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden flex flex-col h-[600px] relative group">
      
      <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center flex-shrink-0">
        <h3 className="font-bold text-slate-900 text-lg">Execution Plan Flow</h3>
        <div className="flex items-center gap-3">
           <div className="flex gap-3 mr-4 border-r border-slate-300 pr-4 hidden sm:flex">
               <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                 <span className="w-2 h-2 rounded-full bg-green-500"></span> Scan
               </div>
               <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                 <span className="w-2 h-2 rounded-full bg-red-500"></span> Shuffle
               </div>
               <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                 <span className="w-2 h-2 rounded-full bg-cyan-500"></span> Transform
               </div>
           </div>
           <div className="flex bg-white rounded-lg border border-slate-300 shadow-sm">
              <button onClick={() => handleZoom(1.2)} className="p-2 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"><ZoomIn className="w-4 h-4" /></button>
              <button onClick={() => handleZoom(0.8)} className="p-2 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border-l border-slate-200 transition-colors"><ZoomOut className="w-4 h-4" /></button>
           </div>
        </div>
      </div>
      <div className="flex-1 relative overflow-hidden bg-slate-50/30">
         {/* Grid Background */}
         <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
         <svg ref={svgRef} className="w-full h-full block relative z-10"></svg>
      </div>
    </div>
  );
};
