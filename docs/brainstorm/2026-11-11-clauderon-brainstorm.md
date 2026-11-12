# Clauderon — Ghi chú brainstorm (2026-11-11)

> Trạng thái: **đang brainstorm** (path Architectural). Chưa có spec, chưa có code.
> Tiếp tục từ: **chốt Q6 → đề xuất tech stack → trình bày design từng phần → viết spec.**

## 1. Ý tưởng gốc

> "A platform that enables Claude-subscription users to collaborate on a platform with cloud-based resources, project gets dedicated VM, developer can connect their personal machine, and collaborate in a Claude-like, n8n-like workflow."

Làm **MVP trước**, tính năng phức tạp để giai đoạn sau.

## 2. Quy trình đang theo

Skill `superpowers:brainstorming`, path **Architectural** (dự án mới, thư mục trống):

1. ✅ Khám phá context (thư mục `clauderon` trống)
2. 🔄 Hỏi làm rõ từng câu (Q1–Q5 xong, Q6 đang chờ chốt)
3. ⏳ Đề xuất 2–3 hướng tiếp cận (tech stack) + khuyến nghị
4. ⏳ Trình bày design theo từng phần, duyệt từng phần
5. ⏳ Viết spec → `docs/superpowers/specs/YYYY-MM-DD-clauderon-design.md`
6. ⏳ Tự review spec → bạn review spec
7. ⏳ Viết implementation plan (skill `writing-plans`)

**Không code cho tới khi spec được duyệt.**

## 3. Các quyết định

| # | Chủ đề | Lựa chọn | Trạng thái |
|---|---|---|---|
| Q1 | Giá trị cốt lõi của MVP | **"n8n cho Claude"**: dựng workflow nhiều bước, mỗi node là tác vụ Claude, chạy trên VM | ✅ chốt |
| — | Phạm vi | **1 project, 1 VM, 2 máy dev** kết nối vào | ✅ chốt |
| Q2 | Vai trò máy dev | **Chỉ là client** (trình duyệt). Mọi node chạy trên VM. Mọi user **quyền như nhau** | ✅ chốt |
| Q3 | Tài khoản Claude trên VM | **Ai bấm Run thì dùng subscription của người đó.** Token lưu mã hóa trên platform | ✅ chốt |
| Q4 | Loại node | **Claude Task + Shell + Condition**, đồ thị DAG, cho phép vòng lặp có giới hạn | ✅ chốt |
| Q5 | Mức cộng tác | **Last-write-wins + cảnh báo** khi người khác vừa lưu. **Log/trạng thái run real-time** cho mọi người | ✅ chốt |
| Q6 | Đặt VM ở đâu | **Hyper-V VM (Ubuntu) trên PC 1 + Tailscale** để PC 2 truy cập. Khi demo hoặc dùng thật thì chuyển lên cloud VM (Hetzner/DO ~5 USD/tháng) | 🟡 **đề xuất, chưa chốt** |

Phương án đã loại cho Q6: WSL2 (cách ly yếu, Claude có thể đụng ổ Windows); platform tự cấp VM qua cloud API (để sau); Docker container (để sau).

## 4. Kiến trúc đã thống nhất (khái niệm)

```
 [PC 2 · Trình duyệt An]          [PC 1 · Trình duyệt Toi]
          │ (Tailscale)                    │
          ▼                                ▼
 ┌──────────── Hyper-V VM · Ubuntu (trên PC 1) ─────────────┐
 │  PLATFORM                                                 │
 │   Web app (UI + WebSocket) ── Orchestrator ── Database    │
 │                                    │      └── Token vault │
 │                                    │ WebSocket nội bộ     │
 │  RUNNER AGENT (process riêng)      ▼                      │
 │   Runner ── Claude Code CLI ── Repo workspace             │
 └──────────────────────────────┬────────────────────────────┘
                                ▼ HTTPS
                     Anthropic (subscription từng user)
```

**Nguyên tắc chính:**
- **Thiết kế workflow trên web app, VM chạy thật** theo thiết kế đó.
- **Orchestrator là "nhạc trưởng":** gửi **từng node một** xuống runner, đánh giá Condition, đếm vòng lặp, timeout. Runner **"ngu" và đơn giản**: nhận lệnh → chạy → stream log → trả kết quả.
- Runner **tự kết nối ra** Orchestrator (không cần mở port). Sau này muốn nhiều VM thì chỉ cần cài runner ở nơi khác.
- MVP: platform và runner **chung một VM**, nhưng là **2 process tách biệt**.
- Chạy trong VM (không chạy thẳng trên máy host), vì Claude Code sửa file và chạy lệnh tùy ý, cần cách ly.

