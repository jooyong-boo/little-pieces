import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  type CoupleInput,
  createCoupleRequest,
  fetchMyCouple,
  joinCoupleRequest,
  leaveCoupleRequest,
  updateCoupleRequest,
} from '@/lib/couple-api';
import { queryKeys } from '@/lib/query-client';

/** 로그인 전에는 부를 이유가 없으므로 호출부가 켤 수 있게 둔다. */
export function useCouple(enabled = true) {
  return useQuery({ queryKey: queryKeys.couple, queryFn: fetchMyCouple, enabled });
}

/** 커플이 바뀌면 추억 목록도 통째로 달라진다. 둘 다 비운다. */
function useCoupleMutation<TVariables, TData>(
  mutationFn: (variables: TVariables) => Promise<TData>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.couple });
      await queryClient.invalidateQueries({ queryKey: queryKeys.memories });
    },
  });
}

export function useCreateCouple() {
  return useCoupleMutation((input: CoupleInput) => createCoupleRequest(input));
}

export function useJoinCouple() {
  return useCoupleMutation((inviteCode: string) => joinCoupleRequest(inviteCode));
}

export function useUpdateCouple() {
  return useCoupleMutation((input: CoupleInput) => updateCoupleRequest(input));
}

export function useLeaveCouple() {
  return useCoupleMutation(() => leaveCoupleRequest());
}
