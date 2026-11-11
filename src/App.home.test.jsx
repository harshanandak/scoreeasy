import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { AuthContext } from './auth/AuthContext';
import App from './App';

vi.mock('./designs/design1-mono/landing/PublicHome', () => ({ default: () => <h1>Public Home</h1> }));
vi.mock('./auth/MatchStorageBoundary', () => ({ default: () => <div>Account storage boundary</div> }));

it('renders public Home before auth resolves, keeping other routes behind the storage boundary', () => {
  const view = (path) => render(
    <AuthContext.Provider value={{ isLoading: true, isAuthenticated: false }}>
      <MemoryRouter initialEntries={[path]}><App /></MemoryRouter>
    </AuthContext.Provider>,
  );
  const home = view('/');
  expect(screen.getByRole('heading', { name: 'Public Home' })).toBeInTheDocument();
  expect(screen.queryByText('Account storage boundary')).toBeNull();
  home.unmount();
  view('/cricket/quick');
  expect(screen.getByText('Account storage boundary')).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Public Home' })).toBeNull();
});
