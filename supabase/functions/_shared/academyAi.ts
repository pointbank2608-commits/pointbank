/** Shared entry gate for interactive academy AI. Pass the caller's JWT, never a service key.
 * reserve_enabled_scan checks the admin flag, staff membership and the academy's quota. */
export async function reserveAcademyAi(req: Request, academyId?: string): Promise<number> {
  const authorization = req.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return 401;
  const url = Deno.env.get('SUPABASE_URL');
  const apikey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !apikey) return 503;
  async function rpc(name: string, args: object) {
    return fetch(url + '/rest/v1/rpc/' + name, {
      method: 'POST', headers: { authorization: authorization!, apikey: apikey!, 'Content-Type': 'application/json' },
      body: JSON.stringify(args), signal: AbortSignal.timeout(8000),
    });
  }
  try {
    if (!academyId) {
      const own = await rpc('my_academy_id', {});
      if (!own.ok) return own.status === 401 ? 401 : 403;
      academyId = await own.json();
      if (!academyId) return 403;
    }
    const access = await rpc('reserve_enabled_scan', { p_academy_id: academyId });
    if (!access.ok) return [401, 403, 409].includes(access.status) ? access.status : 503;
    return await access.json() === true ? 200 : 429;
  } catch { return 503; }
}
