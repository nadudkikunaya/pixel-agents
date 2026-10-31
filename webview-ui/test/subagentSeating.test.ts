/**
 * Sub-agent clones take the free seat closest to their parent, so ten parallel
 * Task calls fill the desks around the orchestrator instead of piling onto the
 * walkable tiles beside it. With no free seat they fall back to standing near
 * the parent, and a finished sub-agent hands its seat back.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict';

import { test } from 'vitest';

import { OfficeState } from '../src/office/engine/officeState.js';
import type { OfficeLayout, Seat } from '../src/office/types.js';
import { Direction, TileType } from '../src/office/types.js';

function floorLayout(cols = 12, rows = 6): OfficeLayout {
  return {
    version: 1,
    cols,
    rows,
    tiles: new Array<TileType>(cols * rows).fill(TileType.FLOOR_1),
    furniture: [],
  };
}

/** An office with `n` seats in a row (the layout has no catalog, so seats are injected). */
function officeWithSeats(n: number): OfficeState {
  const os = new OfficeState(floorLayout());
  os.seats.clear();
  for (let i = 0; i < n; i++) {
    const seat: Seat = {
      uid: `s${i}`,
      seatCol: i,
      seatRow: 2,
      facingDir: Direction.UP,
      assigned: false,
    };
    os.seats.set(seat.uid, seat);
  }
  return os;
}

test('ten sub-agents each take a distinct seat, nearest to the parent first', () => {
  const os = officeWithSeats(12);
  os.addAgent(1, undefined, undefined, 's0');
  const seatIds: string[] = [];
  for (let i = 0; i < 10; i++) {
    const id = os.addSubagent(1, `tool-${i}`);
    seatIds.push(os.characters.get(id)!.seatId!);
  }
  assert.equal(new Set(seatIds).size, 10, 'no two sub-agents share a seat');
  assert.deepEqual(seatIds, ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10']);
});

test('with no free seat a sub-agent stands near the parent instead', () => {
  const os = officeWithSeats(1);
  os.addAgent(1, undefined, undefined, 's0');
  const id = os.addSubagent(1, 'tool-0');
  assert.equal(os.characters.get(id)!.seatId, null);
});

test('a finished sub-agent frees its seat for the next one', () => {
  const os = officeWithSeats(2);
  os.addAgent(1, undefined, undefined, 's0');
  const first = os.addSubagent(1, 'tool-0');
  assert.equal(os.characters.get(first)!.seatId, 's1');
  os.removeSubagent(1, 'tool-0');
  const second = os.addSubagent(1, 'tool-1');
  assert.equal(os.characters.get(second)!.seatId, 's1');
});
