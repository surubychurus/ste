import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';

const INK = [0x29 / 255, 0, 0];
const ACCENT = [0xd6 / 255, 0x5c / 255, 0];

const vertex = /* glsl */ `
  uniform float uTime;
  uniform float uTemp;
  uniform float uPx;
  uniform float uSound;
  varying float vN;
  void main() {
    vec3 p = position;
    float t = uTime * (0.4 + uTemp * 1.6);
    float n = sin(p.x * 2.1 + t) * sin(p.y * 2.4 + t * 1.13) * sin(p.z * 1.9 + t * 0.87);
    p += normal * n * (0.04 + uTemp * 0.30 + uSound * 0.12);
    vN = n * 0.5 + 0.5;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uPx * (1.6 + uTemp * 1.4) * (4.2 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uInk;
  uniform vec3 uAccent;
  uniform float uTemp;
  varying float vN;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    if (dot(c, c) > 0.25) discard;
    float k = smoothstep(0.35, 0.95, uTemp * 0.65 + vN * 0.45);
    gl_FragColor = vec4(mix(uInk, uAccent, k), 1.0);
  }
`;

/**
 * Esfera de puntos que respira con la temperatura (amplitud, velocidad, color)
 * y un núcleo cuyo tamaño/opacidad sigue la luz.
 * temp y light llegan normalizados 0..1 dentro de `target`.
 */
export default function Orb({ target }) {
  const host = useRef(null);
  const smooth = useRef({ temp: 0.3, light: 0.3, sound: 0 });

  // Suaviza los cambios con GSAP
  useEffect(() => {
    if (!target) return;
    const tween = gsap.to(smooth.current, {
      temp: target.temp,
      light: target.light,
      sound: target.sound,
      duration: 1,
      ease: 'power2.out',
      overwrite: true,
    });
    return () => tween.kill();
  }, [target]);

  useEffect(() => {
    const el = host.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
    camera.position.z = 5.2;

    const tilt = new THREE.Group(); // parallax del mouse
    const spin = new THREE.Group(); // giro propio
    tilt.add(spin);
    scene.add(tilt);

    // Puntos
    const geo = new THREE.SphereGeometry(1.3, 72, 54);
    const mat = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uTemp: { value: 0.3 },
        uPx: { value: dpr },
        uSound: { value: 0 },
        uInk: { value: new THREE.Vector3(...INK) },
        uAccent: { value: new THREE.Vector3(...ACCENT) },
      },
    });
    const points = new THREE.Points(geo, mat);
    spin.add(points);

    // Núcleo de luz
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xd65c00, transparent: true, opacity: 0.3 });
    const core = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), coreMat);
    spin.add(core);

    // Anillo fino
    const ringPts = Array.from({ length: 129 }, (_, i) => {
      const a = (i / 128) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * 1.6, Math.sin(a) * 1.6, 0);
    });
    const ring = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(ringPts),
      new THREE.LineBasicMaterial({ color: 0x290000, transparent: true, opacity: 0.25 }),
    );
    ring.rotation.x = 1.15;
    tilt.add(ring);

    // Tamaño responsivo
    const resize = () => {
      const { clientWidth: w, clientHeight: h } = el;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    // Parallax con GSAP
    const rx = gsap.quickTo(tilt.rotation, 'x', { duration: 1.2, ease: 'power3.out' });
    const ry = gsap.quickTo(tilt.rotation, 'y', { duration: 1.2, ease: 'power3.out' });
    const onMove = (e) => {
      ry((e.clientX / window.innerWidth - 0.5) * 0.7);
      rx((e.clientY / window.innerHeight - 0.5) * 0.5);
    };
    window.addEventListener('pointermove', onMove);

    // Entrada
    gsap.from(spin.scale, { x: 0.2, y: 0.2, z: 0.2, duration: 1.6, ease: 'expo.out' });
    gsap.from(mat.uniforms.uTemp, { value: 1, duration: 2, ease: 'power3.out' });

    // Bucle
    const clock = new THREE.Clock();
    let raf;
    const tick = () => {
      const dt = clock.getDelta();
      const { temp, light, sound } = smooth.current;
      mat.uniforms.uTime.value += dt;
      mat.uniforms.uTemp.value = temp;
      spin.rotation.y += dt * (0.12 + temp * 0.55);
      spin.rotation.x += dt * 0.04;
      ring.rotation.z += dt * 0.08;

      const s = 0.18 + light * 0.85;
      core.scale.setScalar(s * (1 + Math.sin(mat.uniforms.uTime.value * 1.5) * 0.02));
      coreMat.opacity = 0.1 + light * 0.5;

      // El sonido hace latir el anillo y los puntos
      ring.scale.setScalar(1 + sound * 0.22);
      ring.material.opacity = 0.18 + sound * 0.6;
      mat.uniforms.uSound.value = sound;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      ro.disconnect();
      gsap.killTweensOf([spin.scale, mat.uniforms.uTemp]);
      geo.dispose();
      mat.dispose();
      core.geometry.dispose();
      coreMat.dispose();
      ring.geometry.dispose();
      ring.material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div className="orb" ref={host} />;
}
