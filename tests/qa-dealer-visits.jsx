import React from '../app/Source/node_modules/react/index.js';
import { createRoot } from '../app/Source/node_modules/react-dom/client.js';
import DealerVisits from '../app/Source/DealerVisits.jsx';
function Harness() {
  const [vehicle, setVehicle] = React.useState('All');
  return <DealerVisits data={window.testData} vehicle={vehicle} onVehicle={setVehicle} onOpen={r => window.opened = r} start={0} end={11} year={2026} />;
}
createRoot(document.getElementById('root')).render(<Harness />);
