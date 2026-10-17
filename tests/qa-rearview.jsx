import React from 'react';
import { createRoot } from 'react-dom/client';
import Rearview from '../app/Source/Rearview.jsx';
createRoot(document.getElementById('root')).render(<Rearview book={window.book} api={window.api} onDirty={v => window.dirty = v} />);
