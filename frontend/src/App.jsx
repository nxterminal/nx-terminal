import { useState } from 'react';
import BootScreen from './components/BootScreen';
import Desktop from './components/Desktop';
import './App.css';

function App() {
  const [booted, setBooted] = useState(false);

  return (
    <>
      <Desktop />
      {!booted && <BootScreen onComplete={() => setBooted(true)} />}
    </>
  );
}

export default App;
