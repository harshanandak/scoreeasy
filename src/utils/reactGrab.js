export function shouldLoadReactGrab(env = {}) {
  return Boolean(env.DEV && env.VITE_ENABLE_REACT_GRAB === 'true');
}
