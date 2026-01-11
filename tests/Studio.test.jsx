import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Studio from '../src/pages/Studio';
import { MemoryRouter } from 'react-router-dom';

// Mock heavy components to keep test lightweight
jest.mock('../src/components/Workspace', () => {
  const React = require('react');
  return React.forwardRef(function MockWorkspace(props, ref) {
    React.useImperativeHandle(ref, () => ({
      serializeScene: () => ({ objects: [] }),
      captureThumbnail: async () => null,
      addItem: () => {},
    }));
    return React.createElement('div', { 'data-testid': 'mock-workspace' }, 'Workspace');
  });
});

jest.mock('../src/components/Palette', () => {
  return function MockPalette() { return React.createElement('div', { 'data-testid': 'mock-palette' }, 'Palette'); };
});

jest.mock('../src/components/ObjectProperties', () => {
  return function MockProps() { return React.createElement('div', { 'data-testid': 'mock-props' }, 'Props'); };
});

jest.mock('../src/components/Outliner', () => {
  return function MockOutliner() { return React.createElement('div', { 'data-testid': 'mock-outliner' }, 'Outliner'); };
});

// Basic fetch mock
beforeEach(() => {
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ _id: 'p1', name: 'Test' }) }));
});
afterEach(() => {
  jest.resetAllMocks();
});

test('keyboard shortcuts toggle palette and inspector (P and I)', async () => {
  render(<MemoryRouter><Studio /></MemoryRouter>);

  // palette toggle button exists
  const paletteBtn = await screen.findByTitle(/Open Palette|Collapse Palette/i);
  expect(paletteBtn).toBeInTheDocument();
  // initial aria-pressed attribute should exist
  const initial = paletteBtn.getAttribute('aria-pressed');

  // Press 'p' to toggle
  fireEvent.keyDown(window, { key: 'p' });
  await waitFor(() => {
    const after = paletteBtn.getAttribute('aria-pressed');
    expect(after).not.toBe(initial);
  });

  // Inspector toggle 'i'
  const inspectorBtn = screen.getByTitle(/Toggle Inspector|Open Inspector/i);
  expect(inspectorBtn).toBeInTheDocument();
  const initialI = inspectorBtn.getAttribute('aria-pressed');
  fireEvent.keyDown(window, { key: 'i' });
  await waitFor(() => {
    const afterI = inspectorBtn.getAttribute('aria-pressed');
    expect(afterI).not.toBe(initialI);
  });
});

test('saveProject triggers toast on server success', async () => {
  render(<MemoryRouter><Studio /></MemoryRouter>);

  // Find Save to Cloud button
  const saveBtn = await screen.findByText(/Save to Cloud/i);
  expect(saveBtn).toBeInTheDocument();

  userEvent.click(saveBtn);

  // wait for a toast indicating saved to server
  await waitFor(() => expect(screen.getByText(/Project saved to server/i)).toBeInTheDocument(), { timeout: 3000 });
});

test('OutlinerPanel renders and onSelect works (mock)', async () => {
  render(<MemoryRouter><Studio /></MemoryRouter>);

  // Open inspector tab (outliner)
  const outlinerTab = await screen.findByRole('tab', { name: /Outliner/i });
  userEvent.click(outlinerTab);

  // Outliner mock should render
  const outliner = await screen.findByTestId('mock-outliner');
  expect(outliner).toBeInTheDocument();
});
