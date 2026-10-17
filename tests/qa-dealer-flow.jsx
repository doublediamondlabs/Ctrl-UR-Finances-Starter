import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import InspectionDetails from '../app/Source/InspectionDetails.jsx';
import InspectionDestination, { applyLocationProfile } from '../app/Source/InspectionDestination.jsx';
import { destinationChanges } from '../app/Source/destinations.js';
function Test() {
  const [job, setJob] = useState(window.job);
  window.current = job;
  window.changes = () => destinationChanges(window.items, job.visits);
  return <InspectionDetails profile={job.profile} onChange={profile => setJob(applyLocationProfile(job, profile))} locationControl={<InspectionDestination job={job} items={window.items} onChange={setJob} />} />;
}
createRoot(document.getElementById('root')).render(<Test />);
