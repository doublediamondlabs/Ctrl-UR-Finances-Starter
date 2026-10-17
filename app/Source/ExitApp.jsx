import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
export default function ExitApp({
  api,
  blocked = false
}) {
  const [phase, setPhase] = useState(''),
    [error, setError] = useState('');
  const dialog = useRef(null);
  useEffect(() => {
    if (!phase) return;
    const shell = document.querySelector('.app-shell'),
      previous = shell?.inert;
    if (shell) shell.inert = true;
    dialog.current?.showModal?.();
    dialog.current?.querySelector('button')?.focus();
    return () => {
      if (shell) shell.inert = previous;
    };
  }, [!!phase]);
  async function exit() {
    setError('');
    setPhase('stopping');
    try {
      await api('app/exit', {});
      for (let i = 0; i < 20; i++) {
        await new Promise(resolve => setTimeout(resolve, 300));
        try {
          await fetch('/app-instance', {
            cache: 'no-store',
            signal: AbortSignal.timeout(1500)
          });
        } catch {
          setPhase('closed');
          return;
        }
      }
      setPhase('waiting');
    } catch (e) {
      setError(e.message);
      setPhase('confirm');
    }
  }
  return <><button className="exit-app-button" onClick={() => {
      setError('');
      setPhase(blocked ? 'blocked' : 'confirm');
    }}>Exit Ctrl Ur Finances</button>{phase && createPortal(<dialog ref={dialog} className="exit-app-dialog" aria-labelledby="exit-app-title" onCancel={e => {
      e.preventDefault();
      if (['confirm', 'blocked'].includes(phase)) setPhase('');
    }}>
  <h2 id="exit-app-title">{phase === 'closed' ? 'Ctrl Ur Finances has closed' : phase === 'stopping' || phase === 'waiting' ? 'Ctrl Ur Finances is closing' : phase === 'blocked' ? 'Finish your open task first' : 'Exit Ctrl Ur Finances?'}</h2>
  {error && <p className="error" role="alert">{error}</p>}
  {phase === 'blocked' ? <><p>Save or cancel your open changes and wait for any work to finish before exiting.</p><button onClick={() => setPhase('')}>Return to Ctrl Ur Finances</button></> : phase === 'confirm' ? <><p>This stops the running application, including its other browser tabs. Save or cancel work in every Ctrl Ur Finances tab before continuing.</p><p className="panel-copy">Closing a browser tab alone leaves the application running. Exit here before applying an update, then close linked Excel workbooks.</p><div className="exit-app-actions"><button onClick={() => setPhase('')}>Keep Working</button><button className="primary" onClick={exit}>Exit Ctrl Ur Finances</button></div></> : phase === 'closed' ? <><p>You can close this browser tab. Use your desktop shortcut to open Ctrl Ur Finances again.</p><p className="panel-copy">Before updating, also close its other browser tabs and linked Excel workbooks on both computers.</p></> : <p role="status">{phase === 'waiting' ? 'The stop request was accepted, but closure has not been confirmed. Wait before applying an update.' : 'Waiting for the application to stop…'}</p>}
 </dialog>, document.body)}</>;
}
