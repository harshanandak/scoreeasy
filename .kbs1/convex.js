export const useQuery = () => undefined;
export const usePaginatedQuery = () => ({ results: [], status: 'Exhausted', loadMore: () => {} });
export const useMutation = () => async () => null;
export const useConvexAuth = () => ({ isAuthenticated: false, isLoading: false });
export const useConvexConnectionState = () => ({ isWebSocketConnected: true });
export class ConvexReactClient { constructor() {} }
export const ConvexProvider = ({ children }) => children;
