// QUANT API shared code. Leading underscore: Vercel does not expose this file as a route.

// ==== QUANT RULES BEGIN ====
// Shared, pure QUANT rules. This block is byte-identical in engine/rules.mjs and site/api/_lib.js.
// Edit one, copy to the other (rules.test.mjs fails if they drift).

export const MEMO_PROGRAM = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
export const MEMO_PROGRAM_LEGACY = 'Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo';
export const MEMO_PROGRAMS = new Set([MEMO_PROGRAM, MEMO_PROGRAM_LEGACY]);
export const SOL_MINT = 'So11111111111111111111111111111111111111112';
export const STONK_MINT = '6GmAFSYs4gk3FDao5FzzySQpPZaWsa4rUJHacpMpUNgx';
export const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
export const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
export const STONK_BASE = 'https://www.stonkfun.xyz';
export const CANDIDATES_URL = `${STONK_BASE}/api/public/v1/tokens?sort=volume&status=graduated&pageSize=25`;
export const DEX_TOKENS_URL = 'https://api.dexscreener.com/tokens/v1/solana/';
export const DEX_BATCH = 30;

export const MIN_LIQ_USD = 25_000;
export const RESERVE_LAMPORTS = 50_000_000n; // 0.05 SOL always kept
export const MAX_POSITIONS = 5;
export const MAX_BUY_PCT = 15; // % of tradable SOL per buy
export const MIN_BUY_LAMPORTS = 10_000_000n; // 0.01 SOL
export const STOP_PCT = -25; // forced 100% sell at or below
export const TP_PCT = 40; // forced 50% sell at or above, once per position
export const TP_SELL_PCT = 50;
export const MAX_HOLD_SEC = 6 * 3600;
export const BUYBACK_MIN = 20_000_000n; // 0.02 SOL
export const BUYBACK_SHARE_BPS = 5_000n; // 50% of realized profit
export const MEMO_MAX_BYTES = 180;
export const THESIS_MAX = 90;
export const FEE_DUST_LAMPORTS = 1_000n; // inbound transfers at or below this are spam dust, not fees
export const SELL_REASONS = ['stop', 'tp', 'time', 'model'];

const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const B58_MAP = (() => {
  const m = new Int16Array(128).fill(-1);
  for (let i = 0; i < B58_ALPHABET.length; i++) m[B58_ALPHABET.charCodeAt(i)] = i;
  return m;
})();
const B58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/;

export function base58Decode(str) {
  if (typeof str !== 'string') return null;
  if (str.length === 0) return new Uint8Array(0);
  let zeros = 0;
  while (zeros < str.length && str[zeros] === '1') zeros++;
  const bytes = []; // little-endian accumulator
  for (let i = zeros; i < str.length; i++) {
    const c = str.charCodeAt(i);
    const v = c < 128 ? B58_MAP[c] : -1;
    if (v < 0) return null;
    let carry = v;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  const out = new Uint8Array(zeros + bytes.length);
  for (let i = 0; i < bytes.length; i++) out[out.length - 1 - i] = bytes[i];
  return out;
}

export function base58Encode(bytes) {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  const digits = []; // little-endian base58 digits
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let s = '1'.repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i--) s += B58_ALPHABET[digits[i]];
  return s;
}

export function isAddress(s) {
  if (typeof s !== 'string' || s.length < 32 || s.length > 44 || !B58_RE.test(s)) return false;
  const b = base58Decode(s);
  return b !== null && b.length === 32;
}

export function lamportsToSol(l) {
  const v = BigInt(l);
  const neg = v < 0n;
  const a = neg ? -v : v;
  const n = Number(a / 1_000_000_000n) + Number(a % 1_000_000_000n) / 1e9;
  return neg ? -n : n;
}

export function toLamports(x) {
  if (typeof x === 'bigint') return x;
  if (typeof x === 'number' && Number.isSafeInteger(x)) return BigInt(x);
  if (typeof x === 'string' && /^\d{1,20}$/.test(x)) return BigInt(x);
  return 0n;
}

// Helius tokenTransfers.tokenAmount is a UI number; for WSOL (9 decimals) convert to lamports.
export function uiSolToLamports(x) {
  const n = Number(x);
  if (!Number.isFinite(n) || n <= 0) return 0n;
  return BigInt(Math.round(n * 1e9));
}

