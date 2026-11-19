import { Icon } from "../../../components/icons";

export type PairingPhase = "connecting" | "checking" | "done";

type Step = { label: string; detail: string; state: "done" | "active" | "todo" };

/**
 * Right after the Member approves a Pairing, what happens next on their
 * computer, step by step, so the page never just sits there: the Agent
 * connects, checks the computer (logins and doctor), then the Machine is
 * Ready or Health lists what to fix. The page refreshes itself meanwhile.
 */
export function PairingProgress({ phase, hostname }: { phase: Exclude<PairingPhase, "done">; hostname: string }) {
  const steps: Step[] = [
    { label: "Approved", detail: `${hostname} is now your Machine.`, state: "done" },
    {
      label: "Agent connects",
      detail: phase === "connecting" ? "Waiting for the Agent on that computer: the install command finishes pairing, then starts it." : "Connected.",
      state: phase === "connecting" ? "active" : "done",
    },
    {
      label: "Checking the computer",
      detail: phase === "checking" ? "Claude Code, gh, git and the rest: this takes a few seconds." : "Starts once the Agent connects.",
      state: phase === "checking" ? "active" : "todo",
    },
    { label: "Ready to run", detail: "Or Health lists what to fix first.", state: "todo" },
  ];
  return (
    <div className="banner info" data-testid="pairing-progress" aria-live="polite">
      <div className="grow stack" style={{ gap: 10 }}>
        <b className="small">Setting up your Machine…</b>
        <ol className="checklist left" style={{ margin: 0 }}>
          {steps.map((step) => (
            <li key={step.label} style={{ padding: "6px 0" }}>
              <span className={`ndot sm ${step.state === "done" ? "succeeded" : step.state === "active" ? "running" : ""}`}>
                {step.state === "done" ? Icon.check : step.state === "active" ? Icon.spin : null}
              </span>
              <span className={`small ${step.state === "todo" ? "faint" : ""}`}>
                <b>{step.label}</b> · {step.detail}
              </span>
            </li>
          ))}
        </ol>
        <span className="faint small">This page updates by itself.</span>
      </div>
    </div>
  );
}
