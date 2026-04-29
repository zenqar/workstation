import { useEffect, useRef, useCallback } from 'react';
import './ElectricBorder.css';

const ElectricBorder = ({ children, color = '#5227FF', speed = 1, chaos = 0.12, borderRadius = 24, className, style }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animationRef = useRef(null);
  const timeRef = useRef(0);
  const lastFrameTimeRef = useRef(0);

  const random = useCallback(x => (Math.sin(x * 12.9898) * 43758.5453) % 1, []);
  const noise2D = useCallback((x, y) => {
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
    const a = random(i + j * 57), b = random(i + 1 + j * 57), c = random(i + (j + 1) * 57), d = random(i + 1 + (j + 1) * 57);
    const ux = fx * fx * (3.0 - 2.0 * fx), uy = fy * fy * (3.0 - 2.0 * fy);
    return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
  }, [random]);
  const octavedNoise = useCallback((x, octaves, lacunarity, gain, baseAmplitude, baseFrequency, time, seed, baseFlatness) => {
    let y = 0, amplitude = baseAmplitude, frequency = baseFrequency;
    for (let i = 0; i < octaves; i++) {
      let octaveAmplitude = amplitude;
      if (i === 0) octaveAmplitude *= baseFlatness;
      y += octaveAmplitude * noise2D(frequency * x + seed * 100, time * frequency * 0.3);
      frequency *= lacunarity; amplitude *= gain;
    }
    return y;
  }, [noise2D]);
  const getCornerPoint = useCallback((centerX, centerY, radius, startAngle, arcLength, progress) => {
    const angle = startAngle + progress * arcLength;
    return { x: centerX + radius * Math.cos(angle), y: centerY + radius * Math.sin(angle) };
  }, []);
  const getRoundedRectPoint = useCallback((t, left, top, width, height, radius) => {
    const straightWidth = width - 2 * radius, straightHeight = height - 2 * radius, cornerArc = (Math.PI * radius) / 2;
    const totalPerimeter = 2 * straightWidth + 2 * straightHeight + 4 * cornerArc, distance = t * totalPerimeter;
    let accumulated = 0;
    if (distance <= accumulated + straightWidth) return { x: left + radius + ((distance - accumulated) / straightWidth) * straightWidth, y: top };
    accumulated += straightWidth;
    if (distance <= accumulated + cornerArc) return getCornerPoint(left + width - radius, top + radius, radius, -Math.PI / 2, Math.PI / 2, (distance - accumulated) / cornerArc);
    accumulated += cornerArc;
    if (distance <= accumulated + straightHeight) return { x: left + width, y: top + radius + ((distance - accumulated) / straightHeight) * straightHeight };
    accumulated += straightHeight;
    if (distance <= accumulated + cornerArc) return getCornerPoint(left + width - radius, top + height - radius, radius, 0, Math.PI / 2, (distance - accumulated) / cornerArc);
    accumulated += cornerArc;
    if (distance <= accumulated + straightWidth) return { x: left + width - radius - ((distance - accumulated) / straightWidth) * straightWidth, y: top + height };
    accumulated += straightWidth;
    if (distance <= accumulated + cornerArc) return getCornerPoint(left + radius, top + height - radius, radius, Math.PI / 2, Math.PI / 2, (distance - accumulated) / cornerArc);
    accumulated += cornerArc;
    if (distance <= accumulated + straightHeight) return { x: left, y: top + height - radius - ((distance - accumulated) / straightHeight) * straightHeight };
    accumulated += straightHeight;
    return getCornerPoint(left + radius, top + radius, radius, Math.PI, Math.PI / 2, (distance - accumulated) / cornerArc);
  }, [getCornerPoint]);

  useEffect(() => {
    const canvas = canvasRef.current, container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const octaves = 10, lacunarity = 1.6, gain = 0.7, amplitude = chaos, frequency = 10, baseFlatness = 0, displacement = 60, borderOffset = 60;
    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const width = rect.width + borderOffset * 2, height = rect.height + borderOffset * 2, dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr; canvas.height = height * dpr; canvas.style.width = `${width}px`; canvas.style.height = `${height}px`; ctx.scale(dpr, dpr); return { width, height };
    };
    let { width, height } = updateSize();
    const drawElectricBorder = currentTime => {
      const deltaTime = (currentTime - lastFrameTimeRef.current) / 1000; timeRef.current += deltaTime * speed; lastFrameTimeRef.current = currentTime;
      const dpr = Math.min(window.devicePixelRatio || 1, 2); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.scale(dpr, dpr);
      ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const left = borderOffset, top = borderOffset, borderWidth = width - 2 * borderOffset, borderHeight = height - 2 * borderOffset, maxRadius = Math.min(borderWidth, borderHeight) / 2, radius = Math.min(borderRadius, maxRadius);
      const approximatePerimeter = 2 * (borderWidth + borderHeight) + 2 * Math.PI * radius, sampleCount = Math.floor(approximatePerimeter / 2);
      ctx.beginPath();
      for (let i = 0; i <= sampleCount; i++) {
        const progress = i / sampleCount, point = getRoundedRectPoint(progress, left, top, borderWidth, borderHeight, radius);
        const xNoise = octavedNoise(progress * 8, octaves, lacunarity, gain, amplitude, frequency, timeRef.current, 0, baseFlatness);
        const yNoise = octavedNoise(progress * 8, octaves, lacunarity, gain, amplitude, frequency, timeRef.current, 1, baseFlatness);
        const displacedX = point.x + xNoise * displacement, displacedY = point.y + yNoise * displacement;
        if (i === 0) ctx.moveTo(displacedX, displacedY); else ctx.lineTo(displacedX, displacedY);
      }
      ctx.closePath(); ctx.stroke(); animationRef.current = requestAnimationFrame(drawElectricBorder);
    };
    const resizeObserver = new ResizeObserver(() => { const newSize = updateSize(); width = newSize.width; height = newSize.height; });
    resizeObserver.observe(container); animationRef.current = requestAnimationFrame(drawElectricBorder);
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); resizeObserver.disconnect(); };
  }, [color, speed, chaos, borderRadius, octavedNoise, getRoundedRectPoint]);

  const vars = { '--electric-border-color': color, borderRadius };
  return <div ref={containerRef} className={`electric-border ${className ?? ''}`} style={{ ...vars, ...style }}><div className="eb-canvas-container"><canvas ref={canvasRef} className="eb-canvas" /></div><div className="eb-layers"><div className="eb-glow-1" /><div className="eb-glow-2" /><div className="eb-background-glow" /></div><div className="eb-content">{children}</div></div>;
};

export default ElectricBorder;
