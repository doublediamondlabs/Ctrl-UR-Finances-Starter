import React from 'react';
import { createRoot } from 'react-dom/client';
import EditionSettings, { Tribute, initialEditions } from '../app/Source/Edition.jsx';
function Test() {
  const [value, setValue] = React.useState({
    ...initialEditions,
    visible: true
  });
  return <><div id="sidebar"><Tribute settings={value} /></div><EditionSettings value={value} onDirty={v => window.dirty = v} onSave={async v => {
      if (window.fail) throw Error('Save failed');
      window.saved = v;
      setValue(v);
    }} /></>;
}
createRoot(document.getElementById('root')).render(<Test />);
