import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findSystemByText, getDirectorySystem, listDirectorySystems } from '../dist/lib/systems.js';

describe('systems directory', () => {
  it('lists curated systems with verified PWSIDs', () => {
    const systems = listDirectorySystems();
    const pwsids = systems.map((s) => s.pwsid);
    for (const pwsid of ['NY7003493', 'CA1910067', 'IL0316000', 'TX1010013']) {
      assert.ok(pwsids.includes(pwsid), `missing ${pwsid}`);
    }
    for (const s of systems) {
      assert.ok(s.systemName.length > 0);
      assert.ok(s.aliases.length > 0);
      assert.ok(s.basins.length > 0);
      assert.ok(s.utilityUrl.startsWith('https://'));
    }
  });

  it('matches city mentions, longest alias wins', () => {
    assert.equal(findSystemByText('los angeles water?')?.pwsid, 'CA1910067');
    assert.equal(findSystemByText('Where does Chicago tap water come from?')?.pwsid, 'IL0316000');
    assert.equal(findSystemByText('houston?')?.pwsid, 'TX1010013');
    assert.equal(findSystemByText('new york city water')?.pwsid, 'NY7003493');
    assert.equal(findSystemByText('nyc dep report')?.pwsid, 'NY7003493');
  });

  it('returns null outside coverage (never a guess)', () => {
    assert.equal(findSystemByText('ankara water?'), null);
    assert.equal(findSystemByText('paris tap water'), null);
    assert.equal(findSystemByText('hi how are you'), null);
  });

  it('looks systems up by PWSID', () => {
    assert.equal(getDirectorySystem('TX1010013')?.city, 'Houston');
    assert.equal(getDirectorySystem('NOPE'), null);
  });
});
