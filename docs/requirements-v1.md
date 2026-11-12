# Clauderon — Requirements v1

> **Phiên bản:** v1 · **Ngày:** 2026-11-12 · **Trạng thái:** Requirement đã chốt qua brainstorm, chưa có design/spec kỹ thuật, chưa code.
> **Nguồn:** plan gốc `agilab-practice-plan.md` + các quyết định brainstorm ngày 2026-11-12 (mục 9).
> **Bước tiếp theo:** trình bày design từng phần → viết spec → implementation plan (xem mục 12).

---

## 1. Tổng quan

**Clauderon** là bản thu nhỏ của **AgiLab Console**: một console để giao việc cho agent (Claude) theo quy trình chuẩn hóa. Gồm 4 module:

- **Pods**: máy ảo gán cho project. Agent clone repo và chạy trên đây.
- **Flows**: quy trình dạng graph node (giống n8n). Mỗi node là một **Task** có input/output theo kiểu artifact (`issue`, `plan`, `branch`, `pull-request`, `review`…).
- **Tickets**: đầu vào của flow, import từ **GitHub issues**.
- **Runs**: một lần chạy flow cho một ticket. Mỗi task do **Claude thật** xử lý và có thể dừng chờ người (grill plan, approve plan, review PR).

**Luồng sử dụng thực tế:**

```
Setup pod  →  Tạo flows  →  Chọn ticket, Run theo flow đã chọn  →  Track runs & outputs
```

**Use case:** một dev setup pod cho project, dựng flow "ticket → code → PR", chọn vài ticket bấm Run, rồi theo dõi từng run chạy qua các node và xem output (branch, PR, summary) ở một chỗ.

**Mục đích:** học cách mô hình hóa domain (pod / flow / task / run / artifact) và cách làm UI cho workflow, **đồng thời chạy end-to-end với Claude, VM và GitHub thật**.

**Khác với plan gốc:** plan gốc dùng mock runner, pod chỉ là metadata, không có PR thật. Bản v1 chuyển các phần đó sang **thật**, và giữ mock ở dạng **chế độ dry-run** để test scheduler.

---

## 2. Mục tiêu & thước đo thành công

### Mục tiêu
1. Hiểu và cài đặt được data model: Project, Pod, Ticket, Task, Flow (graph), Run, RunStep (attempt), Artifact.
2. Dựng UI cho 4 màn hình: **Tickets**, **Flows** (list + canvas builder), **Pods**, **Runs**.
3. Chạy luồng end-to-end với **Claude thật trên pod VM**, tạo **branch và PR thật** trên GitHub, có trạng thái và bước chờ người.
4. Tự rút ra nhận xét UX cho prototype gốc.

### Thước đo thành công
| # | Tiêu chí | Cách kiểm |
|---|----------|-----------|
| M1 | **Dry-run:** đi hết luồng demo trong ≤ 5 phút: đăng ký pod → tạo flow 3 node → run 3 ticket → thấy 3 PR giả lập | Tự demo, bấm giờ |
| M1b | **Real:** 1 ticket GitHub thật chạy hết flow `Basic ticket delivery` → có **PR thật** trên GitHub, link hiển thị trong run | Demo thật |
| M2 | Mỗi run hiển thị đúng trạng thái từng node: `queued / running / waiting_for_human / succeeded / failed` | Kịch bản test thủ công + unit test runner |
| M3 | Flow builder **chặn nối sai kiểu** (ví dụ `issue` → input cần `pull-request`) và **chặn chu trình** | Unit test validator |
| M4 | **Dry-run** 10 ticket cùng lúc trên 1 pod: không lúc nào vượt `maxConcurrentRuns`, phần dư ở trạng thái `queued` rồi lần lượt chạy | Test với seed 10 ticket |
| M5 | Reload trang không mất dữ liệu (pods, flows, runs) | Kiểm tay |
| M6 | Có file `NOTES.md` ghi ≥ 5 nhận xét/đề xuất UX cho prototype gốc | Review cuối |

> M1 và M4 đã được điều chỉnh so với plan gốc: Claude thật không thể chạy 3 run trong 5 phút, và chạy 10 run song song sẽ ăn hết quota subscription.

---

## 3. Phạm vi

