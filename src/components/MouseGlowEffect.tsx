'use client';

import { useEffect } from 'react';

export default function MouseGlowEffect() {
  useEffect(() => {
    const glow = document.getElementById('mouseGlow');
    const lights = document.querySelectorAll('.mouse-light') as NodeListOf<HTMLElement>;

    function onMove(e: MouseEvent) {
      if (glow) {
        glow.style.left = e.clientX + 'px';
        glow.style.top = e.clientY + 'px';
      }
      for (let i = 0; i < lights.length; i++) {
        const el = lights[i];
        const parent = el.parentElement;
        if (!parent) continue;
        const rect = parent.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        el.style.background = 'radial-gradient(500px circle at ' + x + 'px ' + y + 'px, rgba(255,255,255,0.04) 0%, transparent 50%)';
      }
    }

    document.addEventListener('mousemove', onMove);
    return () => document.removeEventListener('mousemove', onMove);
  }, []);

  return <div id="mouseGlow" />;
}
