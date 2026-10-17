import React from 'react';
import { createRoot } from 'react-dom/client';
import InspectionDestination from '../app/Source/InspectionDestination.jsx';
import { DestinationPicker, DestinationFields } from '../app/Source/Destinations.jsx';
import { destinationChanges, validateDestinations } from '../app/Source/destinations.js';
window.changeDestinations = destinationChanges;
window.validateDestinations = validateDestinations;
const items = [{
  id: 'a',
  name: 'Dealer North',
  address: '10 North',
  city: 'Anna',
  state: 'IL',
  locationType: 'dealer',
  notes: 'Original note',
  miles: 120,
  reminder: 'Use east entrance'
}, {
  id: 'b',
  name: 'Dealer South',
  address: '20 South',
  city: 'Anna',
  state: 'IL',
  locationType: 'dealer',
  notes: '',
  miles: 80,
  reminder: 'Call first'
}];
window.items = items;
function Test() {
  const [job, setJob] = React.useState({
    profile: {
      locationType: 'dealer'
    },
    visits: [{
      id: 'v',
      purpose: 'Initial inspection',
      miles: 5
    }]
  });
  window.job = job;
  return <><InspectionDestination job={job} items={items} onChange={setJob} /><div id="visit"><DestinationPicker visit={job.visits[0]} items={items} onChange={patch => setJob({
        ...job,
        visits: [{
          ...job.visits[0],
          ...patch
        }]
      })} /></div></>;
}
createRoot(document.getElementById('root')).render(<Test />);