### Trong phạm vi
- **Pods:** 1 pod VM thật (tự tạo), đăng ký vào project, giới hạn run song song, metadata forward port, panel chi tiết.
- **Tickets:** import GitHub issues bằng nút **Sync**; list, filter, chi tiết, chọn nhiều để Run.
- **Flows:** danh sách flow + task; canvas kéo-thả; nối cạnh theo kiểu artifact; set flow Default; validate trước khi lưu.
- **Runs:** start run (1 hoặc nhiều ticket); timeline theo node; log; Approve/Answer cho bước chờ người; xem output artifacts; retry node; usage theo node.
- **Runner thật:** Claude Code chạy trên pod, mỗi run một git worktree, push branch và mở PR thật.
- **Chế độ dry-run:** runner giả lập (timer + kết quả ngẫu nhiên có seed), dùng để test scheduler và demo.

### Ngoài phạm vi
- **Nhiều pod:** chế độ *Auto*, đổi pod Default, chia ticket vào nhiều pod.
- Tự provision VM từ app; Tailscale; port forward thật.
- Auth, phân quyền, nhiều người dùng, multi-tenant, billing.
- Plugin system, version task (`agilab-sdlc@0.5.0`), "Build with agent".
- **Trackers** tự start run khi có ticket mới; tự đồng bộ issue định kỳ hoặc qua webhook.
- Vòng lặp trong flow (chu trình).

---

## 4. Yêu cầu chức năng

Cột **Thay đổi** so với plan gốc: `=` giữ nguyên · `~` sửa · `+` mới · `−` bỏ.

### 4.1 Pods
| ID | Yêu cầu | Thay đổi |
|----|---------|----------|
| POD-1 | Xem pod của project: tên, status (`online / offline`, theo kết nối của runner), CPU·RAM·Disk (khai báo khi đăng ký), badge **Default**. | ~ |
| POD-2 | **Đăng ký pod**: khai báo VM đã tự tạo (tên, địa chỉ, thông số) và gán vào project. Pod duy nhất tự là Default. | ~ |
| POD-3 | ~~Make the default / Take out of the project giữa nhiều pod.~~ Chỉ còn **gỡ pod khỏi project**; không cho gỡ khi đang có run `running`. | − / ~ |
| POD-4 | Cấu hình `maxConcurrentRuns` cho pod (mặc định 2). | = |
| POD-5 | Forward port (metadata): số port, label, mức truy cập `private / internet+sign-in / public`. Mức `public` hiển thị cảnh báo đỏ. | = |
| POD-6 | Panel Details: image, login, address, created, có nút copy. | = |
| POD-7 | Hiển thị trạng thái kết nối pod và thời điểm heartbeat gần nhất. Pod `offline` thì không nhận run mới; run mới ở trạng thái `queued`. | + |

### 4.2 Tickets
| ID | Yêu cầu | Thay đổi |
|----|---------|----------|
| TIC-1 | Danh sách ticket: key (`ledger-api#412`), title, repo, trạng thái (`open / in_run / pr_opened / done`). | = |
| TIC-2 | Search theo title/key; filter theo repo và trạng thái. | = |
| TIC-3 | Chọn nhiều ticket → **Run with flow…** | = |
| TIC-4 | Chi tiết ticket: mô tả (từ GitHub issue), các run đã chạy cho ticket, link tới output. | = |
| TIC-5 | Nút **Sync**: kéo GitHub issues (đang mở) của repo đã cấu hình vào danh sách ticket. Sync không tự start run. | + |

### 4.3 Flows
| ID | Yêu cầu | Thay đổi |
|----|---------|----------|
| FLW-1 | Danh sách Flows và Tasks, mỗi card hiện input → output, nguồn (`Built-in / Project`), tag. | = |
| FLW-2 | Canvas kéo-thả: kéo task từ thư viện vào, nối port output → input. | = |
| FLW-3 | **Type-check cạnh**: chỉ cho nối khi kiểu artifact khớp; báo lỗi ngay trên cạnh. | = |
| FLW-4 | Panel chi tiết node: tên, instructions riêng, bật/tắt output tùy chọn, cờ `requiresHuman` (`grill` / `approve` / `review`). | = |
| FLW-5 | Validate trước khi lưu: đúng 1 node input, ít nhất 1 output, **không có chu trình**, không có input bắt buộc bị bỏ trống. Flow lỗi hiện badge "N problems". | = |
| FLW-6 | Set flow **Default** cho project. Flow Built-in là read-only, có nút **Copy to project**. | = |
| FLW-7 | Seed sẵn 3 task (`Grill a plan`, `Code a change`, `Open a pull request`) và 2 flow (`Basic ticket delivery`, `Plan and deliver`). | = |

