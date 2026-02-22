import { useState, useCallback } from 'react';
import BootScreen from './components/BootScreen';
import Desktop from './components/Desktop';
import './App.css';

function App() {
  const [phase, setPhase] = useState('boot'); // boot -> desktop

  const handleBootComplete = useCallback(() => {
    setPhase('desktop');
  }, []);

  if (phase === 'boot') {
    return <BootScreen onComplete={handleBootComplete} />;
  }

  return <Desktop />;
}

export default App;
