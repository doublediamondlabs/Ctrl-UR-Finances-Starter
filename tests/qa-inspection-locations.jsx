import React, { useState } from '../app/Source/node_modules/react/index.js';
import { createRoot } from '../app/Source/node_modules/react-dom/client.js';
import InspectionLocations from '../app/Source/InspectionLocations.jsx';
import { inspectionLocations } from '../app/Source/dealerVisits.js';
function Harness() {
  const [view, setView] = useState('all'),
    [vehicle, setVehicle] = useState('All');
  return <InspectionLocations data={inspectionLocations(window.book, window.trips, vehicle)} view={view} onView={setView} vehicle={vehicle} onVehicle={setVehicle} onOpen={row => window.opened = row} start={0} end={11} year={2026} />;
}
createRoot(document.getElementById('root')).render(<Harness />);