export function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function absImage(u) {
  if (typeof u !== 'string' || !u) return null;
  if (u.startsWith('//')) return `https:${u}`;
  if (u.startsWith('/')) return STONK_BASE + u;
  if (/^https?:\/\//i.test(u)) return u;
  return null;
}

export function decodeMemoData(data) {
  const raw = base58Decode(data);
  if (raw === null) return null;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(raw);
  } catch {
    return null;
  }
}

// All memo texts in a Helius enhanced tx (top-level and inner instructions).
export function extractMemos(tx) {
  const out = [];
  const visit = (ix) => {
    if (!ix || typeof ix !== 'object') return;
    if (MEMO_PROGRAMS.has(ix.programId) && typeof ix.data === 'string') {
      const t = decodeMemoData(ix.data);
      if (t !== null) out.push(t);
    }
    if (Array.isArray(ix.innerInstructions)) ix.innerInstructions.forEach(visit);
  };
  if (Array.isArray(tx?.instructions)) tx.instructions.forEach(visit);
  return out;
}

// ---- memos ----
// Thesis: plain printable ASCII, single spaces, at most THESIS_MAX chars.
export function cleanThesis(s) {
  if (typeof s !== 'string') return '';
  return s
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”″]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7E]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, THESIS_MAX)
    .trim();
}

// prefix is ASCII, so bytes === chars; the thesis is cut to keep the memo within MEMO_MAX_BYTES.
function withThesis(prefix, thesis) {
  const room = Math.max(0, MEMO_MAX_BYTES - prefix.length);
  return prefix + cleanThesis(thesis).slice(0, room).trimEnd();
}

export function buyMemo(mint, lamportsIn, thesis) {
  return withThesis(`QUANT:BUY:${mint}:${BigInt(lamportsIn)}:`, thesis);
}
export function sellMemo(mint, lamportsOut, pct, reason, thesis) {
  if (!SELL_REASONS.includes(reason)) throw new Error(`bad sell reason ${reason}`);
  return withThesis(`QUANT:SELL:${mint}:${BigInt(lamportsOut)}:${Math.round(pct)}:${reason}:`, thesis);
}
export function buybackMemo(lamports) {
  return `QUANT:BUYBACK:${BigInt(lamports)}`;
}
export function burnMemo(amountRaw) {
  return `QUANT:BURN:${BigInt(amountRaw)}`;
}

const MINT_RE = '([1-9A-HJ-NP-Za-km-z]{32,44})';
const BUY_RE = new RegExp(`^QUANT:BUY:${MINT_RE}:(\\d{1,20}):([\\x20-\\x7E]*)$`);
const SELL_RE = new RegExp(`^QUANT:SELL:${MINT_RE}:(\\d{1,20}):(\\d{1,3}):(stop|tp|time|model):([\\x20-\\x7E]*)$`);

export function parseQuantMemo(text) {
  if (typeof text !== 'string' || text.length > MEMO_MAX_BYTES + 20) return null;
  let m;
  if ((m = BUY_RE.exec(text))) {
    if (!isAddress(m[1])) return null;
    const lamportsIn = BigInt(m[2]);
    if (lamportsIn <= 0n) return null;
    return { kind: 'buy', mint: m[1], lamportsIn, thesis: m[3] };
  }
  if ((m = SELL_RE.exec(text))) {
    const pct = Number(m[3]);
    if (!isAddress(m[1]) || pct < 1 || pct > 100) return null;
    return { kind: 'sell', mint: m[1], lamportsOut: BigInt(m[2]), pct, reason: m[4], thesis: m[5] };
  }
  if ((m = /^QUANT:BUYBACK:(\d{1,20})$/.exec(text))) return { kind: 'buyback', lamports: BigInt(m[1]) };
  if ((m = /^QUANT:BURN:(\d{1,30})$/.exec(text))) return { kind: 'burn', amountRaw: BigInt(m[1]) };
  return null;
}

