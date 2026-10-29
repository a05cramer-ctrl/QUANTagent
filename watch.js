import { route, send, agentConfig, quantMintEnv, getCandidates, getBalances, round, logSoft } from './_lib.js';

const S_MAXAGE = 30;

export default route(async (req, res) => {
  const cfg = agentConfig();
  const quantMint = cfg ? cfg.quantMint : quantMintEnv();
  const [{ rows: cands }, bal] = await Promise.all([
    getCandidates(quantMint),
    cfg ? getBalances(cfg).catch((e) => (logSoft('balances', e), null)) : null,
  ]);
  const rows = cands.map((c) => {
    const t = bal && bal.tokens.get(c.mint);
    return {
      mint: c.mint, symbol: c.symbol, name: c.name, image: c.image,
      priceUsd: c.priceUsd, liqUsd: round(c.liqUsd, 2), vol5m: c.vol5m, vol1h: c.vol1h,
      chg5m: c.chg5m, chg1h: c.chg1h, chg6h: c.chg6h, buys1h: c.buys1h, sells1h: c.sells1h,
      held: !!(t && t.raw > 0n),
    };
  });
  send(res, 200, { rows }, S_MAXAGE);
});
