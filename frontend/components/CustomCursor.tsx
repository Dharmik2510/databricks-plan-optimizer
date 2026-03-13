import React, { useEffect, useRef } from 'react';

const LERP = 0.12;
const HOVERABLE = 'a, button, [role="button"], label, input[type="submit"], input[type="button"], select';

export const CustomCursor: React.FC = () => {
    const dotRef = useRef<HTMLDivElement>(null);
    const ringRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const dot = dotRef.current;
        const ring = ringRef.current;
        if (!dot || !ring) return;

        let mouseX = -100;
        let mouseY = -100;
        let ringX = -100;
        let ringY = -100;
        let hovering = false;
        let rafId = 0;

        const onMouseMove = (e: MouseEvent) => {
            mouseX = e.clientX;
            mouseY = e.clientY;

            const target = e.target as Element | null;
            hovering = !!target?.closest(HOVERABLE);
        };

        const tick = () => {
            // Dot snaps instantly
            dot.style.transform = `translate(${mouseX - 4}px, ${mouseY - 4}px)`;

            // Ring lerps
            ringX += (mouseX - ringX) * LERP;
            ringY += (mouseY - ringY) * LERP;
            ring.style.transform = `translate(${ringX - 18}px, ${ringY - 18}px)`;

            if (hovering) {
                dot.classList.add('cursor-hover');
                ring.classList.add('cursor-hover');
            } else {
                dot.classList.remove('cursor-hover');
                ring.classList.remove('cursor-hover');
            }

            rafId = requestAnimationFrame(tick);
        };

        document.addEventListener('mousemove', onMouseMove);
        rafId = requestAnimationFrame(tick);

        return () => {
            document.removeEventListener('mousemove', onMouseMove);
            cancelAnimationFrame(rafId);
        };
    }, []);

    return (
        <>
            <style>{`
                * { cursor: none !important; }

                .cursor-dot {
                    position: fixed;
                    top: 0; left: 0;
                    width: 8px; height: 8px;
                    border-radius: 50%;
                    background: #00D4FF;
                    pointer-events: none;
                    z-index: 9999;
                    will-change: transform;
                    transition: width 0.15s, height 0.15s, background 0.15s, margin 0.15s;
                }
                .cursor-dot.cursor-hover {
                    width: 12px;
                    height: 12px;
                    background: #E8431A;
                    margin: -2px 0 0 -2px;
                }

                .cursor-ring {
                    position: fixed;
                    top: 0; left: 0;
                    width: 36px; height: 36px;
                    border-radius: 50%;
                    border: 1.5px solid #00D4FF;
                    pointer-events: none;
                    z-index: 9998;
                    will-change: transform;
                    transition: width 0.2s, height 0.2s, border-color 0.2s, margin 0.2s;
                    opacity: 0.7;
                }
                .cursor-ring.cursor-hover {
                    width: 52px;
                    height: 52px;
                    border-color: #E8431A;
                    margin: -8px 0 0 -8px;
                    opacity: 1;
                }
            `}</style>
            <div ref={dotRef} className="cursor-dot" />
            <div ref={ringRef} className="cursor-ring" />
        </>
    );
};

export default CustomCursor;