// Classify one Helius enhanced tx touching the agent wallet. Returns null (failed/unusable) or
// {sig, t, kind, ...} with kind buy | sell | buyback | burn | fee | other.
// QUANT memos only count on txs the agent itself signed (feePayer), so nobody can fake trades.
// fee = inbound SOL (native or WSOL) on a tx the agent did not sign.
export function classifyAgentTx(tx, agent, quantMint) {
  if (!tx || tx.transactionError || typeof tx.signature !== 'string' || !Number.isFinite(tx.timestamp)) return null;
  const base = { sig: tx.signature, t: tx.timestamp };
  const nt = Array.isArray(tx.nativeTransfers) ? tx.nativeTransfers : [];
  const tt = Array.isArray(tx.tokenTransfers) ? tx.tokenTransfers : [];

  if (tx.feePayer === agent) {
    for (const text of extractMemos(tx)) {
      const tag = parseQuantMemo(text);
      if (!tag) continue;
      const rec = { ...base, ...tag };
      if (tag.kind === 'sell') {
        // Actual proceeds (WSOL received by the agent) beat the quoted amount in the memo.
        let got = 0n;
        for (const x of tt) if (x && x.mint === SOL_MINT && x.toUserAccount === agent && x.fromUserAccount !== agent) got += uiSolToLamports(x.tokenAmount);
        if (got > 0n) rec.lamportsOut = got;
      } else if (tag.kind === 'buyback') {
        let raw = null;
        if (quantMint) {
          for (const x of tt) {
            if (x && x.mint === quantMint && x.toUserAccount === agent && x.fromUserAccount !== agent && x.rawTokenAmount && /^\d+$/.test(String(x.rawTokenAmount.tokenAmount))) {
              raw = (raw || 0n) + BigInt(x.rawTokenAmount.tokenAmount);
            }
          }
        }
        rec.quantReceivedRaw = raw;
        rec.quantReceivedUi = quantMint ? tt.filter((x) => x && x.mint === quantMint && x.toUserAccount === agent && x.fromUserAccount !== agent).reduce((a, x) => a + (num(x.tokenAmount) || 0), 0) : null;
      }
      return rec;
    }
    return { ...base, kind: 'other' };
  }

  let inbound = 0n;
  for (const x of nt) if (x && x.toUserAccount === agent && x.fromUserAccount !== agent) inbound += toLamports(x.amount);
  for (const x of tt) if (x && x.mint === SOL_MINT && x.toUserAccount === agent && x.fromUserAccount !== agent) inbound += uiSolToLamports(x.tokenAmount);
  if (inbound > FEE_DUST_LAMPORTS) return { ...base, kind: 'fee', lamports: inbound };
  return { ...base, kind: 'other' };
}

// Records oldest first (Helius pages are newest first), deduped, failed txs dropped.
export function agentRecords(txs, agent, quantMint) {
  const seen = new Set();
  const out = [];
  for (const tx of txs || []) {
    if (!tx || seen.has(tx.signature)) continue;
    seen.add(tx.signature);
    const r = classifyAgentTx(tx, agent, quantMint);
    if (r) out.push(r);
  }
  out.reverse();
  return out.map((r, i) => ({ r, i })).sort((a, b) => a.r.t - b.r.t || a.i - b.i).map((x) => x.r);
}

// Replay records (oldest first) into open positions, per-trade PnL, stats and the buyback queue.
// Cost basis: sum of BUY lamportsIn, reduced pro rata by each SELL's pct. A SELL of a mint with no
// known open cost (its BUY is older than the loaded history) gets pnl null and is not counted.
// quantDecimals converts UI token amounts of buyback receipts to raw when Helius gives no raw amount.
export function replayBook(records, quantDecimals = null) {
  const open = new Map(); // mint -> {mint, costLamports, openedAt, thesis, tpDone, buySig}
  const rows = [];
  let buys = 0, sells = 0, wins = 0, losses = 0;
  let realized = 0n, queue = 0n, buyback = 0n, burned = 0n, burnable = 0n, fees = 0n;
  for (const rec of records) {
    if (!rec) continue;
    const r = { ...rec };
    if (r.kind === 'buy') {
      buys++;
      const p = open.get(r.mint);
      if (p && p.costLamports > 0n) {
        p.costLamports += r.lamportsIn;
        if (r.thesis) p.thesis = r.thesis;
      } else {
        open.set(r.mint, { mint: r.mint, costLamports: r.lamportsIn, openedAt: r.t, thesis: r.thesis || '', tpDone: false, buySig: r.sig });
      }
    } else if (r.kind === 'sell') {
      sells++;
      const p = open.get(r.mint);
      if (p && p.costLamports > 0n) {
        const costSold = r.pct >= 100 ? p.costLamports : (p.costLamports * BigInt(r.pct)) / 100n;
        p.costLamports -= costSold;
        if (r.reason === 'tp') p.tpDone = true;
        if (r.pct >= 100 || p.costLamports <= 0n) open.delete(r.mint);
        r.costSold = costSold;
        r.pnl = r.lamportsOut - costSold;
        r.entryThesis = p.thesis;
        realized += r.pnl;
        if (r.pnl > 0n) {
          wins++;
          queue += (r.pnl * BUYBACK_SHARE_BPS) / 10_000n;
        } else if (r.pnl < 0n) losses++;
      } else {
        r.costSold = null;
        r.pnl = null;
      }
    } else if (r.kind === 'buyback') {
      queue -= r.lamports;
      if (queue < 0n) queue = 0n;
      buyback += r.lamports;
      const got = r.quantReceivedRaw ?? (quantDecimals !== null && r.quantReceivedUi > 0 ? uiToRaw(r.quantReceivedUi, quantDecimals) : 0n);
      if (got > 0n) burnable += got;
    } else if (r.kind === 'burn') {
      burned += r.amountRaw;
      burnable -= r.amountRaw;
      if (burnable < 0n) burnable = 0n;
    } else if (r.kind === 'fee') {
      fees += r.lamports;
    }
    rows.push(r);
  }
  return {
    open,
    rows,
    queueLamports: queue,
    burnableRaw: burnable,
    stats: {
      trades: buys + sells, buys, sells, wins, losses,
      winRate: wins + losses > 0 ? wins / (wins + losses) : null,
      realizedLamports: realized, buybackLamports: buyback, burnedRaw: burned, feesLamports: fees,
    },
  };
}

