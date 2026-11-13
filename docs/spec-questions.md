# Clauderon v1 — Câu hỏi cần chốt trước khi viết spec

> **Ngày:** 2026-11-13 · **Trạng thái:** Chờ team trả lời
> **Mục đích:** [requirements v1](requirements/v1-requirements.md) đã chốt, nhưng spec cần thêm các quyết định dưới đây. Mỗi câu có vài lựa chọn, lựa chọn gợi ý đứng đầu và được đánh dấu **(Recommended)**. Ghi lựa chọn của team vào dòng **Quyết định**, hoặc ghi câu trả lời khác nếu không lựa chọn nào phù hợp. Câu nào bỏ trống sẽ theo lựa chọn gợi ý.

Thuật ngữ (Pod, Run, Flow, Node, Slot...) giữ nguyên tiếng Anh theo [CONTEXT.md](../CONTEXT.md). Các ADR trong [adr/](adr/) được coi là đã chốt.

**Mục lục**

- [A. Cách viết và test spec](#a-cách-viết-và-test-spec) — Q1–Q4
- [B. Câu hỏi mở trong requirements (mục 8)](#b-câu-hỏi-mở-trong-requirements-mục-8) — Q5–Q14
- [C. Host Agent, Pod và terminal](#c-host-agent-pod-và-terminal) — Q15–Q23
- [D. Run engine và Human Node](#d-run-engine-và-human-node) — Q24–Q33
- [E. Ticket, GitHub và Artifact](#e-ticket-github-và-artifact) — Q34–Q39
- [F. Flow](#f-flow) — Q40–Q42
- [G. Đăng nhập, log và audit](#g-đăng-nhập-log-và-audit) — Q43–Q47
- [Tóm tắt các gợi ý](#tóm-tắt-các-gợi-ý)

---

## A. Cách viết và test spec

### Q1. Seam test chính

Chưa có code. Spec nên dùng càng ít seam test càng tốt, đặt ở tầng càng cao càng tốt.

- **a. Một seam duy nhất: app core, test qua các command và query của nó (Recommended).** Test gọi core (start một Batch, approve, retry, cancel, lưu Flow, Sync) với một Host Agent giả nói đúng protocol thật, một GitHub reader giả và một đồng hồ giả, rồi kiểm tra trạng thái Run, Ticket Status, Needs you, Slot và audit. Flow validator, scheduler, run engine và Ticket Status đều được test qua seam này. Host Agent thật có test riêng với Docker giả, trên cùng protocol.
- b. Seam (a) cộng thêm test end-to-end qua HTTP API và UI cho đăng nhập, Start dialog và Needs you.
- c. Nhiều seam unit riêng cho validator, scheduler, state machine của Run và Ticket Status.

**Quyết định:**

### Q2. Publish spec ở đâu

- **a. Một GitHub issue trong repo này, gắn label mới `ready-for-agent` (Recommended).** Label này chưa có, sẽ được tạo.
- b. Một GitHub issue, không gắn label.
- c. Một file Markdown trong repo (ví dụ `docs/spec.md`), review qua pull request.

**Quyết định:**

### Q3. Một spec hay nhiều spec

- **a. Một spec cho toàn bộ v1, sau đó tách thành issue theo milestone M0–M4 (Recommended).**
- b. Mỗi milestone một spec, viết ngay trước khi bắt đầu milestone đó.
- c. Mỗi module một spec (Pods, Flows, Tickets, Runs).

**Quyết định:**

### Q4. Cấu trúc repo

Web app, Host Agent và Pod image cần nằm ở đâu đó.

- **a. Một repo (repo này) gồm ba phần: web app, Host Agent, Pod image, dùng chung kiểu dữ liệu của protocol (Recommended).**
- b. Ba repo riêng cho app, Host Agent và image.

**Quyết định:**

---

## B. Câu hỏi mở trong requirements (mục 8)

### Q5. Host web app và database ở đâu (câu hỏi mở 1)

- **a. Một nền tảng cloud có quản lý (ví dụ Railway, Render hoặc Fly) với Postgres có quản lý, truy cập qua internet, có Google sign-in bảo vệ (Recommended).**
- b. Một server của công ty, chỉ truy cập được trong mạng công ty hoặc qua VPN. Pod Host và mọi Member đều phải truy cập được.
- c. Ngay trên Pod Host (trái với quyết định ngày 2026-11-13 là "host ở nơi khác").

**Quyết định:**

### Q6. Cài đặt và kết nối Host Agent (câu hỏi mở 2)

- **a. Một script cài Host Agent thành service tự chạy khi Pod Host khởi động (launchd trên macOS, systemd trên Linux), kết nối bằng một secret dài hạn đặt trong cấu hình của app (Recommended).**
- b. Một mã ghép nối dùng một lần hiển thị trong app, đổi lấy secret ở lần kết nối đầu.
- c. Host Agent tự chạy như một Docker container, mount Docker socket vào.

**Quyết định:**

### Q7. Giới hạn mặc định của Pod và sức chứa Pod Host (câu hỏi mở 3)

- **a. Mặc định mỗi Pod 2 CPU, 4 GB RAM, 2 Slot; chủ Pod được đổi Slot, CPU và RAM đến một mức trần đặt trong cấu hình app (Recommended).**
- b. Mỗi Pod 4 CPU, 8 GB RAM, 2 Slot, cố định.
- c. Không giới hạn CPU/RAM trong v1, chỉ có Slot (làm yếu NFR-6).

Sức chứa: trang Pods hiển thị tổng giới hạn của các Pod so với tổng tài nguyên của Pod Host. **Có từ chối Create my Pod khi Pod Host bị cấp vượt quá tài nguyên không?** Gợi ý: không, chỉ cảnh báo.

**Quyết định:**

### Q8. Image chuẩn (câu hỏi mở 4)

- **a. Build từ một Dockerfile trong repo này bằng CI cho arm64 và amd64, gồm git, gh, Node LTS, Python 3, build tools và Claude Code CLI; người phụ trách Host Agent cũng phụ trách image (Recommended).**
- b. Chỉ có Node; các toolchain khác mỗi Member tự cài vào Workspace của mình.
- c. Một base image công khai (ví dụ devcontainer image) cộng thêm Claude Code.

**Quyết định:**

### Q9. Artifact được tạo ra thế nào (câu hỏi mở 5)

- **a. Khi Run kết thúc, app tự ghép Artifact từ các Output của Run: Output `summary` (đã thay đổi gì, test thế nào), mọi Output `screenshot`, thống kê diff và link `pull-request`. Không có cơ chế chụp màn hình sẵn; muốn có ảnh thì một Node phải tạo Output `screenshot` (Recommended).**
- b. Mọi Flow phải kết thúc bằng một Agent Node viết Artifact.
- c. Cả hai: ghép từ Output, cộng thêm một lần gọi Agent ở cuối để viết phần mô tả.

**Quyết định:**

### Q10. Output Type cho các Flow mẫu (câu hỏi mở 6)

Các Task mẫu cần: Grill a plan (`issue` → `plan`), Approve a plan (`plan` → `plan`), Code a change (`plan` → `branch`, `summary`), Run tests (`branch` → `test-result`), Open a pull request (`branch`, `test-result` không bắt buộc → `pull-request`).

- **a. Danh sách hiện tại là đủ. Approve chuyển nguyên input của nó ra thành Output cùng Output Type (Recommended).**
- b. Thêm type `approval` để bản thân việc approve là một Output.
- c. Thêm type `text` chung cho các Output dạng tự do.

**Quyết định:**

### Q11. Hiển thị chi phí (câu hỏi mở 7)

- **a. Chỉ token và thời gian (Recommended).**
- b. Token cộng với chi phí Claude Code báo về, ghi rõ là "chi phí tương đương API", vì subscription không tính tiền theo token.

**Quyết định:**

### Q12. Thời gian giữ log và backup (câu hỏi mở 8)

- **a. Giữ log 90 ngày rồi xoá (Run, Output và Artifact vẫn giữ); backup database hằng ngày, giữ 14 ngày (Recommended).**
- b. Giữ log mãi mãi; backup hằng ngày, giữ 30 ngày.
- c. Giữ log 30 ngày; backup theo mặc định của nền tảng hosting.

**Quyết định:**

### Q13. Tech stack (câu hỏi mở 9)

- **a. TypeScript toàn bộ: backend Node với Postgres, UI dùng React + Vite + React Flow, test bằng Vitest, Host Agent viết bằng Node/TypeScript và dùng chung kiểu dữ liệu protocol (Recommended).**
- b. Web app như trên, Host Agent viết bằng Go (một file binary, dễ cài trên Pod Host).
- c. Một framework full-stack (ví dụ Next.js) cho app, Host Agent bằng Node.

**Quyết định:**

### Q14. Google OAuth client và thời hạn phiên đăng nhập (câu hỏi mở 10)

- **a. OAuth client nằm trong một Google Cloud project của công ty, do team lead quản lý; phiên kéo dài 7 ngày, tự gia hạn khi dùng, tối đa 30 ngày (Recommended).**
- b. Một Google Cloud project cá nhân; phiên kéo dài 24 giờ.
- c. Phiên kéo dài đến khi đăng xuất (làm yếu R7).

**Quyết định:**

---

## C. Host Agent, Pod và terminal

### Q15. Kết nối của Host Agent

- **a. Một WebSocket qua HTTPS do Host Agent mở ra, mang lệnh, sự kiện và các đoạn log; mỗi message có id để hai bên tiếp tục được sau khi kết nối lại (Recommended).**
- b. HTTPS long-polling để nhận lệnh, cộng POST để gửi sự kiện và log.
- c. gRPC streaming.

**Quyết định:**

### Q16. Ai điều phối một Run

- **a. App: app giữ toàn bộ trạng thái Run trong database và yêu cầu Host Agent chạy từng Node một; Host Agent chỉ thực thi và báo cáo (Recommended).** Xử lý Interrupted và Retry nằm ở một chỗ.
- b. Host Agent chạy cả Run ngay trên máy và báo tiến độ về.

**Quyết định:**

### Q17. Khi nào Run thành Interrupted

- **a. Heartbeat mỗi 10 giây; quá 30 giây không có heartbeat thì các Run đang Running của Pod thành Interrupted. Run đang Waiting for human không bị Interrupted khi mất kết nối, vì lúc đó không có gì đang chạy (Recommended).**
- b. Interrupted ngay khi mất kết nối.
- c. Chờ 5 phút rồi mới Interrupted, phòng khi Host Agent kết nối lại mà Node vẫn đang chạy.

**Quyết định:**

### Q18. Node vẫn đang chạy khi Host Agent kết nối lại

Sau một lần rớt mạng ngắn, tiến trình Claude Code hoặc shell trong Pod có thể vẫn còn sống.

- **a. Khi kết nối lại, Host Agent kill mọi tiến trình Node mồ côi; Run vẫn ở trạng thái Interrupted và người start Run sẽ retry (Recommended).** Đơn giản, và khớp với quy tắc "không có gì được retry tự động".
- b. Host Agent gắn lại vào tiến trình và Run chạy tiếp nếu chưa bị đánh dấu Interrupted.

**Quyết định:**

### Q19. Kiểm tra trạng thái đăng nhập Claude Code và gh

- **a. Host Agent kiểm tra cả hai (`gh auth status` và một lệnh kiểm tra trạng thái của Claude Code) khi Pod khởi động, sau mỗi phiên terminal đóng lại, trước mỗi Real Run và cứ mỗi 5 phút; đồng thời báo tài khoản gh và scope của token (Recommended).**
- b. Chỉ kiểm tra khi được yêu cầu, bằng nút "Refresh" trên trang Pod.

**Quyết định:**

### Q20. Đường đi của web terminal và những gì được ghi lại

- **a. Browser ↔ app qua WebSocket ↔ Host Agent ↔ `docker exec` có TTY (dùng xterm.js trên browser). Audit log ghi ai mở phiên, lúc bắt đầu và lúc kết thúc, không ghi phím gõ, vì lúc đăng nhập phải gõ secret (Recommended).**
- b. Cùng đường đi như trên, và lưu toàn bộ output của phiên, có che secret.

**Quyết định:**

### Q21. Nhận biết "có image mới hơn" để Recreate

- **a. Cấu hình của app ghi tag image hiện hành; Host Agent pull image đó và so digest với image của từng Pod (Recommended).**
- b. Image đánh số phiên bản; số lớn hơn là mới hơn.

**Quyết định:**

### Q22. Đổi Slot, CPU hoặc RAM của Pod đang có

- **a. Slot đổi được bất cứ lúc nào và áp dụng từ lần xếp lịch tiếp theo (Run đang chạy không bị dừng); CPU và RAM áp dụng ở lần Recreate tiếp theo (Recommended).**
- b. Mọi thay đổi đều yêu cầu Pod không có Run nào đang Running hoặc Waiting.

**Quyết định:**

### Q23. Clone Project trong Workspace

- **a. Real Run đầu tiên của một Project trên một Pod sẽ clone Project đó bằng gh login của người start Run; các Run sau chỉ fetch base branch và tạo thêm worktree (Recommended).**
- b. Chủ Pod tự clone từng Project bằng tay trong terminal.

**Quyết định:**

---

## D. Run engine và Human Node

### Q24. Retry và vị trí trong hàng đợi

Lifecycle ghi Failed hoặc Interrupted → Queued khi Retry.

- **a. Run được retry xếp vào cuối hàng đợi của Pod, như một Run mới (Recommended).**
- b. Run được retry chen lên đầu hàng đợi.

**Quyết định:**

### Q25. Dry-run và Pod Ready

- **a. Dry-run yêu cầu người start Run có Pod (vì nó chiếm một Slot) nhưng không cần đăng nhập Claude Code hay gh, và chạy trong app, không thực thi gì trong Pod (Recommended).**
- b. Dry-run yêu cầu Pod Ready, giống Real Run.
- c. Dry-run không cần Pod và không chiếm Slot (trái với RUN-13).

**Quyết định:**

### Q26. Agent Node trả Output về thế nào

- **a. Prompt của Node yêu cầu Claude Code kết thúc bằng một kết quả có cấu trúc (JSON) nêu từng Output; app kiểm tra kết quả theo Output Type của Node và đánh Node là failed nếu thiếu Output bắt buộc (Recommended).**
- b. Claude Code ghi Output thành file trong một thư mục quy ước của worktree.
- c. Chỉ văn bản tự do; app lưu message cuối cùng làm Output.

**Quyết định:**

### Q27. Command Node trả Output về thế nào

- **a. Exit code 0 là thành công, khác 0 là thất bại. Output `test-result` gồm exit code và 200 dòng output cuối; Output `branch` là branch của Run tại commit hiện tại (Recommended).**
- b. Lệnh in ra một dòng JSON chứa các Output.

**Quyết định:**

### Q28. Đặt tên branch của Run

- **a. `clauderon/<số-issue>-<slug-ngắn-của-tiêu-đề>-<run-id-ngắn>` (Recommended).**
- b. `feat/<số-issue>-<slug>`, như trong ví dụ của Dry-run.
- c. Agent Node tự đặt tên.

**Quyết định:**

### Q29. Grill hoạt động thế nào

- **a. Grill Node chạy Claude Code với kết quả có cấu trúc, hoặc là `{ question }`, hoặc là các Output của Node. Nếu là câu hỏi, Run chuyển sang Waiting for human; câu trả lời của Member sẽ resume đúng phiên Claude Code đó; lặp lại cho đến khi có Output (Recommended).**
- b. Claude hỏi tất cả câu hỏi một lần, một Member trả lời hết trong một form, rồi Claude tạo Output.

**Quyết định:**

### Q30. Giới hạn số vòng Grill

- **a. Không giới hạn; Member nào cũng có thể Cancel (Recommended).**
- b. Giới hạn mỗi Node (ví dụ 10 vòng), quá thì Node thất bại.

**Quyết định:**

### Q31. Truyền feedback của Reject khi Retry

- **a. Feedback Reject gần nhất của Run được thêm vào instructions của Node được retry, dưới tiêu đề "Feedback from the last review" (Recommended).**
- b. Chỉ truyền khi Node được retry là Node ngay trước Approve Node đã reject.

**Quyết định:**

### Q32. Nhiều end Node và khi nào Run thành công

FLW-5 cho phép có nhiều end Node.

- **a. Run thành công khi mọi Node mà nó đi tới được đều thành công; Output không bắt buộc mà không được tạo thì không làm Run thất bại (Recommended).**
- b. Run thành công khi bất kỳ end Node nào thành công.

**Quyết định:**

### Q33. Node không tạo ra thay đổi nào

RUN-11 chỉ mở pull request khi có thay đổi.

- **a. `Open a pull request` thành công mà không có Output `pull-request` và ghi log "no changes"; Run thành công và Ticket Status vẫn là `Open` (Recommended).**
- b. Node thất bại, để Member để ý và tự quyết định.

**Quyết định:**

---

## E. Ticket, GitHub và Artifact

### Q34. Sync lấy những gì

- **a. Mọi issue đang mở của Project, cộng trạng thái hiện tại của mọi Ticket đã biết (để issue đã đóng trên GitHub hiện `Closed`) và của mọi pull request do Run mở (Recommended).**
- b. Chỉ issue đang mở; Ticket đã đóng trên GitHub biến mất khỏi danh sách.

**Quyết định:**

### Q35. Giữ `PR open` / `PR merged` luôn cập nhật

Sync tự động nằm ngoài phạm vi.

- **a. Trạng thái pull request được đọc khi Sync và mỗi khi mở trang Ticket, Run hoặc Batch (Recommended).**
- b. Chỉ đọc khi Sync.

**Quyết định:**

### Q36. Ghi Artifact vào nội dung pull request

Pull request được một Node mở trước khi Run kết thúc, nhưng TRK-5 lại ghi Artifact vào nội dung pull request khi Run kết thúc. Trong khi đó app không bao giờ ghi lên GitHub (ADR 0001).

- **a. Khi Run kết thúc, app yêu cầu Host Agent sửa nội dung pull request bằng gh login của người start Run ngay trong Pod, như một bước hệ thống cuối cùng nằm ngoài Flow (Recommended).** Vẫn là ghi từ Pod, nên ADR 0001 vẫn đúng.
- b. `Open a pull request` ghi những gì nó biết tại thời điểm đó; Artifact chỉ hiện trong app.
- c. Bắt buộc `Open a pull request` là Node cuối cùng, và ghép Artifact ngay trước nó.

**Quyết định:**

### Q37. Key của Ticket khi có nhiều organisation

TIC-1 hiển thị key dạng `ledger-api#412`.

- **a. Dùng tên repo; nếu hai Project trùng tên thì hiển thị `owner/repo#n` cho cả hai (Recommended).**
- b. Luôn dùng `owner/repo#n`.

**Quyết định:**

### Q38. Loại token GitHub chỉ đọc

- **a. Một fine-grained personal access token có quyền Issues: read và Pull requests: read trên các repo của Project, đặt trong cấu hình của app (Recommended).**
- b. Một GitHub App cài trên các repo, chỉ đọc.

**Quyết định:**

### Q39. Bật một Project

- **a. Gõ `owner/repo`; app dùng token của nó kiểm tra repo đọc được không và đưa ra danh sách branch để chọn base branch (Recommended).**
- b. Chọn từ danh sách mọi repo mà token đọc được.

**Quyết định:**

---

## F. Flow

### Q40. Thao tác trên Flow đang bị khoá

FLW-7 khoá Flow khi có Active Run đang dùng nó.

- **a. Flow bị khoá vẫn xem và clone được, nhưng không sửa hay xoá được; editor cho biết Run nào đang giữ khoá (Recommended).**
- b. Flow bị khoá cũng không clone được.

**Quyết định:**

### Q41. Ai được sửa hoặc xoá Flow, Task

v1 không có phân quyền.

- **a. Member nào cũng sửa hoặc xoá được mọi Flow, Task không phải mẫu; mọi thay đổi đều được audit (Recommended).**
- b. Chỉ Member đã tạo ra nó.

**Quyết định:**

### Q42. Sửa một Task đang được Flow dùng

- **a. Không sửa được Task khi có Flow nào dùng nó đang bị khoá; khi sửa thì mọi Flow dùng Task đó đều thay đổi theo (Recommended).**
- b. Node copy Task khi được thêm vào, nên sửa Task không bao giờ làm thay đổi Flow đã có.

**Quyết định:**

---

## G. Đăng nhập, log và audit

### Q43. Định dạng allowlist

- **a. Một danh sách email cách nhau bằng dấu phẩy trong một biến môi trường, so sánh không phân biệt hoa thường; đổi danh sách cần restart hoặc deploy lại (Recommended).**
- b. Một file cấu hình được đọc lại khi thay đổi, không cần restart.

**Quyết định:**

### Q44. Kết thúc phiên của email bị gỡ khỏi allowlist

- **a. Mỗi request đều kiểm tra email của phiên với allowlist, nên việc gỡ có hiệu lực ngay ở request tiếp theo, kể cả các kết nối WebSocket và terminal đang mở (Recommended).**
- b. Phiên kết thúc ở lần gia hạn tiếp theo.

**Quyết định:**

### Q45. Cho phép cả một domain công ty

- **a. Không; allowlist chỉ gồm email chính xác, vì Gmail cá nhân cũng được dùng (Recommended).**
- b. Cho phép thêm mục dạng `@company.com` để mở cho cả domain.

**Quyết định:**

### Q46. Che secret trong log

NFR-1 yêu cầu che token và secret trong mọi log.

- **a. Host Agent và app che các mẫu token đã biết (GitHub, Anthropic, OAuth) và giá trị của các secret đã biết trước khi lưu hoặc stream bất kỳ dòng log nào (Recommended).**
- b. Chỉ che giá trị các secret mà app đang giữ.

**Quyết định:**

### Q47. Lưu log ở đâu

- **a. Trong Postgres, chia thành từng đoạn theo Attempt, xoá theo job giữ log ở Q12 (Recommended).**
- b. Trong object storage, Postgres chỉ giữ chỉ mục.

**Quyết định:**

---

## Tóm tắt các gợi ý

Nếu team đồng ý với mọi gợi ý, spec sẽ dựa trên các điểm sau:

- Một seam test: app core với Host Agent giả nói đúng protocol thật; một spec cho toàn bộ v1, publish thành GitHub issue gắn label `ready-for-agent`; một repo chứa app, Host Agent và image.
- Host trên một nền tảng cloud có quản lý với Postgres; TypeScript toàn bộ; Host Agent cài như service của hệ điều hành và kết nối bằng secret trong cấu hình.
- Pod mặc định 2 CPU, 4 GB RAM, 2 Slot; image build bằng CI, có Node, Python và Claude Code.
- App điều phối Run từng Node một qua một WebSocket có thể resume; 30 giây không có heartbeat thì Run đang Running thành Interrupted; tiến trình mồ côi bị kill.
- Agent Node và Grill Node trả kết quả có cấu trúc; Grill resume đúng phiên Claude Code; feedback Reject được thêm vào Node được retry.
- Artifact được ghép từ các Output và ghi vào nội dung pull request từ trong Pod khi Run kết thúc.
- Sync cập nhật cả Ticket và pull request đã biết; trạng thái pull request cũng được đọc khi mở trang.
- Phiên đăng nhập 7 ngày (tối đa 30); allowlist được kiểm tra ở mọi request; log lưu trong Postgres 90 ngày.
