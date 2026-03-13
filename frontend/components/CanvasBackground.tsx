import React, { useEffect, useRef } from 'react';

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    baseOpacity: number;
    type: 'brick' | 'dot';
    phase: number;
}

const PARTICLE_COUNT = 60;
const CONNECTION_DIST = 120;
const PULSE_SPEED = 0.018;

export const CanvasBackground: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = 0;
        let height = 0;
        let rafId = 0;

        const resize = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => ({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            size: Math.random() * 2.5 + 1,
            baseOpacity: Math.random() * 0.35 + 0.08,
            type: Math.random() > 0.7 ? 'brick' : 'dot',
            phase: Math.random() * Math.PI * 2,
        }));

        const draw = () => {
            ctx.clearRect(0, 0, width, height);

            // Connection lines
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const d = Math.sqrt(dx * dx + dy * dy);
                    if (d < CONNECTION_DIST) {
                        ctx.beginPath();
                        ctx.strokeStyle = `rgba(0,212,255,${(1 - d / CONNECTION_DIST) * 0.09})`;
                        ctx.lineWidth = 0.5;
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.stroke();
                    }
                }
            }

            // Particles
            for (const p of particles) {
                p.x += p.vx;
                p.y += p.vy;
                p.phase += PULSE_SPEED;

                if (p.x < -20) p.x = width + 20;
                else if (p.x > width + 20) p.x = -20;
                if (p.y < -20) p.y = height + 20;
                else if (p.y > height + 20) p.y = -20;

                const op = p.baseOpacity * (0.7 + 0.3 * Math.sin(p.phase));

                if (p.type === 'brick') {
                    const s = p.size * 2.4;
                    ctx.fillStyle = `rgba(232,67,26,${op})`;
                    ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s * 0.55);
                } else {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(0,212,255,${op})`;
                    ctx.fill();
                }
            }

            rafId = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(rafId);
        };
    }, []);

    return (
        <>
            {/* CSS data-centre grid overlay */}
            <div
                style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundImage:
                        'linear-gradient(rgba(0,212,255,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.055) 1px, transparent 1px)',
                    backgroundSize: '60px 60px',
                    pointerEvents: 'none',
                    zIndex: 0,
                }}
            />
            <canvas
                ref={canvasRef}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    zIndex: 1,
                    pointerEvents: 'none',
                }}
            />
        </>
    );
};

export default CanvasBackground;
