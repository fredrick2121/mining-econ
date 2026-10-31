const E = require('../engine.js');
let fail = 0;
function eq(name, got, want, tol = 1e-4) {
  const ok = Math.abs(got - want) <= tol * Math.max(1, Math.abs(want));
  if (!ok) fail++;
  console.log((ok ? 'ok   ' : 'FAIL ') + name + ' got=' + got + ' want=' + want);
}
// Standard tables (i=10%, n=5)
eq('F/P', E.fp(0.1, 5), 1.6105);
eq('P/F', E.pf(0.1, 5), 0.6209);
eq('F/A', E.fa(0.1, 5), 6.1051);
eq('A/F', E.af(0.1, 5), 0.16380);
eq('P/A', E.pa(0.1, 5), 3.7908);
eq('A/P', E.ap(0.1, 5), 0.26380);
eq('A/G', E.ag(0.1, 5), 1.8101);
eq('P/G', E.pg(0.1, 5), 6.8618);
eq('i=0 P/A', E.pa(0, 5), 5);
// Gradient consistency: P/G equals PV of 0,1,2,3,4 at 10%
eq('P/G brute', E.npv(0.1, [0, 0, 1, 2, 3, 4]), E.pg(0.1, 5), 1e-9);
// Geometric gradient brute force
const g = []; for (let t = 1; t <= 6; t++) g.push(100 * Math.pow(1.05, t - 1));
eq('geo', E.pGeometric(100, 0.05, 0.12, 6), E.npv(0.12, [0, ...g]), 1e-9);
eq('geo i=g', E.pGeometric(100, 0.1, 0.1, 6), E.npv(0.1, [0, ...Array.from({ length: 6 }, (_, k) => 100 * Math.pow(1.1, k))]), 1e-9);
// Rates
eq('eff 12%/12', E.effFromNominal(0.12, 12), 0.126825, 1e-5);
eq('nominal back', E.nominalFromEff(E.effFromNominal(0.12, 12), 12), 0.12, 1e-9);
eq('cont', E.effFromContinuous(0.1), 0.105171, 1e-5);
eq('real rate', E.realRate(0.2, 0.1), 0.090909, 1e-5);
// Solve i, n
eq('single i', E.singleI(100, 200, 7), 0.104104, 1e-4);
eq('single n', E.singleN(100, 200, 0.1), 7.2725, 1e-4);
eq('annuity i', E.annuityPI(1000, 263.80, 5), 0.10, 1e-3);
eq('annuity n', E.annuityPN(1000, 263.80, 0.1), 5, 1e-3);
eq('sinking n', E.annuityFN(6105.1, 1000, 0.1), 5, 1e-3);
eq('sinking i', E.annuityFI(6105.1, 1000, 5), 0.1, 1e-4);
// IRR
eq('IRR classic', E.irr([-1000, 500, 500, 500]), 0.233752, 1e-4);
eq('IRR loss', E.irr([-100, 50, 50]), -0.0, 1e-6 + 0.0 + 1e-3 > 0 ? 1e-3 : 1e-3); // 0% exactly
eq('IRR simple', E.irr([-100, 110]), 0.10, 1e-6);
eq('NPV', E.npv(0.1, [-1000, 500, 500, 500]), 243.43, 1e-4);
const multi = [-100, 230, -132]; // roots 10% and 20%
const roots = E.irrAll(multi);
eq('multi roots count', roots.length, 2, 0);
eq('multi root1', roots[0], 0.10, 1e-6);
eq('multi root2', roots[1], 0.20, 1e-6);
eq('sign changes', E.signChanges(multi), 2, 0);
eq('MIRR', E.mirr([-1000, 500, 500, 500], 0.1, 0.1), Math.pow(1655 / 1000, 1 / 3) - 1, 1e-9);
eq('payback', E.payback([-1000, 500, 500, 500]), 2, 1e-9);
eq('payback frac', E.payback([-1000, 400, 400, 400]), 2.5, 1e-9);
eq('EUAW', E.euaw(0.1, [-1000, 500, 500, 500]), E.npv(0.1, [-1000, 500, 500, 500]) * E.ap(0.1, 3), 1e-9);
eq('PI', E.profitabilityIndex(0.1, [-1000, 500, 500, 500]), 1.24343, 1e-4);
// Capital recovery
eq('CR', E.capitalRecovery(10000, 2000, 0.1, 5), 8000 * 0.2638 + 200, 1e-4);
// Depreciation
eq('SL', E.depSL(10000, 1000, 5)[0].dep, 1800, 1e-9);
eq('SYD y1', E.depSYD(10000, 1000, 5)[0].dep, 3000, 1e-9);
eq('SYD sum', E.depSYD(10000, 1000, 5).at(-1).acc, 9000, 1e-9);
eq('DDB y1', E.depDDB(10000, 1000, 5)[0].dep, 4000, 1e-9);
eq('DDB floor', E.depDDB(10000, 1000, 5).at(-1).bv >= 1000 - 1e-9 ? 1 : 0, 1, 0);
eq('UOP', E.depUOP(10000, 1000, [100, 200, 300])[1].dep, 3000, 1e-9);
// Depletion
eq('cost depletion', E.costDepletion(1e6, 500000, 50000), 100000, 1e-9);
eq('pct depletion cap', E.percentDepletion(0.15, 1e6, 200000, 0.5), 100000, 1e-9);
// Mining
eq('cutoff', E.cutoffGrade({ mineCost: 20, procCost: 15, gaCost: 5, price: 50, sellCost: 0, recovery: 0.8 }), 1.0, 1e-9);
const ac = E.aboveCutoff([{ grade: 0.5, tonnes: 100 }, { grade: 1, tonnes: 100 }, { grade: 2, tonnes: 100 }], 1);
eq('above tonnes', ac.tonnes, 200, 0);
eq('above grade', ac.avgGrade, 1.5, 1e-9);
const rs = E.reserves({ volume: 1e6, density: 2.7, grade: 0.02, miningRec: 0.9, dilution: 0.1, procRec: 0.85 });
eq('insitu', rs.insitu, 2.7e6, 1e-9);
eq('mined', rs.mined, 2.7e6 * 0.9 * 1.1, 1e-9);
eq('diluted grade', rs.gradeMined, 0.02 / 1.1, 1e-9);
eq('taylor', E.taylor(16e6).life, 13, 1e-9);
// Project model: no tax, SL -> NPV must equal manual
const p = { capex: 1000, workingCapital: 0, life: 3, tonnes: 100, grade: 1, recovery: 1, price: 10, sellCost: 0, royalty: 0, opexPerTonne: 0, fixedCost: 0, taxRate: 0, depYears: 3, salvage: 0, rate: 0.1, carryForward: false };
const pm = E.projectModel(p);
eq('proj npv', pm.npvAfter, E.npv(0.1, [-1000, 1000, 1000, 1000]), 1e-9);
const p2 = { ...p, taxRate: 0.3 };
const pm2 = E.projectModel(p2);
// revenue 1000/yr, dep 333.33 -> tax 200 -> ATCF 800
eq('proj atcf', pm2.atcf[1], 800, 1e-9);
// Loss carry-forward: loss year then profit
const p3 = { ...p, life: 2, tonnes: 100, price: 4, taxRate: 0.5, depYears: 2, capex: 400, carryForward: true };
const pm3 = E.projectModel(p3);
// rev 400, dep 200, TI=200 both years -> tax 100
eq('proj tax', pm3.rows[0].tax, 100, 1e-9);
// Sensitivity: 0 delta -> base NPV
const s = E.sensitivity(p2, [0, 0.1]);
eq('sens base', s[0].values[0], pm2.npvAfter, 1e-9);
console.log(fail ? '\n' + fail + ' FAILED' : '\nALL PASSED');
process.exit(fail ? 1 : 0);
