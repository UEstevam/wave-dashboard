import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CreativesTable from './components/CreativesTable';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 2000, retry: 1 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CreativesTable />
    </QueryClientProvider>
  );
}
