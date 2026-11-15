import type { RunState } from './types';

export type TicketStatus =
  | 'Open'
  | 'Queued'
  | 'In run'
  | 'Needs you'
  | 'Failed'
  | 'Interrupted'
  | 'PR open'
  | 'PR merged'
  | 'Closed';

export interface TicketFacts {
  /** The issue is closed on GitHub. */
  issueClosed: boolean;
  /** State of the Ticket's Active Run, if it has one. Dry-run Runs do not count. */
  activeRunState?: RunState;
  /** State of the pull request opened by a Run of this Ticket, if any. */
  pullRequest?: 'open' | 'merged';
}

/**
 * Ticket Status is derived, never stored (TIC-6). A closed issue wins, then
 * the Active Run, then the pull request.
 */
export function deriveTicketStatus(facts: TicketFacts): TicketStatus {
  if (facts.issueClosed) return 'Closed';
  switch (facts.activeRunState) {
    case 'queued':
      return 'Queued';
    case 'running':
      return 'In run';
    case 'waiting-for-human':
      return 'Needs you';
    case 'failed':
      return 'Failed';
    case 'interrupted':
      return 'Interrupted';
  }
  if (facts.pullRequest === 'merged') return 'PR merged';
  if (facts.pullRequest === 'open') return 'PR open';
  return 'Open';
}
