# Clauderon v1 — bản đề xuất của Toi (TN)

Thư mục này chứa cách hiểu của Toi về requirement v1 của Clauderon. Mỗi dev viết bản đề xuất riêng từ cùng một ý tưởng, sau đó hai bên thảo luận để gộp thành một bản thống nhất. Bản này là đề xuất, chưa phải bản chốt.

| Tài liệu | Nội dung |
|---|---|
| [requirements-v1.md](requirements-v1.md) | Requirement v1: phạm vi, yêu cầu chức năng (POD / TIC / FLW / RUN), rủi ro, lộ trình 10 ngày, câu hỏi mở, nhật ký quyết định |
| [prototype/clauderon-console.html](prototype/clauderon-console.html) | Demo app bấm được, mô phỏng toàn bộ luồng. Mở bằng trình duyệt. Bản online (private): https://claude.ai/artifact/6SfXGg8SzEH8MDswxAn52Z |

## Luồng chính

```
Setup pod → Tạo flows → Chọn ticket, Run theo flow → Track runs & outputs
```

## Khác biệt chính so với bản đề xuất kia (để thảo luận)

Bản đề xuất kia gồm Claude Doc được link trong [docs/requirements/README.md](../requirements/README.md), cùng `CONTEXT.md` và `docs/adr/`.

- Bản này: **1 người dùng, 1 pod**, dùng subscription Claude của người dùng.
- Bản kia: một team, mỗi Run chạy với GitHub token của người bắt đầu Run.
- Thuật ngữ: bản này dùng "VM", "runner", trong khi `CONTEXT.md` khuyên tránh hai từ này. Cần thống nhất khi gộp.

## Ghi chú về demo app

- Dữ liệu là mẫu. Claude, git worktree và GitHub PR đều là giả lập.
- Dữ liệu lưu trong trình duyệt (localStorage). Nút **Reset dữ liệu** đưa về trạng thái ban đầu.
- Mở trực tiếp file local cần có mạng để tải font từ Google Fonts. Không có mạng thì vẫn chạy, chỉ là font khác.
