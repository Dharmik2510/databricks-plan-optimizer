
import React, { useRef, useEffect } from 'react';

interface MinimapProps {
    nodes: any[];
    width: number; // Of minimap
    height: number;
    viewX: number; // Viewport position
    viewY: number;
    zoom: number;
    contentWidth: number; // Actual DAG dimensions
    contentHeight: number;
    onNavigate: (x: number, y: number) => void;
    theme: 'light' | 'dark';
}

export const DAGMinimap: React.FC<MinimapProps> = ({
    nodes, width, height, viewX, viewY, zoom, contentWidth, contentHeight, onNavigate, theme
}) => {
    const isDark = theme === 'dark';
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Calculate scale to fit content into minimap
    const scale = Math.min(width / contentWidth, height / contentHeight);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear
        ctx.clearRect(0, 0, width, height);

        // Draw Nodes
        ctx.fillStyle = isDark ? 'rgba(99, 102, 241, 0.4)' : 'rgba(99, 102, 241, 0.3)';
        nodes.forEach(node => {
            // Map node pos to minimap pos
            // Note: Node positions in main DAG might be offset by zoom/pan logic
            // We assume node.x and node.y are absolute absolute coordinates 
            const mx = node.x * scale + width / 2 - (contentWidth * scale) / 2; // Center it
            const my = node.y * scale;

            ctx.beginPath();
            ctx.arc(mx, my, 4, 0, Math.PI * 2);
            ctx.fill();
        });

        // Draw Viewport Rect
        // The viewX/viewY from d3 zoom transform are typically: tx, ty
        // transform(x) = x * k + tx
        // visible area starts at -tx/k, -ty/k
        // visible width = clientWidth / k

        const viewportW = (width / scale) / zoom; // Approximation
        const viewportH = (height / scale) / zoom;

        // Invert d3 transform
        const vx = (-viewX / zoom) * scale + width / 2 - (contentWidth * scale) / 2;
        const vy = (-viewY / zoom) * scale;
        const vw = (window.innerWidth / zoom) * scale * 0.2; // roughly relative to window
        const vh = (window.innerHeight / zoom) * scale * 0.2;

        ctx.strokeStyle = isDark ? '#fff' : '#000';
        ctx.lineWidth = 1;
        ctx.strokeRect(vx, vy, vw, vh);

    }, [nodes, width, height, viewX, viewY, zoom, contentWidth, contentHeight, isDark, scale]);

    return (
        <div
            className="absolute bottom-4 right-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden pointer-events-none"
            style={{ width, height }}
        >
            <canvas ref={canvasRef} width={width} height={height} />
        </div>
    );
};
