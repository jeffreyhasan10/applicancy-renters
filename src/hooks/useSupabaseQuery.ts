import { useQuery, useMutation, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';

type SupabaseQueryFn<T> = () => Promise<{ data: T | null; error: any }>;
type SupabaseMutationFn<T, V> = (variables: V) => Promise<{ data: T | null; error: any }>;

export function useSupabaseQuery<T>(
  queryKey: string[],
  queryFn: SupabaseQueryFn<T>,
  options?: Omit<UseQueryOptions<{ data: T | null; error: any }, any, T, string[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey,
    queryFn,
    select: (result) => {
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    ...options,
  });
}

export function useSupabaseMutation<T, V = unknown>(
  mutationFn: SupabaseMutationFn<T, V>,
  options?: UseMutationOptions<{ data: T | null; error: any }, any, V, unknown>
) {
  return useMutation({
    mutationFn,
    ...options,
  });
} 