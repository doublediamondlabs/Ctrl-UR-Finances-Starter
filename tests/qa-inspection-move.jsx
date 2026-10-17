import * as locationHelpers from '../app/Source/InspectionDestination.jsx';
window.locationHelpers = locationHelpers;
import React from 'react';
import { createRoot } from 'react-dom/client';
import InspectionIncome from '../app/Source/InspectionIncome.jsx';
import * as codec from '../app/Source/workbook.js';
import * as shared from '../app/Source/sharedInspections.js';
window.codec = codec;
window.shared = shared;
createRoot(document.getElementById('root')).render(<InspectionIncome allowRom={true} initialTravel={!!window.initialTravel} onTravelClose={() => window.travelClosed = true} reporting={window.reporting || {}} book={window.fixture} month={0} showAttention={false} onDirty={v => window.dirty = v} onMoved={m => window.moved = m} onSave={async (b, done, destinations) => {
  window.destinationSave = destinations;
  if (window.failSave) return false;
  window.saved = b;
  return true;
}} />);
