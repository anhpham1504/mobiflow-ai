# Role UI review

Playwright verified the isolated candidate with real API data.

- USER: saw `Yêu cầu đã được chuyển đến bộ phận phù hợp.`; did not see candidate list, workload, internal reasons or staff-private data.
- STAFF: request appeared in assigned work, opened normally, exposed the existing `Bắt đầu xử lý`/checklist workflow and RAG source, without internal candidate details.
- MANAGER: saw automatic-routing source, category/subcategory, required skill, Team, selected STAFF and safe reasons including lowest workload.

Responsive checks at 1920×1080, 1366×768 and 390×844 had zero horizontal overflow. Console errors, page errors and unexpected 5xx were zero. Keyboard focus reached the skip link.

Result: **PASS**.
