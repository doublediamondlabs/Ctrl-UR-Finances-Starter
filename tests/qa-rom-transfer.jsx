import { applyTravelExpensePlan } from '../app/Source/romTransfer.js';
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import RomTransfer from '../app/Source/RomTransfer.jsx';
import * as codec from '../app/Source/workbook.js';
window.codec = codec;
function Harness() {
  const [book, setBook] = useState(window.fixture);
  return <RomTransfer book={book} onClose={() => window.closedPanel = true} onSave={async (b, done, destinations, plan) => {
    window.attempts = (window.attempts || 0) + 1;
    if (window.failSave) return false;
    window.plan = plan;
    window.saved = plan ? applyTravelExpensePlan(b, plan) : b;
    setBook(window.saved);
    return true;
  }} />;
}
createRoot(document.getElementById('root')).render(<Harness />);
