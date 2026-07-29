import { describe, it, expect } from 'vitest';
import { HARDEN_CHECKLISTS, checklistFor } from '../checklists';

describe('HARDEN_CHECKLISTS data integrity', () => {
  it('has exactly one guide per device covered by the harden section', () => {
    const devices = HARDEN_CHECKLISTS.map((g) => g.device);
    expect(devices).toEqual(['iphone', 'android', 'mac', 'windows']);
  });

  it('every item id is globally unique across all guides (these are localStorage keys)', () => {
    const allIds = HARDEN_CHECKLISTS.flatMap((g) => g.items.map((i) => i.id));
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('every item id is namespaced with its own device prefix', () => {
    for (const guide of HARDEN_CHECKLISTS) {
      for (const item of guide.items) {
        expect(item.id.startsWith(`${guide.device}:`)).toBe(true);
      }
    }
  });

  it('every guide has at least one baseline item (the everyday-tier steps)', () => {
    for (const guide of HARDEN_CHECKLISTS) {
      const baselineCount = guide.items.filter((i) => i.tier === 'baseline').length;
      expect(baselineCount).toBeGreaterThan(0);
    }
  });

  it('every guide has at least one higher-risk item', () => {
    for (const guide of HARDEN_CHECKLISTS) {
      const higherRiskCount = guide.items.filter((i) => i.tier === 'higher-risk').length;
      expect(higherRiskCount).toBeGreaterThan(0);
    }
  });

  it('every href points into /harden/', () => {
    for (const guide of HARDEN_CHECKLISTS) {
      expect(guide.href.startsWith('/harden/')).toBe(true);
    }
  });
});

describe('checklistFor', () => {
  it('finds a guide by device slug', () => {
    expect(checklistFor('mac')?.title).toBe('Mac');
  });

  it('returns undefined for an unknown device', () => {
    expect(checklistFor('linux')).toBeUndefined();
  });
});
