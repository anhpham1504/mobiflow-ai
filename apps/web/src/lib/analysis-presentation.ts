import type {z} from 'zod';
import type {aiExplanationSchema} from '@mobiflow/contracts';

type Explanation=z.infer<typeof aiExplanationSchema>['data'];
const failureText=(code:string|null|undefined)=>code==='STALE_CONTEXT'?'Phân tích dựa trên phiên bản cũ đã được loại bỏ. Tin nhắn mới vẫn được giữ nguyên.':code==='AI_INVALID_OUTPUT'?'AI chưa tạo được kết quả hợp lệ. Không có quyết định nghiệp vụ nào được áp dụng.':code==='AI_TIMEOUT'?'Phân tích đã hết thời gian chờ. Bạn có thể thử lại hoặc xử lý thủ công.':code==='FORBIDDEN'?'Quyền của người khởi tạo đã thay đổi; kết quả không được công bố.':'AI local hiện không khả dụng. Yêu cầu đã được lưu an toàn. Có thể thử lại hoặc xử lý thủ công.';

export function analysisRunning(data:Explanation|null){
  return data?.status==='RUNNING'||['QUEUED','RUNNING'].includes(data?.job?.status??'');
}
export function analysisStatusText(data:Explanation|null,error:string){
  if(!data)return error?'Chưa tải được trạng thái AI.':'Đang tải trạng thái AI…';
  if(analysisRunning(data))return data.job?.status==='QUEUED'?'AI đang chờ xử lý.':'AI đang phân tích…';
  const status=data.job?.status??data.status;
  if(status==='SUCCEEDED')return 'Phân tích AI hoàn tất.';
  if(status==='FAILED')return failureText(data.job?.errorCode);
  if(status==='CANCELED')return 'Phân tích đã được hủy.';
  return 'Chưa có phân tích AI.';
}