// RPC getTokenAccountsByOwner (jsonParsed) value[] -> Map mint -> {raw, decimals, ui, programId}
export function parseTokenAccounts(values, programId) {
  const out = new Map();
  for (const v of Array.isArray(values) ? values : []) {
    const info = v && v.account && v.account.data && v.account.data.parsed && v.account.data.parsed.info;
    const ta = info && info.tokenAmount;
    if (!info || !ta || !isAddress(info.mint) || !/^\d+$/.test(String(ta.amount))) continue;
    const decimals = Number(ta.decimals);
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) continue;
    const prev = out.get(info.mint);
    const raw = (prev ? prev.raw : 0n) + BigInt(ta.amount);
    out.set(info.mint, { mint: info.mint, raw, decimals, ui: rawToUi(raw, decimals), programId: programId || (v.account && typeof v.account.owner === 'string' ? v.account.owner : null) });
  }
  return out;
}

export function uiToRaw(ui, decimals) {
  const n = Number(ui);
  if (!Number.isFinite(n) || n <= 0 || n >= 1e20) return 0n;
  const [i, d = ''] = n.toFixed(decimals).split('.');
  return BigInt(i + d);
}

export function rawToUi(raw, decimals) {
  const d = 10n ** BigInt(decimals);
  const r = BigInt(raw);
  return Number(r / d) + Number(r % d) / Number(d);
}

// DexScreener pairs (flat array, any mints) -> Map mint -> highest-liquidity pair whose base is that mint.
export function bestPairs(pairs) {
  const out = new Map();
  for (const p of Array.isArray(pairs) ? pairs : []) {
    const mint = p && p.baseToken && p.baseToken.address;
    if (!mint || typeof p.pairAddress !== 'string') continue;
    const prev = out.get(mint);
    if (!prev || (num(p.liquidity && p.liquidity.usd) || 0) > (num(prev.liquidity && prev.liquidity.usd) || 0)) out.set(mint, p);
  }
  return out;
}

// SOL/USD from DexScreener pairs: a SOL/USDC|USDT pair, else any SOL-quoted pair (priceUsd / priceNative).
export function solUsdFrom(pairs) {
  let best = null;
  let bestLiq = -1;
  for (const p of Array.isArray(pairs) ? pairs : []) {
    if (!p || !p.baseToken || !p.quoteToken) continue;
    const liq = num(p.liquidity && p.liquidity.usd) || 0;
    let v = null;
    let rank = 0;
    if (p.baseToken.address === SOL_MINT && /^(USDC|USDT)$/.test(p.quoteToken.symbol || '')) {
      v = num(p.priceUsd);
      rank = 1;
    } else if (p.quoteToken.address === SOL_MINT) {
      const usd = num(p.priceUsd);
      const nat = num(p.priceNative);
      if (usd && nat) v = usd / nat;
    }
    if (!(v > 0)) continue;
    const score = rank * 1e15 + liq;
    if (score > bestLiq) {
      bestLiq = score;
      best = v;
    }
  }
  return best;
}

