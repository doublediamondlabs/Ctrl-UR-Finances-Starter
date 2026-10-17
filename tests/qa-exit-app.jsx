import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import ExitApp from '../app/Source/ExitApp.jsx';
window.calls = [];
window.fail = false;
window.fetch = async () => {
  throw Error('server stopped');
};
function Harness() {
  const [blocked, setBlocked] = useState(false);
  window.setBlocked = setBlocked;
  return <div className="app-shell"><ExitApp blocked={blocked} api={async (path, body) => {
      window.calls.push({
        path,
        body
      });
      if (window.fail) throw Error('Backup operation in progress. Wait for completion.');
      return {
        stopping: true
      };
    }} /></div>;
}
createRoot(document.getElementById('root')).render(<Harness />);
