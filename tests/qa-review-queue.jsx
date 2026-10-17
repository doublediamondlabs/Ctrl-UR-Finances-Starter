import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import ReviewQueue from '../app/Source/ReviewQueue.jsx';
import PersonalReview from '../app/Source/PersonalReview.jsx';
function Test() {
  const [reporting, setReporting] = useState(window.reporting),
    [task, setTask] = useState(null);
  window.currentReporting = reporting;
  return <><ReviewQueue book={window.fixture} reporting={reporting} domain="business" onContinue={task => {
      window.task = task;
      setTask(task);
    }} />{task?.kind === 'financial' && <PersonalReview domain={task.domain} book={window.fixture} month={task.month} reporting={reporting} onSave={async next => {
      if (window.failSave) throw Error('Save failed for test');
      setReporting(next);
    }} onOpen={row => window.opened = row} />}</>;
}
;
createRoot(document.getElementById('root')).render(<Test />);
