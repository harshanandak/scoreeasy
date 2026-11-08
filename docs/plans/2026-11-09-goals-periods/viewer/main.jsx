import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import MonoWatchMatch from '../../../../src/designs/design1-mono/MonoWatchMatch';
import '../../../../src/index.css';
import '../../../../src/designs/design1-mono/mono.css';

// Presentation fixture only. It uses the shipped viewer, with no remote writes.
createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/live/PERIOD_FIXTURE']}><Routes><Route path="/live/:token" element={<MonoWatchMatch />} /></Routes></MemoryRouter>);