### 4.4 Runs
| ID | Yêu cầu | Thay đổi |
|----|---------|----------|
| RUN-1 | Hộp thoại Run: chọn flow (mặc định = Default), ticket(s), repo, extra instructions, **chế độ `Real / Dry-run`**. Pod luôn là pod của project. | ~ |
| RUN-2 | Scheduler: xếp run vào pod theo `maxConcurrentRuns`; vượt giới hạn thì `queued`, có slot trống thì chạy theo thứ tự FIFO. | ~ |
| RUN-3 | Danh sách Runs: ticket, flow, chế độ, trạng thái, thời gian; filter theo trạng thái/flow. | ~ |
| RUN-4 | Chi tiết run: timeline theo node (trạng thái, thời gian, log), output artifact của từng node. | = |
| RUN-5 | Node `requiresHuman` dừng ở `waiting_for_human`. UI cho phép **Answer** (grill), **Approve/Reject** (plan), **Approve/Request changes** (review). | = |
| RUN-6 | Hàng chờ **"Needs you"**: gom mọi bước đang chờ người trên mọi run vào một chỗ, hiện thời gian còn lại trước timeout. | ~ |
| RUN-7 | Cancel run. **Retry node lỗi**: chạy lại đúng node đó trong cùng run, mỗi lần là một *attempt* mới; output và log các attempt cũ vẫn xem được. | ~ |
| RUN-8 | **Dry-run runner**: mỗi node chạy 2–8s, tỉ lệ fail cấu hình được, sinh output giả (`branch: feat/412-retry`, `pr: #88`). | ~ |
| RUN-9 | **Real runner**: mỗi node chạy Claude Code trên pod bằng subscription của người dùng; log stream về UI. | + |
| RUN-10 | Mỗi run có **git worktree và branch riêng** trên pod; nhiều run cùng repo không đụng nhau. Worktree được dọn khi run kết thúc. | + |
| RUN-11 | Output `branch` và `pull-request` là **thật**: push branch và mở PR trên GitHub; run hiển thị link PR. Ticket chuyển sang `pr_opened`. | + |
| RUN-12 | **Timeout chờ người: 1 giờ.** Quá hạn thì node và run chuyển sang `failed` (lý do: timeout); vẫn Retry node được. | + |
| RUN-13 | **Usage:** hiển thị token và thời gian theo từng node, cộng tổng theo run (lấy từ kết quả Claude Code trả về). | + |

---

## 5. Ràng buộc & giả định

### Ràng buộc
- Làm **một mình**, **10 ngày** (xem mục 7).
- Claude chạy bằng **subscription cá nhân** của người dùng, nên bị giới hạn quota theo khung thời gian.
- Chỉ **1 pod**, là VM do người dùng tự tạo và quản lý.
- Repo GitHub là **repo công ty**.

### Giả định
- Chỉ **1 project** và **1 người dùng**.
- Kiểu artifact cố định: `issue, plan, branch, pull-request, review, summary, adr`.
- DAG chạy theo topological order: một node chỉ chạy khi mọi input bắt buộc đã có. Các nhánh độc lập chạy song song trong cùng run.
- Run đang `waiting_for_human` **vẫn chiếm slot** của pod *(giả định, cần xác nhận trong design)*.
- Tech stack: **chưa quyết định** (plan gốc gợi ý React + TypeScript + Vite + React Flow + Zustand + Vitest).

---

## 6. Rủi ro

| # | Rủi ro | Mức | Giảm thiểu |
|---|--------|-----|------------|
| R1 | **Chính sách công ty:** repo công ty + (có thể) PC công ty + subscription Claude cá nhân + bot tự mở PR | Cao | Hỏi IT/lead **trước ngày 1**. Phương án dự phòng: repo sandbox, VM trên PC cá nhân |
| R2 | **10 ngày không đủ** khi thêm Claude, VM và GitHub thật | Cao | Làm dry-run end-to-end trước, phần thật làm sau. Có danh sách cắt giảm (mục 7) |
| R3 | **Điều khoản Anthropic** khi chạy Claude Code headless bằng subscription từ một app riêng | Trung bình | Xác minh tài liệu chính thức trong design. Dự phòng: API key |
| R4 | Hết quota subscription giữa run | Trung bình | Node fail với lý do rõ ràng, có Retry. Test tải bằng dry-run |
| R5 | Timeout 1 giờ làm run fail khi người dùng vắng mặt | Thấp | Retry node; hiện countdown ở "Needs you" |

---

## 7. Lộ trình (10 ngày)

