import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';

export function useWebSocket() {
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimeout = useRef(null);
  const reconnectDelay = useRef(1000);
  const pingInterval = useRef(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(api.wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        reconnectDelay.current = 1000;
        pingInterval.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping');
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        if (event.data === 'pong') return;
        try {
          const msg = JSON.parse(event.data);
          setMessages(prev => [msg, ...prev].slice(0, 200));
        } catch {
          // ignore non-JSON messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        clearInterval(pingInterval.current);
        reconnectTimeout.current = setTimeout(() => {
          reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
          connect();
        }, reconnectDelay.current);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      reconnectTimeout.current = setTimeout(connect, reconnectDelay.current);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimeout.current);
      clearInterval(pingInterval.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof data === 'string' ? data : JSON.stringify(data));
    }
  }, []);

  return { messages, connected, send };
}
