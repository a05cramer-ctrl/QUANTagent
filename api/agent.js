import {
  route, send, nowSec, agentConfig, fetchAgentTxs, getBalances, getDexPairs, tokenMeta, agentRecords, replayBook,
  bestPairs, solUsdFrom, valueSol, sol, round, logSoft, SOL_MINT,
} from './_lib.js';

const S_MAXAGE = 15;

function empty(now) {
  return {
    agent: null, updatedAt: now, sol: 0, solUsd: null, equitySol: 0, equityUsd: null, feesInSol: 0, positions: [],
    stats: { trades: 0, buys: 0, sells: 0, wins: 0, losses: 0, winRate: null, realizedSol: 0, buybackSol: 0, burnedRaw: '0' },
    history: { from: null, complete: true },
  };
}

export default route(async (req, res) => {
  const now = nowSec();
  const cfg = agentConfig();
  if (!cfg) return send(res, 200, empty(now), S_MAXAGE);

  const [hist, bal] = await Promise.all([fetchAgentTxs(cfg), getBalances(cfg)]);
  const quant = cfg.quantMint ? bal.tokens.get(cfg.quantMint) : null;
  const book = replayBook(agentRecords(hist.txs, cfg.address, cfg.quantMint), quant ? quant.decimals : null);

  const wsol = bal.tokens.get(SOL_MINT);
  const solLamports = bal.lamports + (wsol ? wsol.raw : 0n);
  const held = [...bal.tokens.values()].filter((t) => t.raw > 0n && t.mint !== SOL_MINT && t.mint !== cfg.quantMint && book.open.has(t.mint));

  let pairs = [];
  try {
    pairs = await getDexPairs([SOL_MINT, ...held.map((t) => t.mint)]);
  } catch (e) {
    logSoft('dexscreener', e);
  }
  const solUsd = solUsdFrom(pairs);
  const best = bestPairs(pairs);
  const meta = held.length ? await tokenMeta(held.map((t) => t.mint), { pairs }) : new Map();

  let posValue = 0;
  const positions = held.map((t) => {
    const p = book.open.get(t.mint);
    const pair = best.get(t.mint) || null;
    const v = valueSol(t.ui, pair, solUsd);
    const cost = sol(p.costLamports);
    if (v !== null) posValue += v;
    const m = meta.get(t.mint) || {};
    return {
      mint: t.mint,
      symbol: m.symbol ?? null,
      name: m.name ?? null,
      image: m.image ?? null,
      amount: t.ui,
      valueSol: round(v),
      valueUsd: v !== null && solUsd ? round(v * solUsd, 2) : null,
      costSol: round(cost),
      pnlSol: v !== null ? round(v - cost) : null,
      pnlPct: v !== null && cost > 0 ? round((v / cost - 1) * 100, 2) : null,
      openedAt: p.openedAt,
      thesis: p.thesis || null,
      priceChangeH1: pair && pair.priceChange ? (Number.isFinite(Number(pair.priceChange.h1)) ? Number(pair.priceChange.h1) : null) : null,
    };
  }).sort((a, b) => b.openedAt - a.openedAt);

  const solNow = sol(solLamports);
  const equitySol = solNow + posValue;
  const s = book.stats;
  send(res, 200, {
    agent: cfg.address,
    updatedAt: now,
    sol: round(solNow),
    solUsd: round(solUsd, 4),
    equitySol: round(equitySol),
    equityUsd: solUsd ? round(equitySol * solUsd, 2) : null,
    feesInSol: round(sol(s.feesLamports)),
    positions,
    stats: {
      trades: s.trades, buys: s.buys, sells: s.sells, wins: s.wins, losses: s.losses,
      winRate: s.winRate === null ? null : round(s.winRate, 4),
      realizedSol: round(sol(s.realizedLamports)),
      buybackSol: round(sol(s.buybackLamports)),
      burnedRaw: s.burnedRaw.toString(),
    },
    history: { from: hist.oldestT, complete: hist.exhausted },
  }, S_MAXAGE);
});
