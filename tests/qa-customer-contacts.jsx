import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import CustomerContacts from '../app/Source/CustomerContacts.jsx';
import { BriefSheet } from '../app/Source/InspectionBrief.jsx';
import * as codec from '../app/Source/workbook.js';
window.codec = codec;
function App() {
  const [p, set] = useState(window.profile);
  window.currentProfile = p;
  return <><CustomerContacts profile={p} onChange={set} /><BriefSheet row={{
      profile: p,
      location: {},
      visit: {},
      missing: [],
      date: '2026-10-15'
    }} /></>;
}
createRoot(document.getElementById('root')).render(<App />);
