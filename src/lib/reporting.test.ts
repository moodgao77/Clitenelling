import { describe, expect, it } from 'vitest';
import { aggregateFollowUpsByDay, aggregateFunnelRows, filterFunnelDrilldownRows } from './reporting';

describe('aggregateFunnelRows', () => {
  it('attributes funnel counts to Manal, Danila, Other, and Unassigned sales executive buckets', () => {
    const result = aggregateFunnelRows(
      [
        { person_id: 'p1', to_stage: 'contacted', people: { sales_executive_id: 'manal' } },
        { person_id: 'p2', to_stage: 'contacted', people: { sales_executive_id: 'danila' } },
        { person_id: 'p3', to_stage: 'contacted', people: { sales_executive_id: 'other' } },
        { person_id: 'p4', to_stage: 'contacted', people: { sales_executive_id: null } },
        { person_id: 'p1', to_stage: 'replied', people: { sales_executive_id: 'manal' } },
        { person_id: 'p1', to_stage: 'contacted', people: { sales_executive_id: 'manal' } },
      ],
      new Map([
        ['manal', 'Manal'],
        ['danila', 'Danila'],
        ['other', 'Other'],
      ]),
    );

    expect(result.team.contacted).toBe(4);
    expect(result.team.replied).toBe(1);
    expect(result.associates.map((a) => [a.name, a.counts.contacted, a.counts.replied])).toEqual([
      ['Manal', 1, 1],
      ['Danila', 1, 0],
      ['Other', 1, 0],
      ['Unassigned', 1, 0],
    ]);
  });
});

describe('filterFunnelDrilldownRows', () => {
  const rows = [
    { person_id: 'p1', people: person('p1', 'manal') },
    { person_id: 'p2', people: person('p2', 'danila') },
    { person_id: 'p3', people: person('p3', null) },
    { person_id: 'p1', people: person('p1', 'manal') },
    { person_id: 'missing', people: null },
  ];

  it('dedupes clients for whole-team drilldowns', () => {
    expect(filterFunnelDrilldownRows(rows).map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
  });

  it('filters clients by sales executive', () => {
    expect(filterFunnelDrilldownRows(rows, 'manal').map((p) => p.id)).toEqual(['p1']);
  });

  it('filters clients assigned to the unassigned bucket', () => {
    expect(filterFunnelDrilldownRows(rows, 'unassigned').map((p) => p.id)).toEqual(['p3']);
  });
});

function person(id: string, salesExecutiveId: string | null) {
  return {
    id,
    full_name: id,
    phone_e164: '+971500000000',
    stage: 'contacted' as const,
    sales_executive_id: salesExecutiveId,
  };
}

describe('aggregateFollowUpsByDay', () => {
  it('counts every touch, so repeat follow-ups on one client all show', () => {
    const days = aggregateFollowUpsByDay(
      [
        { completed_at: '2026-10-01T06:00:00.000Z', person_id: 'p1' },
        { completed_at: '2026-10-01T11:00:00.000Z', person_id: 'p1' },
        { completed_at: '2026-10-01T12:00:00.000Z', person_id: 'p2' },
      ],
      '2026-10-01',
      '2026-10-01',
    );

    expect(days).toHaveLength(1);
    expect(days[0].touches).toBe(3);
    expect(days[0].clients).toBe(2);
  });

  it('includes empty days so gaps in outreach are visible', () => {
    const days = aggregateFollowUpsByDay(
      [{ completed_at: '2026-10-03T06:00:00.000Z', person_id: 'p1' }],
      '2026-10-01',
      '2026-10-03',
    );

    expect(days.map((d) => [d.date, d.touches])).toEqual([
      ['2026-10-01', 0],
      ['2026-10-02', 0],
      ['2026-10-03', 1],
    ]);
  });

  it('buckets by Dubai day, not UTC day', () => {
    // 21:00 UTC on 1 Oct is 01:00 on 2 Oct in Dubai (UTC+4).
    const days = aggregateFollowUpsByDay(
      [{ completed_at: '2026-10-01T21:00:00.000Z', person_id: 'p1' }],
      '2026-10-01',
      '2026-10-02',
    );

    expect(days.map((d) => [d.date, d.touches])).toEqual([
      ['2026-10-01', 0],
      ['2026-10-02', 1],
    ]);
  });

  it('tolerates a reversed range', () => {
    expect(aggregateFollowUpsByDay([], '2026-10-03', '2026-10-01').map((d) => d.date)).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
    ]);
  });
});
