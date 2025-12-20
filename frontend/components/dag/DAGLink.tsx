
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface DAGLinkProps {
    source: { x: number; y: number };
    target: { x: number; y: number };
    theme: 'light' | 'dark';
    isHighlighted: boolean;
    isBottleneck: boolean;
    flowRate?: number; // 0 to 1, determines particle speed/density
}

export const DAGLink: React.FC<DAGLinkProps> = ({ source, target, theme, isHighlighted, isBottleneck, flowRate = 0.5 }) => {
    const pathRef = useRef<SVGPathElement>(null);
    const isDark = theme === 'dark';

    // Calculate Bezier Curve
    // Vertical layout: Source is top, Target is bottom
    // We offset y to connect to bottom of source and top of target
    const sx = source.x;
    const sy = source.y + 40; // Approx node height/2
    const tx = target.x;
    const ty = target.y - 40;

    const dy = ty - sy;
    const c1y = sy + dy * 0.4;
    const c2y = ty - dy * 0.4;

    const pathD = `M${sx},${sy} C${sx},${c1y} ${tx},${c2y} ${tx},${ty}`;

    const defaultColor = isDark ? '#334155' : '#cbd5e1';
    const highlightColor = isDark ? '#6366f1' : '#4f46e5';
    const errorColor = '#ef4444';

    const strokeColor = isBottleneck ? errorColor : (isHighlighted ? highlightColor : defaultColor);
    const strokeWidth = isHighlighted ? 3 : 2;
    const opacity = isHighlighted ? 1 : 0.4;

    return (
        <g className="dag-link">
            {/* Base Path */}
            <path
                d={pathD}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeOpacity={opacity}
                strokeLinecap="round"
            />

            {/* Animated Flow Particles - Only if highlighted or bottleneck to save perf */}
            {(isHighlighted || isBottleneck) && (
                <>
                    <circle r="3" fill={isBottleneck ? errorColor : highlightColor}>
                        <animateMotion
                            dur={`${2 - flowRate}s`}
                            repeatCount="indefinite"
                            path={pathD}
                            calcMode="linear"
                            keyPoints="0;1"
                            keyTimes="0;1"
                        />
                    </circle>
                    <circle r="2" fill={isBottleneck ? errorColor : highlightColor} opacity="0.6">
                        <animateMotion
                            dur={`${2.5 - flowRate}s`}
                            repeatCount="indefinite"
                            path={pathD}
                            calcMode="linear"
                            keyPoints="0;1"
                            keyTimes="0;1"
                            begin="0.5s"
                        />
                    </circle>
                </>
            )}
        </g>
    );
};
