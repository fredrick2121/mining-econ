/* Mining economics calculation engine. Pure functions, no DOM.
   Rates are fractions (0.10 = 10%). Works in browser (window.MiningEcon) and Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MiningEcon = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const E = {};
  const pw = Math.pow;

  /* ---------- Interest factors (discrete compounding) ---------- */
  E.fp = (i, n) => pw(1 + i, n);                                   // F/P
  E.pf = (i, n) => pw(1 + i, -n);                                  // P/F
  E.fa = (i, n) => (i === 0 ? n : (pw(1 + i, n) - 1) / i);         // F/A
  E.af = (i, n) => (i === 0 ? 1 / n : i / (pw(1 + i, n) - 1));     // A/F
  E.pa = (i, n) => (i === 0 ? n : (1 - pw(1 + i, -n)) / i);        // P/A
  E.ap = (i, n) => (i === 0 ? 1 / n : i / (1 - pw(1 + i, -n)));    // A/P
  E.ag = (i, n) => (i === 0 ? (n - 1) / 2 : 1 / i - n / (pw(1 + i, n) - 1)); // A/G
  E.pg = (i, n) => (i === 0 ? (n * (n - 1)) / 2 : (E.pa(i, n) - n * E.pf(i, n)) / i); // P/G
  E.fg = (i, n) => E.pg(i, n) * E.fp(i, n);                        // F/G

  // Geometric gradient: first payment a1 at t=1, growing at g per period.
  E.pGeometric = (a1, g, i, n) =>
    Math.abs(i - g) < 1e-12 ? (n * a1) / (1 + i) : (a1 * (1 - pw((1 + g) / (1 + i), n))) / (i - g);

  /* ---------- Rate conversions ---------- */
  E.effFromNominal = (r, m) => pw(1 + r / m, m) - 1;
  E.nominalFromEff = (ie, m) => m * (pw(1 + ie, 1 / m) - 1);
  E.effFromContinuous = (r) => Math.exp(r) - 1;
  E.continuousFromEff = (ie) => Math.log(1 + ie);
  E.realRate = (i, f) => (1 + i) / (1 + f) - 1;       // i = market, f = inflation
  E.marketRate = (ir, f) => (1 + ir) * (1 + f) - 1;   // combined rate

  /* ---------- Generic numeric helpers ---------- */
  function bisect(fn, lo, hi, tol = 1e-12, maxIt = 300) {
    let flo = fn(lo), fhi = fn(hi);
    if (!isFinite(flo) || !isFinite(fhi) || flo * fhi > 0) return NaN;
    for (let k = 0; k < maxIt; k++) {
      const mid = (lo + hi) / 2, fm = fn(mid);
      if (Math.abs(fm) < tol || (hi - lo) / 2 < tol) return mid;
      if (flo * fm < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
    }
    return (lo + hi) / 2;
  }
  E.bisect = bisect;

  /* ---------- Solve unknown i or n ---------- */
  // Single payment: F = P (1+i)^n
  E.singleI = (P, F, n) => pw(F / P, 1 / n) - 1;
  E.singleN = (P, F, i) => Math.log(F / P) / Math.log(1 + i);
  // Annuity: P = A * P/A(i,n)
  E.annuityPI = (P, A, n) => bisect((i) => A * E.pa(i, n) - P, -0.9999, 100);
  E.annuityPN = (P, A, i) => (P * i >= A ? NaN : -Math.log(1 - (P * i) / A) / Math.log(1 + i));
  // Sinking fund: F = A * F/A(i,n)
  E.annuityFI = (F, A, n) => bisect((i) => A * E.fa(i, n) - F, -0.9999, 100);
  E.annuityFN = (F, A, i) => Math.log(1 + (F * i) / A) / Math.log(1 + i);

  /* ---------- Cash-flow measures ---------- */
  // flows[0] at t=0
  E.npv = (rate, flows) => flows.reduce((s, c, t) => s + c / pw(1 + rate, t), 0);
  E.nfv = (rate, flows) => E.npv(rate, flows) * pw(1 + rate, flows.length - 1);
  E.euaw = (rate, flows) => E.npv(rate, flows) * E.ap(rate, flows.length - 1);

  // All real roots of NPV(r)=0 for r > -0.99, found by scanning v = 1/(1+r).
  E.irrAll = (flows) => {
    const f = (r) => E.npv(r, flows);
    const roots = [];
    // v = 1/(1+r): v in [0.001, 10] -> r in [-0.9, 999]
    const N = 4000, vmin = 0.001, vmax = 10;
    const rOf = (v) => 1 / v - 1;
    let prevR = rOf(vmax), prevF = f(prevR);
    for (let k = 1; k <= N; k++) {
      const v = vmax * pw(vmin / vmax, k / N);
      const r = rOf(v), fr = f(r);
      if (isFinite(prevF) && isFinite(fr)) {
        if (fr === 0) roots.push(r);
        else if (prevF * fr < 0) {
          const root = bisect(f, prevR, r);
          if (!isNaN(root)) roots.push(root);
        }
      }
      prevR = r; prevF = fr;
    }
    const uniq = [];
    roots.sort((a, b) => a - b).forEach((r) => { if (!uniq.length || Math.abs(r - uniq[uniq.length - 1]) > 1e-9) uniq.push(r); });
    return uniq;
  };
  E.irr = (flows) => {
    const r = E.irrAll(flows);
    if (!r.length) return NaN;
    // prefer smallest non-negative root, else the root closest to zero
    const nonneg = r.filter((x) => x >= 0);
    return nonneg.length ? nonneg[0] : r.reduce((a, b) => (Math.abs(b) < Math.abs(a) ? b : a));
  };
  E.signChanges = (flows) => {
    let c = 0, prev = 0;
    flows.forEach((x) => { const s = Math.sign(x); if (s !== 0) { if (prev !== 0 && s !== prev) c++; prev = s; } });
    return c;
  };
  E.mirr = (flows, financeRate, reinvestRate) => {
    const n = flows.length - 1;
    const neg = flows.map((c) => Math.min(c, 0)), pos = flows.map((c) => Math.max(c, 0));
    const pvNeg = -E.npv(financeRate, neg);
    const fvPos = E.npv(reinvestRate, pos) * pw(1 + reinvestRate, n);
    return pvNeg <= 0 || fvPos <= 0 ? NaN : pw(fvPos / pvNeg, 1 / n) - 1;
  };
  // Payback in periods with linear interpolation. rate=0 -> simple payback.
  E.payback = (flows, rate = 0) => {
    let cum = 0;
    for (let t = 0; t < flows.length; t++) {
      const pv = flows[t] / pw(1 + rate, t), prev = cum;
      cum += pv;
      if (t > 0 && prev < 0 && cum >= 0) return t - 1 + -prev / pv;
      if (t === 0 && cum >= 0 && pv >= 0) return 0;
    }
    return NaN;
  };
  // Profitability index = PV(inflows t>=1) / PV(outflows) ; B/C = PV benefits / PV costs
  E.pvPosNeg = (rate, flows) => {
    let pos = 0, neg = 0;
    flows.forEach((c, t) => { const pv = c / pw(1 + rate, t); if (pv >= 0) pos += pv; else neg -= pv; });
    return { pos, neg };
  };
  E.benefitCost = (rate, flows) => { const { pos, neg } = E.pvPosNeg(rate, flows); return neg === 0 ? NaN : pos / neg; };
  E.profitabilityIndex = (rate, flows) => {
    const initial = -flows[0];
    if (initial <= 0) return NaN;
    return (E.npv(rate, flows) + initial) / initial;
  };

  // Incremental analysis: B minus A (pad shorter with zeros)
  E.incremental = (a, b) => {
    const n = Math.max(a.length, b.length);
    return Array.from({ length: n }, (_, t) => (b[t] || 0) - (a[t] || 0));
  };

  /* ---------- Capital recovery ---------- */
  E.capitalRecovery = (P, S, i, n) => (P - S) * E.ap(i, n) + S * i; // CR with salvage
  E.equivalentAnnualCost = (P, S, annualCost, i, n) => E.capitalRecovery(P, S, i, n) + annualCost;
  E.capitalizedCost = (P, A, i) => P + A / i;

  /* ---------- Depreciation ---------- */
  // each returns array of {year, dep, acc, bv}
  function schedule(C, S, deps) {
    let acc = 0;
    return deps.map((d, k) => { acc += d; return { year: k + 1, dep: d, acc, bv: C - acc }; });
  }
  E.depSL = (C, S, n) => schedule(C, S, Array.from({ length: n }, () => (C - S) / n));
  E.depDB = (C, S, n, rate) => {   // rate: 1/n*factor ; never below salvage
    let bv = C; const out = [];
    for (let t = 0; t < n; t++) { const d = Math.max(0, Math.min(rate * bv, bv - S)); out.push(d); bv -= d; }
    return schedule(C, S, out);
  };
  E.depDDB = (C, S, n) => E.depDB(C, S, n, 2 / n);
  E.depSYD = (C, S, n) => {
    const sum = (n * (n + 1)) / 2;
    return schedule(C, S, Array.from({ length: n }, (_, t) => ((C - S) * (n - t)) / sum));
  };
  E.depUOP = (C, S, units) => {
    const tot = units.reduce((a, b) => a + b, 0);
    return schedule(C, S, units.map((u) => ((C - S) * u) / tot));
  };

  /* ---------- Depletion ---------- */
  E.costDepletion = (basis, remainingUnits, unitsSold) => (basis / remainingUnits) * unitsSold;
  E.percentDepletion = (rate, grossIncome, taxableBeforeDepletion, limit = 0.5) =>
    Math.min(rate * grossIncome, Math.max(0, limit * taxableBeforeDepletion));

  /* ---------- Mining-specific ---------- */
  // Break-even cut-off grade (units of product per tonne ore).
  E.cutoffGrade = ({ mineCost, procCost, gaCost, price, sellCost, recovery }) =>
    (mineCost + procCost + gaCost) / (recovery * (price - sellCost));
  // Tonnage and average grade above cut-off; rows = [{grade, tonnes}]
  E.aboveCutoff = (rows, cutoff) => {
    let t = 0, m = 0;
    rows.forEach((r) => { if (r.grade >= cutoff) { t += r.tonnes; m += r.tonnes * r.grade; } });
    return { tonnes: t, metal: m, avgGrade: t ? m / t : NaN };
  };
  E.reserves = ({ volume, density, grade, miningRec, dilution, procRec }) => {
    const insitu = volume * density, metalInsitu = insitu * grade;
    const mined = insitu * miningRec * (1 + dilution);          // diluted ore tonnes
    const gradeMined = grade / (1 + dilution);                  // waste at zero grade
    const metalRecovered = mined * gradeMined * procRec;
    return { insitu, metalInsitu, mined, gradeMined, metalRecovered };
  };
  // Taylor's empirical rule: life = 6.5 * T^0.25 (T in million tonnes)
  E.taylor = (tonnesTotal) => {
    const life = 6.5 * pw(tonnesTotal / 1e6, 0.25);
    return { life, annual: tonnesTotal / life, daily350: tonnesTotal / life / 350 };
  };
  E.breakEvenStripRatio = ({ valuePerOreTonne, oreCost, wasteCost }) => (valuePerOreTonne - oreCost) / wasteCost;

  /* ---------- Project model (annual, constant production) ---------- */
  // p: capex, workingCapital, life, tonnes, grade, recovery, price, sellCost, royalty, opexPerTonne,
  //    fixedCost, taxRate, depYears, salvage, rate, carryForward (bool), inflRevenue? (not used)
  E.projectModel = (p) => {
    const rows = [];
    const dep = p.depYears > 0 ? E.depSL(p.capex, p.salvage, p.depYears).map((r) => r.dep) : [];
    let carry = 0;
    const btcf = [-(p.capex + p.workingCapital)];
    const atcf = [-(p.capex + p.workingCapital)];
    for (let t = 1; t <= p.life; t++) {
      const revenue = p.tonnes * p.grade * p.recovery * (p.price - p.sellCost);
      const royalty = revenue * p.royalty;
      const opex = p.tonnes * p.opexPerTonne + p.fixedCost;
      const d = dep[t - 1] || 0;
      const ebitda = revenue - royalty - opex;
      let ti = ebitda - d;
      let usedCarry = 0;
      if (p.carryForward) {
        if (ti < 0) { carry += -ti; ti = 0; }
        else { usedCarry = Math.min(carry, ti); carry -= usedCarry; ti -= usedCarry; }
      }
      const tax = Math.max(0, ti) * p.taxRate;
      let before = ebitda, after = ebitda - tax;
      if (t === p.life) { before += p.workingCapital + p.salvage; after += p.workingCapital + p.salvage; }
      btcf.push(before); atcf.push(after);
      rows.push({ year: t, revenue, royalty, opex, ebitda, dep: d, taxable: ti, tax, btcf: before, atcf: after });
    }
    return {
      rows, btcf, atcf,
      npvBefore: E.npv(p.rate, btcf), npvAfter: E.npv(p.rate, atcf),
      irrBefore: E.irr(btcf), irrAfter: E.irr(atcf),
      paybackAfter: E.payback(atcf, 0), discPaybackAfter: E.payback(atcf, p.rate),
      pi: E.profitabilityIndex(p.rate, atcf),
    };
  };

  // Sensitivity of after-tax NPV to +/- changes in selected variables.
  E.sensitivity = (p, deltas) => {
    const vars = [
      ['price', 'price'], ['grade', 'grade'], ['recovery', 'recovery'],
      ['opexPerTonne', 'opex'], ['capex', 'capex'], ['rate', 'rate'],
    ];
    return vars.map(([key, id]) => ({
      id, key,
      values: deltas.map((d) => E.projectModel({ ...p, [key]: p[key] * (1 + d) }).npvAfter),
    }));
  };

  return E;
});
