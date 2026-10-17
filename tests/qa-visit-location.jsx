import React, { useState } from '../app/Source/node_modules/react/index.js';
import { createRoot } from '../app/Source/node_modules/react-dom/client.js';
import VisitLocation from '../app/Source/VisitLocation.jsx';
import DealerVisits from '../app/Source/DealerVisits.jsx';
import { destinationChanges } from '../app/Source/destinations.js';
window.destinationChanges = destinationChanges;
function Harness() {
  const [visit, setVisit] = useState(window.visit);
  window.currentVisit = visit;
  return <><VisitLocation visit={visit} profile={window.profile} items={window.items} onChange={patch => setVisit({
      ...visit,
      ...patch
    })} /><DealerVisits data={window.report} vehicle="All" onVehicle={() => {}} onReview={(row, note) => window.reviewSave = {
      row,
      note
    }} start={0} end={11} year={2026} /></>;
}
createRoot(document.getElementById('root')).render(<Harness />);
