import { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'https://nx-terminal.onrender.com';

export function useNFTVerify() {
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  const verify = async (devId) => {
    setVerifying(true);
    setError("");
    try {
      const resp = await fetch(`${API_BASE}/api/academy/verify-nft?devId=${devId}`);
      if (!resp.ok) {
        setError("Verification failed. Try again.");
        setVerifying(false);
        return null;
      }
      const data = await resp.json();
      setVerifying(false);
      if (!data.isOwner) {
        setError("You don't own this Dev NFT.");
        return null;
      }
      return { devId, species: data.species || "Unknown" };
    } catch {
      setError("Network error. Try again.");
      setVerifying(false);
      return null;
    }
  };

  return { verify, verifying, error };
}
