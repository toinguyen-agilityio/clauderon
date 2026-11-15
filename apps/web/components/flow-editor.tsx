'use client';

import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
} from '@xyflow/react';
import { useEffect, useMemo, useState } from 'react';
import {
  SAMPLE_FLOWS,
  SAMPLE_TASKS,
  checkEdge,
  topologicalOrder,
  validateFlow,
  type Flow,
  type FlowEdge,
  type FlowNode,
  type FlowProblem,
  type Task,
} from '@clauderon/core';

// Sample code: Flows live in the browser's memory until the app has an API
// and a database. The rules themselves come from @clauderon/core.

type TaskNodeData = {
  node: FlowNode;
  task?: Task;
  selected: boolean;
  problemCount: number;
};

type TaskRfNode = Node<TaskNodeData, 'task'>;

const KIND_LABEL: Record<string, string> = {
  agent: 'Agent',
  command: 'Command',
  approve: 'Approve',
  grill: 'Grill',
};

function kindOf(task: Task): string {
  return KIND_LABEL[task.kind === 'human' ? (task.humanKind ?? 'approve') : task.kind] ?? task.kind;
}

function TaskNodeView({ data }: NodeProps<TaskRfNode>) {
  const { node, task, selected, problemCount } = data;
  const className = ['task-node', selected ? 'selected' : '', problemCount > 0 ? 'has-problem' : ''].join(' ');
  return (
    <div className={className}>
      <header>
        <span>{node.name}</span>
        {task && <span className="chip">{kindOf(task)}</span>}
      </header>
      {!task && <div className="port">Task no longer exists</div>}
      {task?.inputs.map((input) => (
        <div className="port" key={`in-${input.name}`}>
          <Handle type="target" position={Position.Left} id={input.name} />
          <b>{input.name}</b> · {input.type}
          {input.required ? '' : ' (optional)'}
        </div>
      ))}
      {task?.outputs.map((output) => {
        const off = node.disabledOutputs.includes(output.name);
        return (
          <div className={`port out${off ? ' off' : ''}`} key={`out-${output.name}`}>
            <b>{output.name}</b> · {output.type}
            {output.required ? '' : ' (optional)'}
            <Handle type="source" position={Position.Right} id={output.name} isConnectable={!off} />
          </div>
        );
      })}
    </div>
  );
}

const nodeTypes = { task: TaskNodeView };

