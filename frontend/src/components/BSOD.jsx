import { useState, useEffect, useRef } from 'react';

export default function BSOD() {
  const [show, setShow] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const schedule = () => {
      // Check every 60s, 1.5% chance
      timerRef.current = setTimeout(() => {
        if (Math.random() < 0.015) {
          setShow(true);
        }
        schedule();
      }, 60000);
    };

    // First check after 3-5 minutes
    timerRef.current = setTimeout(() => {
      schedule();
    }, 180000 + Math.random() * 120000);

    return () => clearTimeout(timerRef.current);
  }, []);

  if (!show) return null;

  return (
    <div className="bsod" onClick={() => setShow(false)}>
      <div className="bsod-content">
        <div className="bsod-title">NX Terminal</div>
        <br />
        <div>A fatal exception 0x0000DEAD has occurred at 0028:C0011E36</div>
        <div>in VXD PROTOCOL_ENGINE(01) + 00010E36.</div>
        <br />
        <div>The current blockchain state will be terminated.</div>
        <br />
        <div>*  Press any key to restart NX Terminal.</div>
        <div>*  Press CTRL+ALT+DEL to restart your devs. You will</div>
        <div>   lose any unsaved $NXT in the current session.</div>
        <br />
        <div>Press any key to continue _</div>
        <br />
        <br />
        <div style={{ fontSize: '12px', color: '#8888ff' }}>
          Error Code: PROTOCOL_WARS_OVERFLOW
          <br />
          Module: dev_engine.sys
          <br />
          Address: 0xDEADBEEF:0x00000000
        </div>
      </div>
    </div>
  );
}