| Milestone | Ngày | Nội dung | Kết quả kiểm được |
|-----------|------|----------|-------------------|
| **M0 — Model & seed** | 1 | Types, store, seed (pod, tasks, flows), persist | Unit test model pass |
| **M1 — Pods** | 2 | POD-1 → POD-7, setup VM, runner kết nối được | Pod hiện `online` |
| **M2 — Tickets** | 3 | TIC-1 → TIC-5, Sync GitHub issues | Thấy issue thật, filter, multi-select |
| **M3 — Flow builder** | 4–5 | FLW-1 → FLW-7 | Dựng được `Plan and deliver`; nối sai kiểu và chu trình bị chặn |
| **M4 — Scheduler + dry-run** | 6 | RUN-1, RUN-2, RUN-8 | Metric M4 (10 ticket dry-run) |
| **M5 — Run tracking + chờ người** | 7 | RUN-3 → RUN-7, RUN-12 | Metric M1 (dry-run ≤ 5 phút) |
| **M6 — Real runner** | 8–9 | RUN-9, RUN-10, RUN-11, RUN-13 | Metric M1b (PR thật) |
| **M7 — Polish & notes** | 10 | Sửa bug, metric M5, `NOTES.md` | Demo + ≥ 5 đề xuất UX |

**Danh sách cắt giảm nếu trễ** (theo thứ tự cắt trước): POD-5 → POD-6 → RUN-13 → FLW-6 (Copy to project) → RUN-6 countdown → loại `grill` trong RUN-5.

---

## 8. Câu hỏi mở

1. **Vị trí pod:** PC công ty (đang nghiêng về) hay PC cá nhân? Phụ thuộc R1.
2. **Công ty có cho phép** dùng repo công ty + Claude cá nhân + bot mở PR không?
3. **Grill với Claude thật** hoạt động thế nào: Claude hỏi, người trả lời, rồi Claude tiếp tục cùng session (resume) hay chạy lại với câu trả lời làm context?
4. Run đang `waiting_for_human` có chiếm slot của pod không (giả định hiện tại: có)?
5. **Xác thực GitHub:** token cá nhân, fine-grained PAT hay GitHub App? Token đặt ở đâu (pod hay app)?
6. Khi nào ticket chuyển `done`: khi PR được merge, hay khi run thành công?
7. Worktree của run `failed` có giữ lại để debug không, giữ bao lâu?
8. Tech stack (để quyết định ở bước design).

---

## 9. Nhật ký quyết định (brainstorm 2026-11-12)

| Chủ đề | Quyết định |
|--------|-----------|
| Quan hệ với AgiLab | Clauderon = bản AgiLab mini; 4 module Pods / Tickets / Flows / Runs |
| Agent | Claude thật (không chỉ mock) |
| Tài khoản Claude | Subscription của người dùng |
| Pod | VM thật, **1 pod**, tự tạo cố định; bỏ rule nhiều pod |
| Vị trí pod | Chưa chốt, nghiêng về PC công ty |
| Cách ly run | Git worktree mỗi run |
| GitHub | Branch + PR thật, repo công ty |
| Tickets | Import GitHub issues, nút Sync thủ công |
| Vòng lặp | Cấm chu trình |
| Chờ người | Giữ Grill / Approve / Review; timeout 1 giờ thì tự fail |
| Retry | Retry node, giữ lịch sử attempt |
| Usage | Token + thời gian theo node và tổng run |
| Test tải | Dry-run cho 10 ticket |
| Phạm vi / thời gian | Giữ nguyên (trừ rule nhiều pod), 10 ngày |
| Tech stack | Quyết định sau |

---

## 10. Thuật ngữ

| Thuật ngữ | Nghĩa |
|-----------|-------|
| Pod | VM gán cho project, nơi runner và Claude Code chạy |
| Task | Định nghĩa một bước: instructions + kiểu input/output artifact |
| Flow | Graph (DAG) các node, mỗi node là một Task |
| Ticket | Đầu vào của run (GitHub issue, artifact `issue`) |
| Run | Một lần chạy flow cho một ticket |
| RunStep / Attempt | Một lần thực thi một node trong run; retry tạo attempt mới |
| Artifact | Dữ liệu có kiểu đi giữa các node (`plan`, `branch`, `pull-request`…) |
| Dry-run | Chế độ chạy giả lập, không gọi Claude, không đụng GitHub |

---

## 11. Tài liệu liên quan

- Plan gốc: `c:\Users\Toi Nguyen\Downloads\agilab-practice-plan.md`

## 12. Bước tiếp theo

1. Trả lời câu hỏi mở #1, #2 (chính sách công ty) càng sớm càng tốt.
2. Trình bày design từng phần: data model → run engine và scheduler → human-in-the-loop → tích hợp pod / Claude / GitHub → xử lý lỗi → testing.
3. Chọn tech stack.
4. Viết spec → review → implementation plan.

**Tiếp tục phiên sau:** mở Claude Code tại thư mục `clauderon` và nói *"Đọc `docs/requirements-v1.md` và tiếp tục từ mục 12."*
