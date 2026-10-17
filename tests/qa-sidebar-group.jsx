import React from 'react';
import { createRoot } from 'react-dom/client';
import SidebarNav from '../app/Source/SidebarNav.jsx';
import BusinessPeriodNav from '../app/Source/BusinessPeriodNav.jsx';
import BusinessActivityNav from '../app/Source/BusinessActivityNav.jsx';
const Icon = () => null;
const root = createRoot(document.getElementById('root'));
window.renderNav = () => root.render(<SidebarNav items={[["month", Icon, "Business Workspace"], ["home", Icon, "Personal"]]} order={['month', 'home']} active="month" ready collapsibleKeys={['month']} onSelect={k => window.selected = k} renderBelow={k => k === 'month' ? <><BusinessPeriodNav year={2026} month={0} links={{
    2026: {}
  }} onOpen={() => {}} /><BusinessActivityNav onOpen={() => {}} /></> : null} />);
window.renderNav();
