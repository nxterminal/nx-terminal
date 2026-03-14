import { useState, useEffect, useRef } from 'react';
import { createPublicClient, http, formatGwei } from 'viem';
import { MONAD_MAINNET, MONAD_TESTNET } from '../constants/monad';

function getClient(network) {
  const config = network === 'mainnet' ? MONAD_MAINNET : MONAD_TESTNET;
  return createPublicClient({
    chain: {
      id: config.chainId,
      name: config.name,
      nativeCurrency: config.nativeCurrency,
      rpcUrls: { default: { http: [config.rpcUrl] } },
    },
    transport: http(config.rpcUrl),
  });
}

export function useMonadNetwork(network = 'mainnet') {
  const [blockNumber, setBlockNumber] = useState(null);
  const [gasPrice, setGasPrice] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef(null);

  useEffect(() => {
    const client = getClient(network);

    async function fetchData() {
      try {
        const [block, gas] = await Promise.all([
          client.getBlockNumber(),
          client.getGasPrice(),
        ]);
        setBlockNumber(Number(block));
        setGasPrice(formatGwei(gas));
        setIsLoading(false);
      } catch {
        setIsLoading(false);
      }
    }

    fetchData();
    intervalRef.current = setInterval(fetchData, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [network]);

  return { blockNumber, gasPrice, isLoading };
}
