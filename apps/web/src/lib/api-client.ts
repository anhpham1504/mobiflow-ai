import { readinessResponseSchema } from '@mobiflow/contracts';

export async function fetchReadiness(baseUrl: string, signal?: AbortSignal) {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/health/ready`, { cache: 'no-store', signal: signal ?? AbortSignal.timeout(8000) });
  // 503 is a valid typed health result; other failures are transport errors.
  if (!response.ok && response.status !== 503) throw new Error('Không thể kết nối tới dịch vụ. Vui lòng thử lại.');
  const result = readinessResponseSchema.safeParse(await response.json());
  if (!result.success) throw new Error('Dịch vụ trả về dữ liệu trạng thái không hợp lệ.');
  return result.data;
}
