import { describe, expect, it } from 'vitest';
import { deriveTicketStatus } from '../src';

describe('deriveTicketStatus', () => {
  it('is Open without a Run or pull request', () => {
    expect(deriveTicketStatus({ issueClosed: false })).toBe('Open');
  });

  it('follows the Active Run', () => {
    expect(deriveTicketStatus({ issueClosed: false, activeRunState: 'queued' })).toBe('Queued');
    expect(deriveTicketStatus({ issueClosed: false, activeRunState: 'running' })).toBe('In run');
    expect(deriveTicketStatus({ issueClosed: false, activeRunState: 'waiting-for-human' })).toBe('Needs you');
    expect(deriveTicketStatus({ issueClosed: false, activeRunState: 'failed' })).toBe('Failed');
    expect(deriveTicketStatus({ issueClosed: false, activeRunState: 'interrupted' })).toBe('Interrupted');
  });

  it('shows the pull request when no Run is active', () => {
    expect(deriveTicketStatus({ issueClosed: false, pullRequest: 'open' })).toBe('PR open');
    expect(deriveTicketStatus({ issueClosed: false, pullRequest: 'merged' })).toBe('PR merged');
    expect(deriveTicketStatus({ issueClosed: false, pullRequest: 'open', activeRunState: 'failed' })).toBe('Failed');
  });

  it('is Closed when the issue is closed on GitHub, whatever else is true', () => {
    expect(deriveTicketStatus({ issueClosed: true, pullRequest: 'merged', activeRunState: 'running' })).toBe('Closed');
  });
});
