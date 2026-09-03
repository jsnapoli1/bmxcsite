import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  listRules, createRule, deleteRule, listDestinations, createDestination, RoutingError,
} from '../../worker/email/routing-client.js';

const env = { CF_API_TOKEN: 'tok', CF_ACCOUNT_ID: 'acct' };

function mockFetch(handler) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(
    async (url, init) => handler(String(url), init),
  );
}

afterEach(() => vi.restoreAllMocks());

const ok = (result) => new Response(JSON.stringify({ success: true, result }), {
  headers: { 'content-type': 'application/json' },
});

describe('listRules', () => {
  it('flattens a rule into address and destination', async () => {
    mockFetch(async () => ok([{
      id: 'r1',
      name: 'ken',
      enabled: true,
      matchers: [{ type: 'literal', field: 'to', value: 'ken@bmxc.camp' }],
      actions: [{ type: 'forward', value: ['ken@gmail.com'] }],
    }]));

    const rules = await listRules(env);
    expect(rules).toEqual([{
      id: 'r1',
      name: 'ken',
      address: 'ken@bmxc.camp',
      destination: 'ken@gmail.com',
      enabled: true,
    }]);
  });

  it('skips the catch-all rather than showing it as an address', async () => {
    // The catch-all has no literal 'to' matcher. Rendering it as a row
    // would invite someone to delete the thing that stops mail to an
    // unknown address vanishing.
    mockFetch(async () => ok([
      {
        id: 'c1',
        name: '',
        enabled: true,
        matchers: [{ type: 'all' }],
        actions: [{ type: 'forward', value: ['x@y.z'] }],
      },
      {
        id: 'r1',
        name: 'ken',
        enabled: true,
        matchers: [{ type: 'literal', field: 'to', value: 'k@bmxc.camp' }],
        actions: [{ type: 'forward', value: ['k@g.com'] }],
      },
    ]));

    const rules = await listRules(env);
    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe('r1');
  });
});

describe('createRule', () => {
  it('sends the matcher and action Cloudflare expects', async () => {
    let sent;
    mockFetch(async (url, init) => {
      sent = { url, body: JSON.parse(init.body) };
      return ok({
        id: 'new',
        name: 'sarah',
        enabled: true,
        matchers: [{ type: 'literal', field: 'to', value: 'sarah@bmxc.camp' }],
        actions: [{ type: 'forward', value: ['s@g.com'] }],
      });
    });

    await createRule(env, { address: 'sarah@bmxc.camp', destination: 's@g.com' });

    expect(sent.url).toContain('/zones/44fe4c68ed1014b250436a9d9b0c61b2/email/routing/rules');
    expect(sent.body.matchers).toEqual([{ type: 'literal', field: 'to', value: 'sarah@bmxc.camp' }]);
    expect(sent.body.actions).toEqual([{ type: 'forward', value: ['s@g.com'] }]);
  });

  it('refuses an address outside bmxc.camp', async () => {
    // A rule on another domain would either fail confusingly or, worse,
    // succeed against a zone this panel has no business editing.
    await expect(
      createRule(env, { address: 'ken@example.com', destination: 'k@g.com' }),
    ).rejects.toThrow(RoutingError);
  });

  it('refuses an address that is not an address', async () => {
    await expect(
      createRule(env, { address: 'not-an-email', destination: 'k@g.com' }),
    ).rejects.toThrow(RoutingError);
  });

  it('refuses a destination that is not an address', async () => {
    await expect(
      createRule(env, { address: 'ken@bmxc.camp', destination: 'nope' }),
    ).rejects.toThrow(RoutingError);
  });

  it('does not call Cloudflare at all when validation fails', async () => {
    // The check is local, so a bad address must not cost a round trip —
    // and must not reach an API that might accept something odd.
    const spy = mockFetch(async () => ok({}));
    await expect(
      createRule(env, { address: 'ken@example.com', destination: 'k@g.com' }),
    ).rejects.toThrow(RoutingError);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('deleteRule', () => {
  it('targets the rule by id on the fixed zone', async () => {
    let sent;
    mockFetch(async (url, init) => {
      sent = { url, method: init.method };
      return ok(null);
    });

    expect(await deleteRule(env, 'r9')).toBe(true);
    expect(sent.method).toBe('DELETE');
    expect(sent.url).toContain('/zones/44fe4c68ed1014b250436a9d9b0c61b2/email/routing/rules/r9');
  });
});

describe('error handling', () => {
  it('turns a Cloudflare error into a RoutingError with its message', async () => {
    mockFetch(async () => new Response(
      JSON.stringify({ success: false, errors: [{ message: 'that address already exists' }] }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    ));

    await expect(listRules(env)).rejects.toThrow(/already exists/);
  });

  it('does not leak the credential in an error', async () => {
    mockFetch(async () => new Response('nope', { status: 500 }));
    await expect(listRules(env)).rejects.not.toThrow(/tok/);
  });

  it('reports a network failure as 502 rather than throwing raw', async () => {
    mockFetch(async () => { throw new TypeError('network down'); });
    await expect(listRules(env)).rejects.toThrow(RoutingError);
  });
});

describe('createDestination', () => {
  it('reports a new destination as unverified', async () => {
    mockFetch(async () => ok({ id: 'd1', email: 'new@gmail.com', verified: null }));
    const created = await createDestination(env, 'new@gmail.com');
    expect(created.verified).toBe(false);
  });

  it('uses the account scope, not the zone', async () => {
    // Destinations are account-level and shared across every zone on the
    // account. Sending this to the zone endpoint would 404.
    let sent;
    mockFetch(async (url) => {
      sent = url;
      return ok({ id: 'd1', email: 'a@g.com', verified: null });
    });
    await createDestination(env, 'a@g.com');
    expect(sent).toContain('/accounts/acct/email/routing/addresses');
  });
});

describe('listDestinations', () => {
  it('reduces the verified timestamp to a boolean', async () => {
    mockFetch(async () => ok([
      { id: 'd1', email: 'a@g.com', verified: '2026-08-11T17:46:41Z' },
      { id: 'd2', email: 'b@g.com', verified: null },
    ]));
    const rows = await listDestinations(env);
    expect(rows[0].verified).toBe(true);
    expect(rows[1].verified).toBe(false);
  });
});
