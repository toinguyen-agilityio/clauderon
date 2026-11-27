import type { Lang } from "./storage";
import type { Area, Need, StepId } from "./steps";

type Table = {
  /** What each main area is for and what to do next: the tour step and the help icon show the same text. */
  area: Record<Area, { title: string; help: string }>;
  start: { title: string; body: string };
  missing: Record<Need, { title: string; body: string; link: string }>;
  ui: {
    next: string;
    back: string;
    skip: string;
    done: string;
    progress: string;
    takeTheTour: string;
    dismiss: string;
    language: string;
    pickTicket: string;
    startSample: string;
    starting: string;
    started: string;
    noWait: string;
    waitingForPr: string;
  };
};

export const COPY: Record<Lang, Table> = {
  en: {
    area: {
      machines: { title: "Machines", help: "Your own computer, paired so Runs execute there. Pair it first, then check that Claude Code and gh are logged in." },
      tickets: { title: "Tickets", help: "GitHub issues you can work on. Pick one and start a Run from here." },
      flows: { title: "Flows", help: "A Flow is the chain of steps a Run follows. Pick the one this Ticket should use." },
      runs: { title: "Runs", help: "Each Run is one Flow working on one Ticket. Follow it here, and answer under Needs you when it asks." },
      needsYou: { title: "Needs you", help: "Runs waiting for your answer or approval. Respond here so they can go on." },
      pullRequests: { title: "Pull requests", help: "The result of a Run: find the Pull request it opened and open it on GitHub." },
      projects: { title: "Project Settings", help: "Operators choose the repositories to work on and set the GitHub token here." },
      members: { title: "Members", help: "Operators decide who may sign in. Add or remove emails here." },
      audit: { title: "Audit log", help: "Who did what, and when. Read it to see how a Run or setting changed." },
    },
    start: { title: "Start a Run", body: "Choose a Ticket and start a sample Run with the first Flow. Nothing starts until you confirm." },
    missing: {
      machine: { title: "No Machine paired yet", body: "Runs execute on your own computer. Pair it first.", link: "Go to Machines" },
      ticket: { title: "No Ticket to pick yet", body: "There is no open Ticket without a Run. Sync a Project on the Tickets page.", link: "Go to Tickets" },
      flow: { title: "No Flow you can run", body: "No Flow is ready to start from a Ticket. Create or fix one.", link: "Go to Flows" },
      run: { title: "No Run yet", body: "Start a Run from a Ticket, then follow it here.", link: "Go to Tickets" },
    },
    ui: {
      next: "Next",
      back: "Back",
      skip: "Skip",
      done: "Finish",
      progress: "Step {n} of {total}",
      takeTheTour: "Take the tour",
      dismiss: "Not now",
      language: "Tiếng Việt",
      pickTicket: "Ticket",
      startSample: "Start sample Run on {ticket}",
      starting: "Starting…",
      started: "Run started. Next, follow it.",
      noWait: "Waiting for the Pull request: it appears here once the Run opens one.",
      waitingForPr: "Waiting for result",
    },
  },
  vi: {
    area: {
      machines: { title: "Machines", help: "Máy tính của chính bạn, đã ghép đôi để Run chạy trên đó. Ghép đôi trước, rồi kiểm tra Claude Code và gh đã đăng nhập." },
      tickets: { title: "Tickets", help: "Các issue GitHub bạn có thể làm. Chọn một Ticket và bắt đầu Run từ đây." },
      flows: { title: "Flows", help: "Flow là chuỗi bước mà một Run đi theo. Chọn Flow mà Ticket này sẽ dùng." },
      runs: { title: "Runs", help: "Mỗi Run là một Flow làm việc trên một Ticket. Theo dõi tại đây và trả lời ở Needs you khi nó hỏi." },
      needsYou: { title: "Needs you", help: "Các Run đang chờ bạn trả lời hoặc phê duyệt. Phản hồi tại đây để chúng chạy tiếp." },
      pullRequests: { title: "Pull requests", help: "Kết quả của một Run: tìm Pull request nó đã mở và mở trên GitHub." },
      projects: { title: "Project Settings", help: "Operator chọn các repository cần làm và đặt GitHub token tại đây." },
      members: { title: "Members", help: "Operator quyết định ai được đăng nhập. Thêm hoặc xóa email tại đây." },
      audit: { title: "Audit log", help: "Ai đã làm gì và khi nào. Xem để biết một Run hoặc cài đặt đã thay đổi ra sao." },
    },
    start: { title: "Bắt đầu một Run", body: "Chọn một Ticket và bắt đầu Run mẫu với Flow đầu tiên. Sẽ không có gì chạy cho đến khi bạn xác nhận." },
    missing: {
      machine: { title: "Chưa ghép đôi Machine", body: "Run chạy trên máy của bạn. Hãy ghép đôi trước.", link: "Đến Machines" },
      ticket: { title: "Chưa có Ticket để chọn", body: "Không có Ticket mở nào chưa có Run. Đồng bộ một Project ở trang Tickets.", link: "Đến Tickets" },
      flow: { title: "Chưa có Flow chạy được", body: "Chưa có Flow nào sẵn sàng bắt đầu từ một Ticket. Hãy tạo hoặc sửa một Flow.", link: "Đến Flows" },
      run: { title: "Chưa có Run", body: "Bắt đầu một Run từ Ticket, rồi theo dõi tại đây.", link: "Đến Tickets" },
    },
    ui: {
      next: "Tiếp",
      back: "Quay lại",
      skip: "Bỏ qua",
      done: "Xong",
      progress: "Bước {n}/{total}",
      takeTheTour: "Xem hướng dẫn",
      dismiss: "Để sau",
      language: "English",
      pickTicket: "Ticket",
      startSample: "Bắt đầu Run mẫu trên {ticket}",
      starting: "Đang bắt đầu…",
      started: "Đã bắt đầu Run. Tiếp theo, hãy theo dõi nó.",
      noWait: "Đang chờ Pull request: nó xuất hiện ở đây khi Run mở một cái.",
      waitingForPr: "Đang chờ kết quả",
    },
  },
};

export function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ""));
}

/** The tooltip for a tour step: an area's help text, or the Start step's own. */
export function stepText(lang: Lang, id: StepId): { title: string; body: string } {
  const t = COPY[lang];
  if (id === "start") return t.start;
  if (id === "pullRequests") return { title: t.area.pullRequests.title, body: t.area.pullRequests.help };
  if (id === "runs") return { title: `${t.area.runs.title} · ${t.area.needsYou.title}`, body: t.area.runs.help };
  const a = t.area[id];
  return { title: a.title, body: a.help };
}

/** The language to start in: the browser's. */
export function detectLang(language: string | undefined): Lang {
  return language?.toLowerCase().startsWith("vi") ? "vi" : "en";
}
