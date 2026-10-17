import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import BusinessReports from '../app/Source/BusinessReports.jsx';
function Harness() {
  const [reporting, setReporting] = useState(window.settings);
  return <BusinessReports mode="tax" book={window.book} reporting={reporting} onSaveReporting={async value => {
    window.saved = value;
    setReporting(value);
  }} onOpen={x => window.opened = x} onEditEntry={(y, id) => window.entry = [y, id]} onReviewMonth={m => window.month = m} onOpenMileage={() => window.opened = 'mileage'} />;
}
createRoot(document.getElementById('root')).render(<Harness />);
