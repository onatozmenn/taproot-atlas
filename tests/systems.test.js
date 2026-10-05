import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findSystemByText, getDirectorySystem, listDirectorySystems } from '../dist/lib/systems.js';

describe('systems directory', () => {
  it('lists 100 verified systems (top by population served)', () => {
    const systems = listDirectorySystems();
    assert.equal(systems.length, 100);
    const pwsids = systems.map((s) => s.pwsid);
    for (const pwsid of ['NY7003493', 'CA1910067', 'IL0316000', 'TX1010013']) {
      assert.ok(pwsids.includes(pwsid), `missing ${pwsid}`);
    }
    for (const s of systems) {
      assert.ok(s.systemName.length > 0);
      assert.ok(s.aliases.length > 0);
      assert.ok(Number.isFinite(s.center[0]) && Number.isFinite(s.center[1]));
    }
  });

  it('marks tier B entries (PWSID + city, no curated basins)', () => {
    const seattle = getDirectorySystem('WA5377050');
    assert.ok(seattle);
    assert.equal(seattle.city, 'Seattle');
    assert.deepEqual(seattle.basins, []);
    assert.equal(seattle.metricsCurated, false);
  });

  it('curates basins for 18 tier A metros from official utility sources', () => {
    const systems = listDirectorySystems();
    const tierA = systems.filter((s) => s.basins.length > 0);
    assert.equal(tierA.length, 18);
    const philly = getDirectorySystem('PA1510001');
    assert.deepEqual(
      philly?.basins.map((b) => b.name),
      ['Delaware River', 'Schuylkill River'],
    );
    const denver = getDirectorySystem('CO0116001');
    assert.ok(denver?.basins.some((b) => b.name === 'South Platte River'));
    const miami = getDirectorySystem('FL4130871');
    assert.deepEqual(
      miami?.basins.map((b) => b.name),
      ['Biscayne Aquifer'],
    );
    // Utility-name aliases resolve too.
    assert.equal(findSystemByText('philly water?')?.pwsid, 'PA1510001');
    assert.equal(findSystemByText('boston tap water')?.pwsid, 'MA6000000');
    assert.equal(findSystemByText('vegas drinking water')?.pwsid, 'NV0000090');
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
