import { Tabs } from "../../../components/tabs";

/** The two views of the Flows area: the Flows themselves and the Node library they draw from. */
export function FlowsTabs({ active, flows, nodes }: { active: "flows" | "library"; flows: number; nodes: number }) {
  return (
    <Tabs
      label="Flows"
      tabs={[
        { href: "/flows", label: "Flows", count: flows, active: active === "flows" },
        { href: "/flows/library", label: "Node library", count: nodes, active: active === "library" },
      ]}
    />
  );
}
