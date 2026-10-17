import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import BusinessActivityNav from '../app/Source/BusinessActivityNav.jsx';
import BusinessPeriodNav from '../app/Source/BusinessPeriodNav.jsx';
import BusinessReports from '../app/Source/BusinessReports.jsx';
function App() {
  const [request, setRequest] = useState(null),
    [section, setSection] = useState('mileage');
  return <><BusinessPeriodNav year={2026} month={1} links={{
      2026: {}
    }} onOpen={() => {}} /><BusinessActivityNav active section={section} onOpen={section => setRequest({
      section
    })} /><BusinessReports mode="activity" book={{
      year: 2026,
      records: [],
      notes: []
    }} sectionRequest={request} onSectionHandled={() => setRequest(null)} onState={s => {
      window.saved = s;
      setSection(s.tab);
    }} onOpen={() => {}} /></>;
}
createRoot(document.getElementById('root')).render(<App />);
