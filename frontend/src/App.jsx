import { useState, useCallback } from 'react';
import BootScreen from './components/BootScreen';
import WelcomeScreen from './components/WelcomeScreen';
import Desktop from './components/Desktop';
import './App.css';

function App() {
  const [phase, setPhase] = useState('boot'); // boot -> welcome -> desktop

  const handleBootComplete = useCallback(() => {
    setPhase('welcome');
  }, []);

  const handleWelcomeComplete = useCallback(() => {
    setPhase('desktop');
  }, []);

  if (phase === 'boot') {
    return <BootScreen onComplete={handleBootComplete} />;
  }

  if (phase === 'welcome') {
    return <WelcomeScreen onComplete={handleWelcomeComplete} />;
  }

  return <Desktop />;
}

export default App;