**Luồng chạy một node (8 bước):**
1. Toi bấm Run trên web app
2. Orchestrator đọc workflow từ Database
3. Lấy token Claude của Toi từ vault (giải mã trong bộ nhớ)
4. Gửi node xuống Runner kèm token
5. Runner gọi `claude -p "<prompt>"` trong thư mục repo; Claude dùng subscription của Toi
6. Claude sửa file trong repo workspace
7. Log stream ngược về; web app phát tới **cả hai** trình duyệt
8. Node xong → Orchestrator chọn node kế tiếp, lặp lại từ bước 4

**Ví dụ workflow mẫu ("Fix bug từ issue"):**
`Bắt đầu → Claude: viết fix → Shell: npm test → Condition: pass?`
- Có → Claude: review & tóm tắt → Kết thúc
- Không → Claude: sửa test fail (tối đa 3 lần) → quay lại Shell: npm test

## 5. Phạm vi

**MVP**
- 1 project, 1 VM, 2 dev, quyền như nhau
- Canvas dựng workflow (kéo thả node, nối cạnh)
- 3 loại node: Claude Task, Shell, Condition (+ vòng lặp có giới hạn)
- Run thủ công, log/trạng thái real-time
- Kết nối và lưu token Claude của từng user (mã hóa)
- Lịch sử run

**Giai đoạn sau**
- Phân quyền admin / dev / QA
- Trigger: webhook, cron, GitHub
- Node Human Approval
- Chạy node song song
- Co-edit canvas real-time (kiểu Figma, CRDT/Yjs)
- Platform tự cấp VM trên cloud; nhiều project, nhiều VM
- Máy dev làm nơi thực thi node (hướng Q2-B đã loại khỏi MVP)
- Push/PR lên Git tự động

## 6. Câu hỏi mở và rủi ro (xử lý ngày mai)

1. **Chốt Q6.** PC 2 dùng cùng mạng LAN hay ở nơi khác? (Ảnh hưởng tới việc có cần Tailscale không.)
2. **⚠️ Kiểm tra chính sách Anthropic (quan trọng nhất):** việc lưu token đăng nhập subscription của user và dùng nó để chạy Claude Code headless trên VM, thông qua một platform bên thứ ba, có được phép theo điều khoản hiện hành không? Cách kỹ thuật để lấy token là gì (ví dụ `claude setup-token`)? → Cần đọc tài liệu chính thức trước khi viết spec. Nếu không được phép, phương án dự phòng là Q3-C (API key).
3. **Tech stack** chưa bàn (backend, frontend canvas, DB, giao thức runner).
4. **Repo workspace:** clone từ đâu (GitHub?) và quản lý credential Git thế nào?
5. **Context giữa các node:** output node trước truyền cho node sau dạng gì (toàn bộ stdout, tóm tắt, file)?
6. **Chạy đồng thời:** hai người cùng bấm Run một lúc thì xử lý ra sao (queue hay chặn)? MVP đề xuất: mỗi lúc chỉ một run.

## 7. Bước tiếp theo

1. Chốt Q6 + trả lời câu hỏi LAN/remote
2. Xác minh chính sách và cách auth subscription của Claude Code (mục 6.2)
3. Claude đề xuất 2–3 phương án tech stack + khuyến nghị
4. Trình bày design từng phần: data model, orchestrator, giao thức runner, realtime, bảo mật token, xử lý lỗi, testing
5. Viết spec → review → plan

## 8. Tài liệu đính kèm

| Tài liệu | Vị trí |
|---|---|
| Prototype tương tác (app + kiến trúc), bản online | https://claude.ai/artifact/1EsKDBS5ch2mG6T6v97X3d *(private, chỉ bạn mở được)* |
| Prototype, bản local (mở bằng trình duyệt) | [`prototype/clauderon-prototype.html`](prototype/clauderon-prototype.html) |

Ghi chú về bản local: file HTML được viết cho môi trường artifact. Mở trực tiếp vẫn chạy được, font tải từ Google Fonts nên cần có mạng.

**Cách tiếp tục ngày mai:** mở Claude Code tại `D:\home\study\AI\toi-nguyen\clauderon` và nói:
> "Đọc `docs/brainstorm/2026-11-11-clauderon-brainstorm.md` và tiếp tục brainstorm từ mục 7."