let counter = 1;
function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${counter++}`;
}

export function FlowEditor() {
  const tasks = SAMPLE_TASKS;
  const [flows, setFlows] = useState<Flow[]>(() => structuredClone(SAMPLE_FLOWS));
  const [flowId, setFlowId] = useState<string>(SAMPLE_FLOWS[0]?.id ?? '');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // The canvas keeps its own copy of the Nodes (with measured sizes); it is rebuilt from the Flow below.
  const [rfNodes, setRfNodes] = useState<TaskRfNode[]>([]);

  const flow = flows.find((f) => f.id === flowId) ?? flows[0];
  const readOnly = !flow || flow.sample;
  const problems: FlowProblem[] = useMemo(() => (flow ? validateFlow(flow, tasks) : []), [flow, tasks]);
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);

  function update(change: (draft: Flow) => void) {
    if (!flow || flow.sample) return;
    setFlows((all) =>
      all.map((f) => {
        if (f.id !== flow.id) return f;
        const draft = structuredClone(f);
        change(draft);
        return draft;
      }),
    );
  }

  function openFlow(id: string) {
    setFlowId(id);
    setSelectedNodeId(null);
    setNotice(null);
  }

  function cloneFlow() {
    if (!flow) return;
    const copy: Flow = { ...structuredClone(flow), id: newId('flow'), name: `${flow.name} (copy)`, sample: false };
    setFlows((all) => [...all, copy]);
    openFlow(copy.id);
  }

  function addNode(task: Task) {
    if (readOnly || !flow) return;
    const id = newId('node');
    update((draft) => {
      draft.nodes.push({
        id,
        taskId: task.id,
        name: task.name,
        extraInstructions: '',
        disabledOutputs: [],
        position: { x: 40 + draft.nodes.length * 40, y: 260 + (draft.nodes.length % 3) * 40 },
      });
    });
    setSelectedNodeId(id);
  }

  function onConnect(connection: Connection) {
    if (readOnly || !flow || !connection.sourceHandle || !connection.targetHandle) return;
    const edge: FlowEdge = {
      id: newId('edge'),
      from: { nodeId: connection.source, output: connection.sourceHandle },
      to: { nodeId: connection.target, input: connection.targetHandle },
    };
    // An edge is allowed only between matching Output Types, and never closes a cycle.
    const edgeProblems = checkEdge(flow, tasks, edge);
    if (edgeProblems[0]) {
      setNotice(edgeProblems[0].message);
      return;
    }
    if (flow.edges.some((e) => e.to.nodeId === edge.to.nodeId && e.to.input === edge.to.input)) {
      setNotice(`Input "${edge.to.input}" is already connected.`);
      return;
    }
    if (topologicalOrder({ ...flow, edges: [...flow.edges, edge] }) === null) {
      setNotice('This edge would create a cycle.');
      return;
    }
    setNotice(null);
    update((draft) => {
      draft.edges.push(edge);
    });
  }

  function onNodesChange(changes: NodeChange<TaskRfNode>[]) {
    setRfNodes((nodes) => applyNodeChanges(changes, nodes));
    if (readOnly || !changes.some((c) => c.type === 'position' || c.type === 'remove')) return;
    update((draft) => {
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          const node = draft.nodes.find((n) => n.id === change.id);
          if (node) node.position = change.position;
        }
        if (change.type === 'remove') {
          draft.nodes = draft.nodes.filter((n) => n.id !== change.id);
          draft.edges = draft.edges.filter((e) => e.from.nodeId !== change.id && e.to.nodeId !== change.id);
        }
      }
    });
    if (changes.some((c) => c.type === 'remove' && c.id === selectedNodeId)) setSelectedNodeId(null);
  }

  function onEdgesChange(changes: EdgeChange[]) {
    if (readOnly) return;
    const removed = changes.filter((c) => c.type === 'remove').map((c) => c.id);
    if (removed.length === 0) return;
    update((draft) => {
      draft.edges = draft.edges.filter((e) => !removed.includes(e.id));
    });
  }

  useEffect(() => {
    setRfNodes((previous) => {
      const known = new Map(previous.map((node) => [node.id, node]));
      return (flow?.nodes ?? []).map((node, index) => ({
        ...known.get(node.id),
        id: node.id,
        type: 'task' as const,
        position: node.position ?? { x: index * 260, y: 80 },
        data: {
          node,
          task: taskById.get(node.taskId),
          selected: node.id === selectedNodeId,
          problemCount: problems.filter((p) => p.nodeId === node.id).length,
        },
      }));
    });
  }, [flow, selectedNodeId, problems, taskById]);

  const rfEdges: Edge[] = (flow?.edges ?? []).map((edge) => {
    const problem = problems.find((p) => p.edgeId === edge.id);
    return {
      id: edge.id,
      source: edge.from.nodeId,
      sourceHandle: edge.from.output,
      target: edge.to.nodeId,
      targetHandle: edge.to.input,
      label: problem?.message,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: problem ? { stroke: 'var(--danger)', strokeWidth: 2 } : undefined,
    };
  });

  const selectedNode = flow?.nodes.find((n) => n.id === selectedNodeId);
  const selectedTask = selectedNode ? taskById.get(selectedNode.taskId) : undefined;

  return (
    <div className="editor">
      <aside className="side">
        <h1>Clauderon · Flows</h1>
        <h2>Flows</h2>
        <div className="list">
          {flows.map((f) => (
            <button key={f.id} className={`item${f.id === flow?.id ? ' active' : ''}`} onClick={() => openFlow(f.id)}>
              <span>{f.name}</span>
              {f.sample && <span className="chip">Sample</span>}
            </button>
          ))}
        </div>

        <h2>Task library</h2>
        <div className="list">
          {tasks.map((task) => (
            <button
              key={task.id}
              className="item"
              disabled={readOnly}
              title={readOnly ? 'Clone the sample Flow to edit it' : 'Add as a Node'}
              onClick={() => addNode(task)}
            >
              <span>{task.name}</span>
              <span className="chip">{kindOf(task)}</span>
            </button>
          ))}
        </div>
        {readOnly && <p className="muted">Sample Flows are read-only. Clone one to edit it.</p>}
      </aside>

      <main className="canvas">
        <div className="toolbar">
          <input
            aria-label="Flow name"
            value={flow?.name ?? ''}
            disabled={readOnly}
            onChange={(event) => update((draft) => void (draft.name = event.target.value))}
          />
          {problems.length === 0 ? (
            <span className="chip ok">No problems</span>
          ) : (
            <span className="chip danger">
              {problems.length} {problems.length === 1 ? 'problem' : 'problems'}
            </span>
          )}
          <span className="spacer" />
          <button className="primary" onClick={cloneFlow}>
            Clone
          </button>
        </div>
        {notice && (
          <div className="notice" role="alert">
            {notice}
          </div>
        )}
        <div className="stage">
          <ReactFlow
            key={flow?.id}
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
            nodesDraggable={!readOnly}
            nodesConnectable={!readOnly}
            deleteKeyCode={readOnly ? null : ['Backspace', 'Delete']}
            colorMode="system"
            fitView
          >
            <Background />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      </main>

      <aside className="side right">
        <h2>Problems</h2>
        {problems.length === 0 ? (
          <p className="muted">This Flow can start Runs.</p>
        ) : (
          <ul className="problems">
            {problems.map((problem, index) => (
              <li key={index}>{problem.message}</li>
            ))}
          </ul>
        )}

        <h2>Node</h2>
        {!selectedNode && <p className="muted">Select a Node to see its settings.</p>}
        {selectedNode && (
          <>
            <div className="field">
              <label htmlFor="node-name">Name</label>
              <input
                id="node-name"
                value={selectedNode.name}
                disabled={readOnly}
                onChange={(event) =>
                  update((draft) => {
                    const node = draft.nodes.find((n) => n.id === selectedNode.id);
                    if (node) node.name = event.target.value;
                  })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="node-instructions">Extra instructions for this Node</label>
              <textarea
                id="node-instructions"
                rows={4}
                value={selectedNode.extraInstructions}
                disabled={readOnly}
                onChange={(event) =>
                  update((draft) => {
                    const node = draft.nodes.find((n) => n.id === selectedNode.id);
                    if (node) node.extraInstructions = event.target.value;
                  })
                }
              />
            </div>
            {selectedTask?.outputs.some((o) => !o.required) && (
              <div className="field">
                <label>Optional Outputs</label>
                {selectedTask.outputs
                  .filter((o) => !o.required)
                  .map((output) => (
                    <label className="check" key={output.name}>
                      <input
                        type="checkbox"
                        disabled={readOnly}
                        checked={!selectedNode.disabledOutputs.includes(output.name)}
                        onChange={(event) =>
                          update((draft) => {
                            const node = draft.nodes.find((n) => n.id === selectedNode.id);
                            if (!node) return;
                            node.disabledOutputs = event.target.checked
                              ? node.disabledOutputs.filter((name) => name !== output.name)
                              : [...node.disabledOutputs, output.name];
                          })
                        }
                      />
                      {output.name} · {output.type}
                    </label>
                  ))}
              </div>
            )}
            <button
              disabled={readOnly}
              onClick={() => {
                update((draft) => {
                  draft.nodes = draft.nodes.filter((n) => n.id !== selectedNode.id);
                  draft.edges = draft.edges.filter(
                    (e) => e.from.nodeId !== selectedNode.id && e.to.nodeId !== selectedNode.id,
                  );
                });
                setSelectedNodeId(null);
              }}
            >
              Remove Node
            </button>
          </>
        )}
      </aside>
    </div>
  );
}
