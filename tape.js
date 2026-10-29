import {
  route, send, agentConfig, fetchAgentTxs, getBalances, tokenMeta, agentRecords, replayBook, sol, round, logSoft,
} from './_lib.js';

const S_MAXAGE = 15;
const KINDS = new Set(['buy', 'sell', 'buyback', 'burn', 'fee']);

export default route(async (req, res, url) => {
  const n = Number(url.searchParams.get('limit') || 50);
  const limit = Number.isInteger(n) ? Math.min(200, Math.max(1, n)) : 50;
  const cfg = agentConfig();
  if (!cfg) return send(res, 200, { rows: [] }, S_MAXAGE);

  const hist = await fetchAgentTxs(cfg);
  let quantDecimals = null;
  if (cfg.quantMint) {
    try {
      const q = (await getBalances(cfg)).tokens.get(cfg.quantMint);
      if (q) quantDecimals = q.decimals;
    } catch (e) {
      logSoft('balances', e);
    }
  }
  const book = replayBook(agentRecords(hist.txs, cfg.address, cfg.quantMint), quantDecimals);
  const picked = book.rows.filter((r) => KINDS.has(r.kind)).slice(-limit).reverse();

  const mints = new Set();
  for (const r of picked) if (r.mint) mints.add(r.mint);
  if (cfg.quantMint && picked.some((r) => r.kind === 'buyback' || r.kind === 'burn')) mints.add(cfg.quantMint);
  const meta = mints.size ? await tokenMeta([...mints], { maxLookups: 20 }) : new Map();

  const rows = picked.map((r) => {
    const mint = r.kind === 'buy' || r.kind === 'sell' ? r.mint : r.kind === 'buyback' || r.kind === 'burn' ? cfg.quantMint : null;
    const m = (mint && meta.get(mint)) || {};
    let amountRaw = null;
    if (r.kind === 'burn') amountRaw = r.amountRaw.toString();
    if (r.kind === 'buyback' && r.quantReceivedRaw) amountRaw = r.quantReceivedRaw.toString();
    return {
      sig: r.sig,
      t: r.t,
      kind: r.kind.toUpperCase(),
      mint,
      symbol: m.symbol ?? null,
      image: m.image ?? null,
      sol: r.kind === 'buy' ? round(sol(r.lamportsIn)) : r.kind === 'sell' ? round(sol(r.lamportsOut)) : r.kind === 'buyback' || r.kind === 'fee' ? round(sol(r.lamports)) : null,
      pnlSol: r.kind === 'sell' && r.pnl !== null ? round(sol(r.pnl)) : null,
      pct: r.kind === 'sell' ? r.pct : null,
      reason: r.kind === 'sell' ? r.reason : null,
      thesis: r.kind === 'buy' || r.kind === 'sell' ? r.thesis || null : null,
      amountRaw,
    };
  });
  send(res, 200, { rows }, S_MAXAGE);
});