// Value in SOL of `ui` tokens priced by a DexScreener pair.
export function valueSol(ui, pair, solUsd) {
  if (!pair || !(ui >= 0)) return null;
  const nat = num(pair.priceNative);
  if (pair.quoteToken && pair.quoteToken.address === SOL_MINT && nat !== null) return ui * nat;
  const usd = num(pair.priceUsd);
  return usd !== null && solUsd ? (ui * usd) / solUsd : null;
}

// Candidate set: StonkFun graduated-by-volume list joined with DexScreener, QUANT/STONK excluded,
// liquidity >= MIN_LIQ_USD. Keeps StonkFun's volume order.
export function buildCandidates(tokens, pairs, quantMint) {
  const best = bestPairs(pairs);
  const rows = [];
  const seen = new Set();
  for (const t of Array.isArray(tokens) ? tokens : []) {
    if (!t || !isAddress(t.mint) || seen.has(t.mint) || t.mint === STONK_MINT || (quantMint && t.mint === quantMint)) continue;
    seen.add(t.mint);
    const p = best.get(t.mint);
    if (!p) continue;
    const liq = num(p.liquidity && p.liquidity.usd);
    if (liq === null || liq < MIN_LIQ_USD) continue;
    const g = (o, k) => (o ? num(o[k]) : null);
    rows.push({
      mint: t.mint,
      symbol: (typeof t.symbol === 'string' && t.symbol) || (p.baseToken && p.baseToken.symbol) || null,
      name: (typeof t.name === 'string' && t.name) || (p.baseToken && p.baseToken.name) || null,
      image: absImage(t.imageUrl) || absImage(p.info && p.info.imageUrl),
      priceUsd: num(p.priceUsd),
      priceNative: num(p.priceNative),
      quoteIsSol: !!(p.quoteToken && p.quoteToken.address === SOL_MINT),
      liqUsd: liq,
      mcapUsd: num(p.marketCap) ?? num(t.market && t.market.marketCapUsd),
      vol5m: g(p.volume, 'm5'),
      vol1h: g(p.volume, 'h1'),
      chg5m: g(p.priceChange, 'm5'),
      chg1h: g(p.priceChange, 'h1'),
      chg6h: g(p.priceChange, 'h6'),
      buys1h: p.txns && p.txns.h1 ? num(p.txns.h1.buys) : null,
      sells1h: p.txns && p.txns.h1 ? num(p.txns.h1.sells) : null,
    });
  }
  return rows;
}

export function chunk(list, n) {
  const out = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out;
}
// ==== QUANT RULES END ====

// ==== API HELPERS (Vercel functions only) ====

const HELIUS_TX_BASE = 'https://api-mainnet.helius-rpc.com/v0/addresses';
const HELIUS_RPC = 'https://mainnet.helius-rpc.com/';
const HELIUS_HOST = 'api-mainnet.helius-rpc.com';
const MAX_HISTORY_PAGES = 5;

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export class UpstreamError extends Error {
  constructor(host, detail) {
    super(`${host}: ${detail}`);
    this.host = host;
    this.detail = detail;
  }
}

export const nowSec = () => Math.floor(Date.now() / 1000);

