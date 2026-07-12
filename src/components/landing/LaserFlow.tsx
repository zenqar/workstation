import { useEffect, useRef, type CSSProperties } from 'react';
import * as THREE from 'three';
import './LaserFlow.css';

const VERT = `precision highp float; attribute vec3 position; void main(){ gl_Position = vec4(position, 1.0);} `;
const FRAG = `precision highp float; precision mediump int; uniform float iTime; uniform vec3 iResolution; uniform vec4 iMouse; uniform float uBeamXFrac; uniform float uBeamYFrac; uniform float uFlowSpeed; uniform float uVLenFactor; uniform float uHLenFactor; uniform float uFogIntensity; uniform float uFogScale; uniform vec3 uColor; uniform float uFade; float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); } float noise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f); float a=hash(i); float b=hash(i+vec2(1.,0.)); float c=hash(i+vec2(0.,1.)); float d=hash(i+vec2(1.,1.)); return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);} float fbm(vec2 p){ float v=0.; float a=.5; mat2 m=mat2(.8,.6,-.6,.8); for(int i=0;i<5;i++){ v += a*noise(p); p = m*p*2.; a *= .55; } return v; } void main(){ vec2 uv = gl_FragCoord.xy / iResolution.xy; vec2 centered = (uv - .5) * vec2(iResolution.x / iResolution.y, 1.0); float beamX = mix(-.2, .2, uBeamXFrac); float beamY = uBeamYFrac; float beam = exp(-abs(centered.x - beamX) * (8.0 / max(uHLenFactor, .1))) * exp(-(centered.y + beamY + .15) * (2.2 / max(uVLenFactor, .1))); float flow = fbm(vec2(centered.x * 3. + iTime * uFlowSpeed, centered.y * 5. - iTime * .15)); float haze = fbm(centered * (4.0 * max(uFogScale,.1)) + iTime * .08); float pulse = .65 + .35 * sin(iTime * 1.5 + centered.y * 8.0); float laser = beam * (1.0 + flow * .8) * pulse; float fog = haze * uFogIntensity * beam * 1.8; vec3 col = (laser + fog) * uColor; float alpha = clamp((laser * .8 + fog * .35) * uFade, 0.0, 1.0); gl_FragColor = vec4(col, alpha); }`;

type LaserFlowProps = {
  className?: string;
  style?: CSSProperties;
  horizontalBeamOffset?: number;
  verticalBeamOffset?: number;
  flowSpeed?: number;
  verticalSizing?: number;
  horizontalSizing?: number;
  fogIntensity?: number;
  fogScale?: number;
  color?: string;
  dpr?: number;
};

const LaserFlow = ({ className, style, horizontalBeamOffset = 0.1, verticalBeamOffset = 0.0, flowSpeed = 0.35, verticalSizing = 2.0, horizontalSizing = 0.5, fogIntensity = 0.45, fogScale = 0.3, color = '#FF79C6', dpr }: LaserFlowProps) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, depth: false, stencil: false, powerPreference: 'high-performance', premultipliedAlpha: false });
    } catch (error) {
      console.warn('[LaserFlow] WebGL is unavailable; using the static landing background.', error);
      return;
    }
    const maxPixelRatio = window.innerWidth < 768 ? 1.25 : 1.75;
    renderer.setPixelRatio(Math.min(dpr ?? (window.devicePixelRatio || 1), maxPixelRatio)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setClearColor(0x000000, 0);
    const canvas = renderer.domElement; canvas.style.width = '100%'; canvas.style.height = '100%'; canvas.style.display = 'block'; mount.appendChild(canvas);
    const scene = new THREE.Scene(); const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const uniforms = { iTime: { value: 0 }, iResolution: { value: new THREE.Vector3(1, 1, 1) }, iMouse: { value: new THREE.Vector4(0, 0, 0, 0) }, uBeamXFrac: { value: horizontalBeamOffset }, uBeamYFrac: { value: verticalBeamOffset }, uFlowSpeed: { value: flowSpeed }, uVLenFactor: { value: verticalSizing }, uHLenFactor: { value: horizontalSizing }, uFogIntensity: { value: fogIntensity }, uFogScale: { value: fogScale }, uColor: { value: new THREE.Vector3(1, 1, 1) }, uFade: { value: 0 } };
    const material = new THREE.RawShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, depthTest: false, depthWrite: false, blending: THREE.NormalBlending });
    const mesh = new THREE.Mesh(geometry, material); mesh.frustumCulled = false; scene.add(mesh);
    const resize = () => { const w = mount.clientWidth || 1, h = mount.clientHeight || 1, pr = Math.min(dpr ?? (window.devicePixelRatio || 1), maxPixelRatio); renderer.setPixelRatio(pr); renderer.setSize(w, h, false); uniforms.iResolution.value.set(w * pr, h * pr, pr); };
    resize(); const ro = new ResizeObserver(resize); ro.observe(mount);
    const rgb = ((hex: string) => { let c = hex.replace('#',''); if (c.length===3) c = c.split('').map(x => x+x).join(''); const n = parseInt(c,16)||0xffffff; return [((n>>16)&255)/255, ((n>>8)&255)/255, (n&255)/255]; })(color); uniforms.uColor.value.set(rgb[0], rgb[1], rgb[2]);
    const timer = new THREE.Timer();
    timer.connect(document);
    let raf = 0;
    let inViewport = true;
    const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };
    const animate = (timestamp: number) => { timer.update(timestamp); uniforms.iTime.value = timer.getElapsed(); uniforms.uFade.value = Math.min(1, uniforms.uFade.value + 0.02); renderer.render(scene, camera); raf = requestAnimationFrame(animate); };
    const start = () => { if (!raf && inViewport && !document.hidden) { timer.reset(); raf = requestAnimationFrame(animate); } };
    const observer = new IntersectionObserver(([entry]) => {
      inViewport = entry?.isIntersecting ?? false;
      if (inViewport) start(); else stop();
    }, { rootMargin: '160px' });
    const handleVisibility = () => { if (document.hidden) stop(); else start(); };
    observer.observe(mount);
    document.addEventListener('visibilitychange', handleVisibility);
    start();
    return () => { stop(); observer.disconnect(); document.removeEventListener('visibilitychange', handleVisibility); timer.dispose(); ro.disconnect(); geometry.dispose(); material.dispose(); renderer.dispose(); renderer.forceContextLoss(); if (mount.contains(canvas)) mount.removeChild(canvas); };
  }, [horizontalBeamOffset, verticalBeamOffset, flowSpeed, verticalSizing, horizontalSizing, fogIntensity, fogScale, color, dpr]);
  return <div ref={mountRef} className={`laser-flow-container ${className || ''}`} style={style} />;
};

export default LaserFlow;
