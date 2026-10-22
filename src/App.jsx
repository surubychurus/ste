import { useEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { useMicrobit } from './useMicrobit.js';
import Orb from './components/Orb.jsx';
import Metric from './components/Metric.jsx';
import Spark from './components/Spark.jsx';

const TEMP_RANGE = [10, 40];
const LIGHT_RANGE = [0, 255];
const SOUND_RANGE = [0, 255];

const norm = (v, [a, b]) => Math.min(1, Math.max(0, (v - a) / (b - a)));

const STATUS_TEXT = {
  connected: 'Conectada',
  waiting: 'Esperando micro:bit',
  simulation: 'Simulación',
  connecting: 'Conectando…',
  offline: 'Servidor sin conexión',
};

const describeTemp = (t) => (t < 18 ? 'Frío' : t < 26 ? 'Templado' : t < 32 ? 'Cálido' : 'Caluroso');
const describeLight = (l) => (l < 40 ? 'Oscuro' : l < 120 ? 'Tenue' : l < 200 ? 'Luminoso' : 'Muy brillante');
const describeSound = (s) => (s < 30 ? 'Silencio' : s < 90 ? 'Tranquilo' : s < 170 ? 'Ruidoso' : 'Muy fuerte');

export default function App() {
  const { status, reading, history } = useMicrobit();
  const root = useRef(null);

  // Entrada escalonada
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: 'power3.out' } })
        .from('.header > *', { y: -16, opacity: 0, duration: 0.8, stagger: 0.1 })
        .from('.metric', { y: 24, opacity: 0, duration: 0.9, stagger: 0.15 }, 0.2)
        .from('.spark', { y: 20, opacity: 0, duration: 0.8, stagger: 0.12 }, 0.5)
        .from('.footer', { opacity: 0, duration: 0.8 }, 0.9);
    }, root);
    return () => ctx.revert();
  }, []);

  // Latido del indicador de estado
  useEffect(() => {
    const t = gsap.to('.status__dot', { scale: 1.7, opacity: 0.35, duration: 0.9, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    return () => t.kill();
  }, []);

  const target = useMemo(
    () =>
      reading && {
        temp: reading.temp == null ? 0.3 : norm(reading.temp, TEMP_RANGE),
        light: reading.light == null ? 0.3 : norm(reading.light, LIGHT_RANGE),
        sound: reading.sound == null ? 0 : norm(reading.sound, SOUND_RANGE),
      },
    [reading],
  );

  const temps = history.map((h) => h.temp);
  const lights = history.map((h) => h.light);
  const sounds = history.map((h) => h.sound);
  const live = status.state === 'connected' || status.state === 'simulation';
  const age = reading ? new Date(reading.t).toLocaleTimeString('es') : '—';

  return (
    <main className="app" ref={root}>
      <header className="header">
        <h1 className="brand">micro<span>:</span>bit</h1>
        <div className={`status ${live ? 'is-live' : ''}`}>
          <i className="status__dot" />
          {STATUS_TEXT[status.state] ?? status.state}
        </div>
      </header>

      <section className="stage">
        <Orb target={target} />
        <Metric
          align="left"
          label="Temperatura"
          value={reading?.temp}
          unit="°C"
          decimals={1}
          min={TEMP_RANGE[0]}
          max={TEMP_RANGE[1]}
          describe={describeTemp}
        />
        <Metric
          align="right"
          label="Luz"
          value={reading?.light}
          unit="/ 255"
          min={LIGHT_RANGE[0]}
          max={LIGHT_RANGE[1]}
          describe={describeLight}
        />
        <Metric
          align="center"
          label="Sonido"
          value={reading?.sound}
          unit="/ 255"
          min={SOUND_RANGE[0]}
          max={SOUND_RANGE[1]}
          describe={describeSound}
        />
      </section>

      <section className="charts">
        <Spark title="Temperatura · últimos 60 datos" values={temps} domain={[10, 40]} />
        <Spark title="Luz · últimos 60 datos" values={lights} domain={[0, 255]} accent />
        <Spark title="Sonido · últimos 60 datos" values={sounds} domain={[0, 255]} dashed />
      </section>

      <footer className="footer">
        <span>{status.port ?? 'Sin puerto'}</span>
        <span>Último dato · {age}</span>
      </footer>
    </main>
  );
}