const scrub = (s) => String(s).replace(/api-key=[^&\s"']+/gi, 'api-key=***');

// ---- tiny TTL cache (module scope, survives warm invocations) ----
class TTLCache {
  constructor(max) {
    this.max = max;
    this.m = new Map();
  }
  get(k) {
    const e = this.m.get(k);
    if (!e) return undefined;
    if (e.exp < Date.now()) {
      this.m.delete(k);
      return undefined;
    }
    return e.v;
  }
  set(k, v, ttlMs) {
    if (!this.m.has(k) && this.m.size >= this.max) this.m.delete(this.m.keys().next().value);
    this.m.set(k, { v, exp: Date.now() + ttlMs });
    return v;
  }
  clear() {
    this.m.clear();
  }
}
const cache = new TTLCache(5000);
const inflight = new Map();
export const _clearCache = () => cache.clear();

async function cached(key, ttlMs, loader) {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    try {
      const v = await loader();
      const ttl = typeof ttlMs === 'function' ? ttlMs(v) : ttlMs;
      if (ttl > 0) cache.set(key, v, ttl);
      return v;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function getJson(url, { method = 'GET', headers = {}, body, allow404 = false, timeoutMs = 8000 } = {}) {
  const host = new URL(url).host;
  let r;
  try {
    r = await fetch(url, { method, headers: { Accept: 'application/json', ...headers }, body, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    throw new UpstreamError(host, e && e.name === 'TimeoutError' ? 'timeout' : 'network error');
  }
  if (allow404 && r.status === 404) return null;
  if (!r.ok) throw new UpstreamError(host, `status ${r.status}`);
  try {
    return await r.json();
  } catch {
    throw new UpstreamError(host, 'invalid json');
  }
}

// ---- responses ----
export function send(res, status, body, sMaxAge) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', sMaxAge > 0 ? `s-maxage=${sMaxAge}, stale-while-revalidate=${2 * sMaxAge}` : 'no-store');
  res.end(JSON.stringify(body));
}

export function route(fn) {
  return async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      return send(res, 405, { error: 'method not allowed' }, 0);
    }
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      await fn(req, res, url);
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, { error: e.message }, 0);
      console.error(scrub(e && e.stack ? e.stack : e));
      if (e instanceof UpstreamError) return send(res, 502, { error: `upstream unavailable (${e.host})` }, 0);
      return send(res, 500, { error: 'internal error' }, 0);
    }
  };
}

export const logSoft = (what, e) => console.error(`${what}: ${scrub(e && e.message ? e.message : e)}`);

// ---- config ----
// null when AGENT_WALLET is unset; throws 500 on a broken config.
export function agentConfig() {
  const address = (process.env.AGENT_WALLET || '').trim();
  const quantMint = (process.env.QUANT_MINT || '').trim();
  if (quantMint && !isAddress(quantMint)) throw new HttpError(500, 'server misconfigured');
  if (!address) return null;
  const key = (process.env.HELIUS_API_KEY || '').trim();
  if (!isAddress(address) || !key) throw new HttpError(500, 'server misconfigured');
  return { address, key, quantMint: quantMint || null };
}
export function quantMintEnv() {
  const m = (process.env.QUANT_MINT || '').trim();
  if (m && !isAddress(m)) throw new HttpError(500, 'server misconfigured');
  return m || null;
}

// ---- StonkFun ----
export function getStonkList() {
  return cached('stonk:list', 30_000, async () => {
    const j = await getJson(CANDIDATES_URL);
    const list = j && j.data && Array.isArray(j.data.tokens) ? j.data.tokens : null;
    if (!list) throw new UpstreamError('www.stonkfun.xyz', 'unexpected shape');
    return list.filter((t) => t && isAddress(t.mint));
  });
}

// StonkFun token object, or null when the mint is not a StonkFun coin.
function getStonkToken(mint) {
  return cached(`stonk:tok:${mint}`, (v) => (v ? 3_600_000 : 600_000), async () => {
    const j = await getJson(`${STONK_BASE}/api/public/v1/tokens/${mint}`, { allow404: true });
    const t = j && j.data && j.data.token;
    return t && typeof t === 'object' && t.mint === mint ? t : null;
  });
}

// ---- DexScreener ----
// Flat pairs array for up to any number of mints (batched ≤30 per call, cached 15 s per batch).
export async function getDexPairs(mints) {
  const uniq = [...new Set(mints.filter(isAddress))].sort();
  const batches = await mapLimit(chunk(uniq, DEX_BATCH), 3, (b) =>
    cached(`ds:${b.join(',')}`, 15_000, async () => {
      const j = await getJson(DEX_TOKENS_URL + b.join(','));
      return Array.isArray(j) ? j : [];
    }),
  );
  return batches.flat();
}

// Candidate rows (same filter the engine uses).
export async function getCandidates(quantMint) {
  const tokens = await getStonkList();
  const pairs = await getDexPairs(tokens.map((t) => t.mint));
  return { tokens, rows: buildCandidates(tokens, pairs, quantMint) };
}

// {symbol, name, image} per mint: StonkFun list, then StonkFun per-token (≤maxLookups), then DexScreener pairs.
export async function tokenMeta(mints, { pairs = [], maxLookups = 12 } = {}) {
  const out = new Map();
  let list = [];
  try {
    list = await getStonkList();
  } catch (e) {
    logSoft('stonk list', e);
  }
  for (const t of list) out.set(t.mint, { symbol: t.symbol ?? null, name: t.name ?? null, image: absImage(t.imageUrl) });
  const missing = [...new Set(mints)].filter((m) => isAddress(m) && !out.has(m));
  const looked = await mapLimit(missing.slice(0, maxLookups), 4, (m) => getStonkToken(m).catch((e) => (logSoft('stonk token', e), null)));
  looked.forEach((t, i) => {
    if (t) out.set(missing[i], { symbol: t.symbol ?? null, name: t.name ?? null, image: absImage(t.imageUrl) });
  });
  const best = bestPairs(pairs);
  for (const m of mints) {
    const p = best.get(m);
    const cur = out.get(m);
    if (cur && cur.symbol && cur.image) continue;
    if (!p) continue;
    out.set(m, {
      symbol: (cur && cur.symbol) || (p.baseToken && p.baseToken.symbol) || null,
      name: (cur && cur.name) || (p.baseToken && p.baseToken.name) || null,
      image: (cur && cur.image) || absImage(p.info && p.info.imageUrl),
    });
  }
  return out;
}

// ---- Helius ----
// Agent txs newest first, up to 5 pages of 100. exhausted=true means the full history was read.
export function fetchAgentTxs(cfg) {
  return cached(`helius:${cfg.address}`, 10_000, async () => {
    const txs = [];
    let before = null;
    let exhausted = false;
    let pagesRead = 0;
    for (let guard = 0; guard < MAX_HISTORY_PAGES * 2 && pagesRead < MAX_HISTORY_PAGES; guard++) {
      const q = new URLSearchParams({ 'api-key': cfg.key, limit: '100' });
      if (before) q.set('before', before);
      let r;
      try {
        r = await fetch(`${HELIUS_TX_BASE}/${cfg.address}/transactions?${q}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(9000) });
      } catch (e) {
        throw new UpstreamError(HELIUS_HOST, e && e.name === 'TimeoutError' ? 'timeout' : 'network error');
      }
      let j = null;
      try {
        j = await r.json();
      } catch {
        j = null;
      }
      if (!r.ok || !Array.isArray(j)) {
        // "Failed to find events within the search period... set to <sig>" → continue from there
        const msg = j && typeof j.error === 'string' ? j.error : '';
        const m = /set to ([1-9A-HJ-NP-Za-km-z]{64,90})/.exec(msg);
        if (m) {
          before = m[1];
          continue;
        }
        throw new UpstreamError(HELIUS_HOST, `status ${r.status}`);
      }
      pagesRead++;
      if (j.length === 0) {
        exhausted = true;
        break;
      }
      txs.push(...j);
      const last = j[j.length - 1];
      if (!last || typeof last.signature !== 'string' || last.signature === before) break;
      before = last.signature;
    }
    let oldestT = null;
    for (const tx of txs) if (Number.isFinite(tx.timestamp) && (oldestT === null || tx.timestamp < oldestT)) oldestT = tx.timestamp;
    return { txs, exhausted, oldestT };
  });
}

async function rpc(cfg, method, params) {
  const j = await getJson(`${HELIUS_RPC}?api-key=${encodeURIComponent(cfg.key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!j || j.error || !j.result) throw new UpstreamError('mainnet.helius-rpc.com', j && j.error ? `rpc error ${j.error.code}` : 'unexpected shape');
  return j.result;
}

// {lamports (native), tokens: Map mint -> {raw, decimals, ui, programId}} for the agent.
export function getBalances(cfg) {
  return cached(`bal:${cfg.address}`, 10_000, async () => {
    const [bal, t1, t2] = await Promise.all([
      rpc(cfg, 'getBalance', [cfg.address, { commitment: 'confirmed' }]),
      rpc(cfg, 'getTokenAccountsByOwner', [cfg.address, { programId: TOKEN_PROGRAM }, { encoding: 'jsonParsed', commitment: 'confirmed' }]),
      rpc(cfg, 'getTokenAccountsByOwner', [cfg.address, { programId: TOKEN_2022_PROGRAM }, { encoding: 'jsonParsed', commitment: 'confirmed' }]),
    ]);
    if (!Number.isSafeInteger(bal.value)) throw new UpstreamError('mainnet.helius-rpc.com', 'unexpected shape');
    const tokens = parseTokenAccounts(t1.value, TOKEN_PROGRAM);
    for (const [m, v] of parseTokenAccounts(t2.value, TOKEN_2022_PROGRAM)) tokens.set(m, v);
    return { lamports: BigInt(bal.value), tokens };
  });
}

export const sol = (l) => (l === null || l === undefined ? null : lamportsToSol(l));
export const round = (v, d = 6) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);
