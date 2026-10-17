import React from 'react';
import { createRoot } from 'react-dom/client';
import InspectionBrief from '../app/Source/InspectionBrief.jsx';
import PeriodDisclosure from '../app/Source/PeriodDisclosure.jsx';
import { inspectionBriefRows } from '../app/Source/inspectionBrief.js';
window.rows = inspectionBriefRows;
createRoot(document.getElementById('root')).render(<><PeriodDisclosure id="test" label="October 2026"><p id="period-content">Year and month choices</p></PeriodDisclosure><InspectionBrief api={window.api} readBook={x => JSON.parse(x)} /></>);
