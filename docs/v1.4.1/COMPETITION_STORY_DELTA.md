# Competition story delta for v1.4.1

This is a proposed narrative delta only. The frozen v1.4.0 deck was not edited.

## One-line product message

**AI tự động điều phối trong giới hạn — con người kiểm soát.**

MobiFlow AI is an **AI-assisted intelligent workflow automation** system, not merely an AI chatbot.

## Updated judge-facing flow

`USER request -> AI Analysis -> lexical RAG/SOP -> validated routing facts -> deterministic Routing Engine -> STAFF -> checklist -> human resolution -> feedback`.

AI understands the request. RAG grounds the classification in approved operational knowledge. The Routing Engine checks real Team, Skill, availability, workload, SLA policy and current state. The canonical state machine performs the protected assignment.

## Ordinary demo

For “17 SIM IoT mất kết nối sau thay đổi APN”, RAG retrieves SOP-IOT-04. The validated category/subcategory maps to the required IoT skill and team. The Routing Engine chooses the active, available, exact-skill STAFF member with the lowest active workload and assigns without a Manager click.

## Safety demo

When evidence is weak, facts are incomplete, rules conflict or no eligible STAFF exists, the system does not guess. It leaves the request recoverable for Manager review. The Manager can assign or override through the existing audited state-machine path.

## Judge explanation

> MobiFlow AI không để LLM tự chọn người rồi ghi thẳng vào hệ thống. AI và RAG phân tích yêu cầu, xác định nhóm nghiệp vụ và kỹ năng cần thiết. Routing Engine sau đó kiểm tra dữ liệu thật về team, skill, availability, workload và SLA để tự động phân công khi đủ điều kiện. Nếu không đủ căn cứ, yêu cầu được chuyển cho Manager xử lý. Manager luôn có quyền override.

## Claims to avoid

Do not claim autonomous workforce management, perfect routing, online presence, sophisticated fairness optimization or automatic priority authority. The accurate claim is deterministic initial auto-routing under validated rules with human exception handling and override.
