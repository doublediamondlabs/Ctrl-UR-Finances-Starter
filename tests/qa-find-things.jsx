import React from 'react';
import { createRoot } from 'react-dom/client';
import FindThings from '../app/Source/FindThings.jsx';
function Test() {
  const [state, setState] = React.useState({
    query: 'bishs',
    scope: 'all',
    year: 'all'
  });
  return <FindThings state={state} onState={setState} links={{
    2025: {},
    2026: {},
    2024: {}
  }} api={window.api} readBook={window.readBook} onOpen={r => window.opened = r} />;
}
;
createRoot(document.getElementById('root')).render(<Test />);
