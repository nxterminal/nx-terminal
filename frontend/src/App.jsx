import { useState } from 'react';
import BootScreen from './components/BootScreen';
import Desktop from './components/Desktop';
import './App.css';

function App() {
  const [booted, setBooted] = useState(false);

  if (!booted) {
    return <BootScreen onComplete={() => setBooted(true)} />;
  }

  return <Desktop />;
}

export default App;
