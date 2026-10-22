import { useEffect, useState } from 'react';

const MAX_POINTS = 60;

export function useMicrobit() {
  const [status, setStatus] = useState({ state: 'connecting', port: null });
  const [reading, setReading] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    let ws;
    let timer;
    let dead = false;

    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${location.host}/ws`);
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.type === 'status') setStatus(m);
        if (m.type === 'reading') {
          setReading(m);
          setHistory((h) => [...h.slice(-(MAX_POINTS - 1)), m]);
        }
      };
      ws.onclose = () => {
        if (dead) return;
        setStatus({ state: 'offline', port: null });
        timer = setTimeout(connect, 1500);
      };
    };
    connect();

    return () => {
      dead = true;
      clearTimeout(timer);
      ws?.close();
    };
  }, []);

  return { status, reading, history };
}
