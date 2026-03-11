import { useState } from 'react';
import api from '../../../../services/api';

const API_BASE = import.meta.env.VITE_API_URL || 'https://nx-terminal.onrender.com';

export default function AIMentor({ task, expected, studentCode }) {
  const [aiHelp, setAiHelp] = useState("");
  const [loading, setLoading] = useState(false);

  const getHelp = async () => {
    setLoading(true);
    setAiHelp("");
    try {
      const resp = await fetch(`${API_BASE}/api/academy/ai-mentor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, expected, studentCode }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        setAiHelp(err.detail || "AI Mentor temporarily unavailable.");
      } else {
        const data = await resp.json();
        setAiHelp(data.hint || "No hint available.");
      }
    } catch {
      setAiHelp("AI Mentor offline. Try the hint button.");
    }
    setLoading(false);
  };

  return { aiHelp, loading, getHelp };
}
