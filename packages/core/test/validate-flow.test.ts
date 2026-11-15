import { describe, expect, it } from 'vitest';
import { SAMPLE_FLOWS, SAMPLE_TASKS, topologicalOrder, validateFlow, type Flow } from '../src';

const basic = SAMPLE_FLOWS[0]!;

function edit(change: (flow: Flow) => void): Flow {
  const flow = structuredClone(basic);
  change(flow);
  return flow;
}

function codes(flow: Flow): string[] {
  return validateFlow(flow, SAMPLE_TASKS).map((p) => p.code);
}

describe('validateFlow', () => {
  it('accepts every sample Flow', () => {
    for (const flow of SAMPLE_FLOWS) expect(validateFlow(flow, SAMPLE_TASKS)).toEqual([]);
  });

  it('rejects an edge whose Output Type does not match the input', () => {
    const flow = edit((f) => {
      f.edges.push({ id: 'bad', from: { nodeId: 'code', output: 'summary' }, to: { nodeId: 'pr', input: 'test-result' } });
      f.edges = f.edges.filter((e) => e.id !== 'e4');
    });
    const problems = validateFlow(flow, SAMPLE_TASKS);
    expect(problems.map((p) => p.code)).toEqual(['type-mismatch']);
    expect(problems[0]?.edgeId).toBe('bad');
  });

  it('rejects a cycle', () => {
    const flow = edit((f) => {
      f.nodes.push({ id: 'approve', taskId: 'task-approve-a-plan', name: 'Approve', extraInstructions: '', disabledOutputs: [] });
      f.nodes.push({ id: 'approve2', taskId: 'task-approve-a-plan', name: 'Approve again', extraInstructions: '', disabledOutputs: [] });
      f.edges.push({ id: 'c1', from: { nodeId: 'approve', output: 'plan' }, to: { nodeId: 'approve2', input: 'plan' } });
      f.edges.push({ id: 'c2', from: { nodeId: 'approve2', output: 'plan' }, to: { nodeId: 'approve', input: 'plan' } });
    });
    expect(codes(flow)).toContain('cycle');
    expect(topologicalOrder(flow)).toBeNull();
  });

  it('wants exactly one entry Node', () => {
    const flow = edit((f) => {
      f.nodes.push({ id: 'grill2', taskId: 'task-grill-a-plan', name: 'Second grill', extraInstructions: '', disabledOutputs: [] });
    });
    expect(codes(flow).filter((c) => c === 'several-entry-nodes')).toHaveLength(2);
  });

  it('wants the entry Node to take the issue', () => {
    const flow = edit((f) => {
      f.nodes = f.nodes.filter((n) => n.id !== 'grill');
      f.edges = f.edges.filter((e) => e.from.nodeId !== 'grill');
    });
    expect(codes(flow)).toEqual(['entry-without-issue', 'required-input-unconnected']);
  });

  it('reports a required input left unconnected, but not an optional one', () => {
    const withoutOptional = edit((f) => {
      f.edges = f.edges.filter((e) => e.id !== 'e4');
    });
    expect(codes(withoutOptional)).toEqual([]);

    const withoutRequired = edit((f) => {
      f.edges = f.edges.filter((e) => e.id !== 'e3');
    });
    expect(codes(withoutRequired)).toEqual(['required-input-unconnected']);
  });

  it('reports an edge from an Output that is switched off, and a required Output switched off', () => {
    const flow = edit((f) => {
      f.nodes.find((n) => n.id === 'code')!.disabledOutputs = ['branch'];
    });
    expect(codes(flow)).toEqual(['required-output-disabled', 'output-disabled', 'output-disabled']);
  });

  it('reports an empty Flow and an unknown Task', () => {
    expect(codes({ id: 'f', name: 'Empty', nodes: [], edges: [], sample: false })).toEqual(['empty-flow']);
    const flow = edit((f) => {
      f.nodes.find((n) => n.id === 'test')!.taskId = 'gone';
    });
    expect(codes(flow)).toContain('unknown-task');
  });

  it('orders Nodes the way a Run executes them', () => {
    expect(topologicalOrder(basic)).toEqual(['grill', 'code', 'test', 'pr']);
  });
});
