import { Tabs } from "../../../components/tabs";

/** The two views of the Flows area: the Flows themselves and the Node library they draw from. */
export function FlowsTabs({ active, flows, nodes, deleted }: { active: "flows" | "library" | "deleted"; flows: number; nodes: number; deleted?: number }) {
  return (
    <Tabs
      label="Flows"
      tabs={[
        { href: "/flows", label: "Flows", count: flows, active: active === "flows" },
        { href: "/flows/library", label: "Node library", count: nodes, active: active === "library" },
        { href: "/flows/deleted", label: "Deleted Flows", count: deleted, active: active === "deleted" },
      ]}
    />
  );
}
