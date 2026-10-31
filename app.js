/* UI layer: schema-driven modules, bilingual (fa/en), live calculation. */
(function () {
  const E = window.MiningEcon;
  const T = (fa, en) => ({ fa, en });
  let lang = safeGet('lang') || 'fa';
  let shown = '';
  const tx = (o) => (typeof o === 'string' ? o : o[lang]);

  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  /* ---------- parsing / formatting ---------- */
  const norm = (s) => String(s)
    .replace(/[۰-۹]/g, (c) => c.charCodeAt(0) - 1776)
    .replace(/[٠-٩]/g, (c) => c.charCodeAt(0) - 1632)
    .replace(/٫/g, '.').replace(/[٬،]/g, ',').replace(/[−–]/g, '-');
  const num = (s) => { const x = parseFloat(norm(s).replace(/,/g, '')); return isNaN(x) ? NaN : x; };
  const list = (s) => norm(s).split(/[\s;,]+/).filter(Boolean).map(Number);
  const fmt = (x, d = 4) => (x === undefined || x === null || !isFinite(x) ? '—' :
    Number(x).toLocaleString('en-US', { maximumFractionDigits: d }));
  const pct = (x, d = 3) => (isFinite(x) ? fmt(x * 100, d) + ' %' : '—');
  const yrs = (x) => (isFinite(x) ? fmt(x, 2) : '—');

  /* ---------- field helpers ---------- */
  const N = (k, l, d, u) => ({ k, l, t: 'n', d, u });
  const P = (k, l, d) => ({ k, l, t: 'p', d, u: '%' });
  const L = (k, l, d, hint) => ({ k, l, t: 'list', d, hint });
  const S = (k, l, opts, d) => ({ k, l, t: 's', o: opts, d });
  const R = (k, l, d, hint) => ({ k, l, t: 'rows', d, hint });

  const M = [];

  /* 1. Interest factors */
  M.push({
    id: 'factors', icon: 'F/P', title: T('ضرایب بهره (F/P, P/A, …)', 'Interest factors (F/P, P/A, …)'),
    desc: T('همهٔ ضرایب ارزش زمانی پول برای i و n', 'All time-value-of-money factors for i and n'),
    fields: [P('i', T('نرخ بهره i', 'Interest rate i'), 10), N('n', T('تعداد دوره n', 'Periods n'), 5)],
    run(v) {
      const { i, n } = v;
      const f = [
        ['F/P', E.fp(i, n)], ['P/F', E.pf(i, n)], ['F/A', E.fa(i, n)], ['A/F', E.af(i, n)],
        ['P/A', E.pa(i, n)], ['A/P', E.ap(i, n)], ['A/G', E.ag(i, n)], ['P/G', E.pg(i, n)], ['F/G', E.fg(i, n)],
      ];
      return { items: f.map(([a, b]) => [a, fmt(b, 6)]) };
    },
  });

  /* 2. Convert amounts */
  M.push({
    id: 'convert', icon: 'P·F·A', title: T('تبدیل P ، F ، A ، G', 'Convert P, F, A, G'),
    desc: T('معادل‌سازی مبلغ حال، آینده، سالیانه و گرادیان', 'Equivalent present, future, annual and gradient amounts'),
    fields: [
      S('type', T('مقدار معلوم', 'Known amount'), [['P', T('P ارزش حال', 'P present')], ['F', T('F ارزش آینده', 'F future')], ['A', T('A سالیانه', 'A annual')],
        ['G', T('G گرادیان حسابی', 'G arithmetic gradient')], ['GEO', T('گرادیان هندسی (A1 و g)', 'Geometric gradient (A1, g)')]], 'P'),
      N('x', T('مبلغ', 'Amount'), 100000), P('i', T('نرخ بهره i', 'Interest rate i'), 10), N('n', T('تعداد دوره n', 'Periods n'), 5),
      Object.assign(P('g', T('نرخ رشد g (فقط هندسی)', 'Growth g (geometric only)'), 5), { opt: true }),
    ],
    run(v) {
      const { type, x, i, n } = v; let p, f, a; const items = [];
      if (type === 'P') { p = x; f = x * E.fp(i, n); a = x * E.ap(i, n); }
      else if (type === 'F') { f = x; p = x * E.pf(i, n); a = x * E.af(i, n); }
      else if (type === 'A') { a = x; p = x * E.pa(i, n); f = x * E.fa(i, n); }
      else if (type === 'G') { p = x * E.pg(i, n); a = x * E.ag(i, n); f = x * E.fg(i, n); }
      else { p = E.pGeometric(x, v.g || 0, i, n); a = p * E.ap(i, n); f = p * E.fp(i, n); }
      items.push([T('P ارزش حال', 'P (present)'), fmt(p, 2)], [T('F ارزش آینده', 'F (future)'), fmt(f, 2)], [T('A معادل سالیانه', 'A (equivalent annual)'), fmt(a, 2)]);
      return { items };
    },
  });

  /* 3. Rates */
  M.push({
    id: 'rates', icon: 'i', title: T('نرخ اسمی، مؤثر و تورم', 'Nominal, effective & inflation'),
    desc: T('تبدیل نرخ‌ها، مرکب پیوسته، نرخ واقعی', 'Rate conversion, continuous compounding, real rate'),
    fields: [P('r', T('نرخ اسمی سالیانه', 'Nominal annual rate'), 12), N('m', T('دفعات مرکب‌سازی در سال m', 'Compounding periods per year m'), 12),
      P('f', T('نرخ تورم', 'Inflation rate'), 20)],
    run(v) {
      const ie = E.effFromNominal(v.r, v.m);
      const items = [
        [T('نرخ مؤثر سالیانه', 'Effective annual rate'), pct(ie, 4)],
        [T('نرخ مؤثر با مرکب پیوسته (e^r − 1)', 'Effective with continuous compounding'), pct(E.effFromContinuous(v.r), 4)],
        [T('نرخ اسمی پیوسته معادل نرخ مؤثر', 'Continuous rate equal to the effective rate'), pct(E.continuousFromEff(ie), 4)],
        [T('نرخ بهره هر دوره (r/m)', 'Rate per period (r/m)'), pct(v.r / v.m, 4)],
        [T('نرخ واقعی (حذف تورم از نرخ مؤثر)', 'Real rate (inflation removed from effective rate)'), pct(E.realRate(ie, v.f), 4)],
        [T('نرخ ترکیبی (نرخ مؤثر به‌عنوان نرخ واقعی + تورم)', 'Combined rate (effective as real rate + inflation)'), pct(E.marketRate(ie, v.f), 4)],
      ];
      return { items };
    },
  });

  /* 4. Solve i or n */
  M.push({
    id: 'solve', icon: 'i / n', title: T('یافتن نرخ بهره یا تعداد دوره', 'Solve for i or n'),
    desc: T('i یا n از روی P، F، A', 'Find i or n from P, F, A'),
    fields: [
      S('mode', T('مسئله', 'Problem'), [
        ['si', T('i از P و F (پرداخت واحد)', 'i from P and F (single payment)')], ['sn', T('n از P و F', 'n from P and F')],
        ['pi', T('i از P و A', 'i from P and A')], ['pn', T('n از P و A', 'n from P and A')],
        ['fi', T('i از F و A', 'i from F and A')], ['fn', T('n از F و A', 'n from F and A')]], 'si'),
      Object.assign(N('Pv', 'P', 1000), { opt: true }), Object.assign(N('Fv', 'F', 2000), { opt: true }), Object.assign(N('Av', 'A', 200), { opt: true }),
      Object.assign(P('i', 'i', 10), { opt: true }), Object.assign(N('n', 'n', 7), { opt: true }),
    ],
    run(v) {
      let r, label, isRate = false;
      const need = (...ks) => ks.forEach((k) => { if (!isFinite(v[k])) throw new Error('missing'); });
      switch (v.mode) {
        case 'si': need('Pv', 'Fv', 'n'); r = E.singleI(v.Pv, v.Fv, v.n); isRate = true; break;
        case 'sn': need('Pv', 'Fv', 'i'); r = E.singleN(v.Pv, v.Fv, v.i); break;
        case 'pi': need('Pv', 'Av', 'n'); r = E.annuityPI(v.Pv, v.Av, v.n); isRate = true; break;
        case 'pn': need('Pv', 'Av', 'i'); r = E.annuityPN(v.Pv, v.Av, v.i); break;
        case 'fi': need('Fv', 'Av', 'n'); r = E.annuityFI(v.Fv, v.Av, v.n); isRate = true; break;
        default: need('Fv', 'Av', 'i'); r = E.annuityFN(v.Fv, v.Av, v.i);
      }
      label = isRate ? T('نرخ بهره i', 'Interest rate i') : T('تعداد دوره n', 'Number of periods n');
      const notes = [];
      if (!isFinite(r)) notes.push(T('جواب وجود ندارد (مقادیر ورودی سازگار نیستند).', 'No solution exists for these inputs.'));
      notes.push(T('فقط فیلدهای مرتبط با مسئلهٔ انتخابی استفاده می‌شوند.', 'Only the fields relevant to the chosen problem are used.'));
      return { items: [[label, isRate ? pct(r, 4) : yrs(r)]], notes };
    },
  });

  /* 5. Cash flow analysis: NPV, IRR (ROR) ... */
  M.push({
    id: 'cashflow', icon: 'ROR', title: T('NPV ، IRR (ROR) ، بازگشت سرمایه', 'NPV, IRR (ROR), payback'),
    desc: T('تحلیل جریان نقدی: NPV، نرخ بازگشت، MIRR، PI، B/C', 'Cash-flow analysis: NPV, rate of return, MIRR, PI, B/C'),
    fields: [
      L('cf', T('جریان نقدی (سال ۰، ۱، ۲، …) — منفی = هزینه', 'Cash flows (year 0,1,2,…) — negative = cost'), '-1000, 400, 400, 400, 400', T('با ویرگول یا فاصله جدا کنید', 'Separate with commas or spaces')),
      P('i', T('نرخ حداقل جذب‌کننده MARR', 'Discount rate / MARR'), 10),
      P('rr', T('نرخ سرمایه‌گذاری مجدد (برای MIRR)', 'Reinvestment rate (for MIRR)'), 10),
    ],
    run(v) {
      const cf = v.cf; if (cf.length < 2 || cf.some((x) => !isFinite(x))) throw new Error('missing');
      const roots = E.irrAll(cf);
      const notes = [];
      const sc = E.signChanges(cf);
      if (sc > 1) notes.push(T(`هشدار: ${sc} تغییر علامت در جریان نقدی؛ ممکن است چند ROR وجود داشته باشد. برای تصمیم از NPV یا MIRR استفاده کنید.`, `Warning: ${sc} sign changes in the cash flow; multiple RORs are possible. Decide with NPV or MIRR.`));
      if (!roots.length) notes.push(T('ROR (IRR) وجود ندارد.', 'No IRR/ROR exists.'));
      const npv = E.npv(v.i, cf), irr = E.irr(cf);
      if (isFinite(irr)) notes.push(npv >= 0 ? T('پروژه در این نرخ جذب‌کننده اقتصادی است (NPV ≥ 0).', 'Project is acceptable at this rate (NPV ≥ 0).') : T('پروژه در این نرخ اقتصادی نیست (NPV < 0).', 'Project is not acceptable at this rate (NPV < 0).'));
      const items = [
        ['NPV', fmt(npv, 2)], ['NFV', fmt(E.nfv(v.i, cf), 2)], [T('EUAW (ارزش سالیانه یکنواخت)', 'EUAW (equivalent uniform annual worth)'), fmt(E.euaw(v.i, cf), 2)],
        [T('IRR / ROR', 'IRR / ROR'), pct(irr, 4)],
      ];
      if (roots.length > 1) items.push([T('همهٔ ریشه‌ها', 'All roots'), roots.map((r) => pct(r, 3)).join(' ، ')]);
      items.push(['MIRR', pct(E.mirr(cf, v.i, v.rr), 4)], [T('شاخص سودآوری PI', 'Profitability index PI'), fmt(E.profitabilityIndex(v.i, cf), 4)],
        ['B/C', fmt(E.benefitCost(v.i, cf), 4)], [T('دورهٔ بازگشت ساده', 'Simple payback'), yrs(E.payback(cf, 0))],
        [T('دورهٔ بازگشت تنزیل‌شده', 'Discounted payback'), yrs(E.payback(cf, v.i))]);
      const mx = isFinite(irr) && irr > 0 ? Math.min(Math.max(irr * 2, 0.3), 3) : 0.5;
      const xs = Array.from({ length: 41 }, (_, k) => (mx * k) / 40);
      return { items, notes, chart: { xs, ys: xs.map((r) => E.npv(r, cf)), xl: T('نرخ تنزیل', 'Discount rate'), yl: 'NPV', xfmt: (x) => fmt(x * 100, 0) + '%' } };
    },
  });

  /* 6. Compare two alternatives */
  M.push({
    id: 'compare', icon: 'ΔROR', title: T('مقایسهٔ دو طرح (ROR افزایشی)', 'Compare two alternatives (incremental ROR)'),
    desc: T('طرح B نسبت به A: NPV و ΔROR', 'Alternative B vs A: NPV and ΔROR'),
    fields: [
      L('a', T('جریان نقدی طرح A (از سال ۰)', 'Cash flows of A (from year 0)'), '-5000, 1500, 1500, 1500, 1500, 1500'),
      L('b', T('جریان نقدی طرح B (از سال ۰)', 'Cash flows of B (from year 0)'), '-8000, 2300, 2300, 2300, 2300, 2300'),
      P('i', 'MARR', 10),
    ],
    run(v) {
      if (v.a.length < 2 || v.b.length < 2 || [...v.a, ...v.b].some((x) => !isFinite(x))) throw new Error('missing');
      const d = E.incremental(v.a, v.b), dr = E.irr(d);
      const npvA = E.npv(v.i, v.a), npvB = E.npv(v.i, v.b), notes = [];
      if (isFinite(dr)) notes.push(dr >= v.i ? T('ΔROR ≥ MARR: سرمایه‌گذاری اضافه در B توجیه‌پذیر است؛ طرح B بهتر است.', 'ΔROR ≥ MARR: the extra investment in B is justified; choose B.') :
        T('ΔROR < MARR: طرح A (سرمایهٔ کمتر) بهتر است.', 'ΔROR < MARR: choose A (lower investment).'));
      notes.push(T('طول عمر دو طرح باید برابر باشد؛ در غیر این صورت از EUAW یا کوچک‌ترین مضرب مشترک عمرها استفاده کنید.', 'Lives must be equal; otherwise compare with EUAW or a common-multiple horizon.'));
      return {
        items: [[T('NPV طرح A', 'NPV of A'), fmt(npvA, 2)], [T('NPV طرح B', 'NPV of B'), fmt(npvB, 2)], [T('ROR طرح A', 'ROR of A'), pct(E.irr(v.a), 3)],
          [T('ROR طرح B', 'ROR of B'), pct(E.irr(v.b), 3)], [T('جریان افزایشی (B − A)', 'Incremental flow (B − A)'), d.map((x) => fmt(x, 0)).join(' , ')], ['ΔROR', pct(dr, 3)]],
        notes,
      };
    },
  });

  /* 7. Capital recovery */
  M.push({
    id: 'capital', icon: 'CR', title: T('بازیافت سرمایه و هزینهٔ سالیانه', 'Capital recovery & annual cost'),
    desc: T('CR با ارزش اسقاط، EAC، هزینهٔ سرمایه‌ای شده', 'CR with salvage value, EAC, capitalized cost'),
    fields: [N('P', T('سرمایه‌گذاری اولیه P', 'Initial investment P'), 1000000), N('S', T('ارزش اسقاط S', 'Salvage value S'), 100000),
      N('A', T('هزینهٔ سالیانه (بهره‌برداری)', 'Annual operating cost'), 150000), P('i', 'i', 12), N('n', 'n', 10)],
    run(v) {
      const cr = E.capitalRecovery(v.P, v.S, v.i, v.n);
      return { items: [[T('بازیافت سرمایه CR (سالیانه)', 'Capital recovery CR (per year)'), fmt(cr, 2)], [T('هزینهٔ یکنواخت سالیانه EAC', 'Equivalent annual cost EAC'), fmt(cr + v.A, 2)],
        [T('ارزش حال کل هزینه‌ها', 'Present worth of total cost'), fmt((cr + v.A) * E.pa(v.i, v.n), 2)],
        [T('هزینهٔ سرمایه‌ای شده (عمر نامحدود)', 'Capitalized cost (perpetual)'), fmt(E.capitalizedCost(v.P, v.A, v.i), 2)]] };
    },
  });

  /* 8. Depreciation */
  M.push({
    id: 'dep', icon: 'Dep', title: T('استهلاک', 'Depreciation'),
    desc: T('خط مستقیم، نزولی، SYD، تولید', 'Straight line, declining balance, SYD, units of production'),
    fields: [
      S('m', T('روش', 'Method'), [['SL', T('خط مستقیم', 'Straight line')], ['DDB', T('نزولی مضاعف', 'Double declining balance')], ['DB', T('نزولی با نرخ دلخواه', 'Declining balance (custom rate)')],
        ['SYD', T('مجموع ارقام سنواتی', 'Sum of years digits')], ['UOP', T('واحد تولید', 'Units of production')]], 'SL'),
      N('C', T('بهای تمام‌شده C', 'Cost basis C'), 1000000), N('S', T('ارزش اسقاط S', 'Salvage S'), 100000), N('n', T('عمر n (سال)', 'Life n (years)'), 5),
      Object.assign(P('d', T('نرخ (فقط DB)', 'Rate (DB only)'), 30), { opt: true }),
      Object.assign(L('u', T('تولید هر سال (فقط واحد تولید)', 'Output per year (UOP only)'), '100, 200, 300, 250, 150'), { opt: true }),
    ],
    run(v) {
      let s;
      if (v.m === 'SL') s = E.depSL(v.C, v.S, v.n);
      else if (v.m === 'DDB') s = E.depDDB(v.C, v.S, v.n);
      else if (v.m === 'DB') { if (!isFinite(v.d)) throw new Error('missing'); s = E.depDB(v.C, v.S, v.n, v.d); }
      else if (v.m === 'SYD') s = E.depSYD(v.C, v.S, v.n);
      else { if (!v.u.length || v.u.some((x) => !isFinite(x))) throw new Error('missing'); s = E.depUOP(v.C, v.S, v.u); }
      return { tables: [{ cols: [T('سال', 'Year'), T('استهلاک', 'Depreciation'), T('انباشته', 'Accumulated'), T('ارزش دفتری', 'Book value')],
        rows: s.map((r) => [r.year, fmt(r.dep, 2), fmt(r.acc, 2), fmt(r.bv, 2)]) }] };
    },
  });

  /* 9. Depletion */
  M.push({
    id: 'depl', icon: 'Dpl', title: T('استهلاک ذخیره (Depletion)', 'Depletion'),
    desc: T('روش هزینه‌ای و درصدی', 'Cost and percentage depletion'),
    fields: [N('basis', T('مبنای تعدیل‌شدهٔ ذخیره', 'Adjusted basis of deposit'), 5000000), N('rem', T('ذخیرهٔ قابل استحصال باقی‌مانده (واحد)', 'Remaining recoverable units'), 2000000),
      N('sold', T('مقدار فروش سال جاری (واحد)', 'Units sold this year'), 200000), P('rate', T('نرخ درصدی', 'Percentage rate'), 15),
      N('gross', T('درآمد ناخالص سال', 'Gross income'), 4000000), N('ti', T('درآمد مشمول مالیات قبل از Depletion', 'Taxable income before depletion'), 1500000),
      P('lim', T('سقف درصدی از درآمد مشمول مالیات', 'Cap as % of taxable income'), 50)],
    run(v) {
      const c = E.costDepletion(v.basis, v.rem, v.sold), p = E.percentDepletion(v.rate, v.gross, v.ti, v.lim);
      return { items: [[T('روش هزینه‌ای', 'Cost depletion'), fmt(c, 2)], [T('روش درصدی (با سقف)', 'Percentage depletion (capped)'), fmt(p, 2)],
        [T('مقدار مجاز (بیشتر از دو روش)', 'Allowed (higher of the two)'), fmt(Math.max(c, p), 2)]],
        notes: [T('قاعدهٔ «بیشتر از دو روش» و سقف ۵۰٪ از مقررات آمریکا است؛ برای قوانین مالیاتی ایران پارامترها را مطابق آن تنظیم کنید.', 'The "higher of two" rule and 50% cap follow US tax rules; adjust for your jurisdiction.')] };
    },
  });

  /* 10. Cut-off grade & tonnage-grade */
  M.push({
    id: 'cutoff', icon: 'g', title: T('عیار حد', 'Cut-off grade'),
    desc: T('عیار حد سر به سر و تناژ–عیار بالاتر از حد', 'Break-even cut-off grade and tonnage above cut-off'),
    fields: [N('cm', T('هزینهٔ استخراج به ازای تن سنگ', 'Mining cost per tonne'), 20), N('cp', T('هزینهٔ فرآوری به ازای تن', 'Processing cost per tonne'), 15),
      N('cg', T('هزینهٔ عمومی/اداری به ازای تن', 'G&A cost per tonne'), 5), N('pr', T('قیمت واحد محصول', 'Price per unit of product'), 50),
      N('cs', T('هزینهٔ فروش به ازای واحد محصول', 'Selling cost per unit'), 0), P('rec', T('بازیابی فرآوری', 'Processing recovery'), 80),
      Object.assign(R('rows', T('جدول تناژ–عیار (هر خط: عیار، تناژ)', 'Tonnage–grade table (each line: grade, tonnes)'), '0.5, 100000\n1.0, 80000\n1.5, 50000\n2.0, 20000'), { opt: true })],
    run(v) {
      const g = E.cutoffGrade({ mineCost: v.cm, procCost: v.cp, gaCost: v.cg, price: v.pr, sellCost: v.cs, recovery: v.rec });
      const items = [[T('عیار حد سر به سر (واحد محصول به ازای تن سنگ)', 'Break-even cut-off grade (product units per tonne ore)'), fmt(g, 5)]];
      const notes = [T('اگر عیار به صورت کسری (مثلاً ۰٫۰۱ برای ۱٪) و قیمت به ازای تن فلز باشد، ضرب نتیجه در ۱۰۰ درصد عیار حد را می‌دهد.', 'If grade is a fraction and price is per tonne of metal, multiply the result by 100 for % cut-off.')];
      const tables = [];
      if (v.rows && v.rows.length) {
        const rows = v.rows.filter((r) => r.length >= 2 && r.every(isFinite)).map((r) => ({ grade: r[0], tonnes: r[1] }));
        const a = E.aboveCutoff(rows, g);
        items.push([T('تناژ بالاتر از عیار حد', 'Tonnage above cut-off'), fmt(a.tonnes, 0)], [T('عیار متوسط بالاتر از حد', 'Average grade above cut-off'), fmt(a.avgGrade, 5)],
          [T('فلز محتوی', 'Contained metal'), fmt(a.metal, 2)]);
      }
      return { items, notes, tables };
    },
  });

  /* 11. Reserves, Taylor, strip ratio */
  M.push({
    id: 'reserve', icon: 'Res', title: T('ذخیره، رقیق‌شدگی، قانون تیلور', 'Reserves, dilution, Taylor rule'),
    desc: T('تناژ و فلز قابل استحصال، عمر معدن، نسبت باطله‌برداری', 'Mineable tonnage, metal, mine life, stripping ratio'),
    fields: [N('vol', T('حجم کانسار (m³)', 'Ore volume (m³)'), 5000000), N('den', T('چگالی (t/m³)', 'Density (t/m³)'), 2.7),
      N('gr', T('عیار (کسر یا واحد بر تن)', 'Grade (fraction or units/t)'), 0.01), P('mr', T('بازیابی معدنکاری', 'Mining recovery'), 90),
      P('dl', T('رقیق‌شدگی', 'Dilution'), 10), P('pr', T('بازیابی فرآوری', 'Processing recovery'), 85),
      N('val', T('ارزش خالص هر تن سنگ', 'Net value per tonne ore'), 80), N('oc', T('هزینهٔ هر تن سنگ (استخراج + فرآوری)', 'Cost per tonne ore'), 40),
      N('wc', T('هزینهٔ استخراج هر تن باطله', 'Mining cost per tonne waste'), 3)],
    run(v) {
      const r = E.reserves({ volume: v.vol, density: v.den, grade: v.gr, miningRec: v.mr, dilution: v.dl, procRec: v.pr });
      const t = E.taylor(r.mined);
      return { items: [[T('تناژ درجا', 'In-situ tonnage'), fmt(r.insitu, 0)], [T('فلز محتوی درجا', 'In-situ metal'), fmt(r.metalInsitu, 2)],
        [T('تناژ قابل استخراج (با رقیق‌شدگی)', 'Mineable tonnage (diluted)'), fmt(r.mined, 0)], [T('عیار پس از رقیق‌شدگی', 'Diluted grade'), fmt(r.gradeMined, 6)],
        [T('فلز قابل استحصال', 'Recovered metal'), fmt(r.metalRecovered, 2)],
        [T('عمر معدن (قانون تیلور: ۶٫۵·T^0.25، T به میلیون تن)', 'Mine life (Taylor: 6.5·T^0.25, T in Mt)'), yrs(t.life) + ' ' + tx(T('سال', 'years'))],
        [T('ظرفیت سالیانه تیلور', 'Taylor annual capacity'), fmt(t.annual, 0)], [T('ظرفیت روزانه (۳۵۰ روز)', 'Daily capacity (350 d)'), fmt(t.daily350, 0)],
        [T('نسبت باطله‌برداری سر به سر BESR', 'Break-even stripping ratio'), fmt(E.breakEvenStripRatio({ valuePerOreTonne: v.val, oreCost: v.oc, wasteCost: v.wc }), 3)]],
        notes: [T('قانون تیلور تجربی است و فقط برای برآورد اولیه مناسب است.', "Taylor's rule is empirical and suited to preliminary estimates only.")] };
    },
  });

  /* 12. Project model + sensitivity */
  M.push({
    id: 'project', icon: 'DCF', title: T('مدل پروژهٔ معدنی (قبل و بعد از مالیات)', 'Mining project model (pre/post tax)'),
    desc: T('جریان نقدی سالانه، مالیات، NPV، ROR، حساسیت', 'Annual cash flow, tax, NPV, ROR, sensitivity'),
    fields: [N('capex', T('سرمایه‌گذاری اولیه (Capex)', 'Capex'), 50000000), N('wcap', T('سرمایهٔ در گردش (در پایان بازیابی می‌شود)', 'Working capital (recovered at end)'), 5000000),
      N('life', T('عمر معدن (سال)', 'Mine life (years)'), 10), N('t', T('تناژ سنگ در سال', 'Ore tonnes per year'), 1000000),
      N('g', T('عیار (کسر یا واحد بر تن)', 'Grade (fraction or units/t)'), 0.01), P('rec', T('بازیابی کل', 'Total recovery'), 88),
      N('price', T('قیمت هر واحد محصول', 'Price per unit of product'), 8000), N('sc', T('هزینهٔ فروش/ذوب هر واحد', 'Selling/refining cost per unit'), 300),
      P('roy', T('حق‌الامتیاز (Royalty)', 'Royalty'), 3), N('opex', T('هزینهٔ عملیاتی هر تن سنگ', 'Operating cost per tonne'), 40),
      N('fix', T('هزینهٔ ثابت سالیانه', 'Fixed annual cost'), 2000000), P('tax', T('نرخ مالیات', 'Tax rate'), 25),
      N('dy', T('سال‌های استهلاک (خط مستقیم)', 'Depreciation years (SL)'), 8), N('salv', T('ارزش اسقاط', 'Salvage'), 0), P('i', T('نرخ تنزیل', 'Discount rate'), 10),
      S('cf', T('انتقال زیان به سال‌های بعد', 'Loss carry-forward'), [['1', T('بله', 'Yes')], ['0', T('خیر', 'No')]], '1')],
    run(v) {
      const p = { capex: v.capex, workingCapital: v.wcap, life: Math.round(v.life), tonnes: v.t, grade: v.g, recovery: v.rec, price: v.price, sellCost: v.sc,
        royalty: v.roy, opexPerTonne: v.opex, fixedCost: v.fix, taxRate: v.tax, depYears: Math.round(v.dy), salvage: v.salv, rate: v.i, carryForward: v.cf === '1' };
      if (p.life < 1 || p.life > 100) throw new Error('missing');
      const m = E.projectModel(p), sens = E.sensitivity(p, [-0.2, -0.1, 0, 0.1, 0.2]);
      const names = { price: T('قیمت', 'Price'), grade: T('عیار', 'Grade'), recovery: T('بازیابی', 'Recovery'), opex: T('هزینهٔ عملیاتی', 'Opex'), capex: 'Capex', rate: T('نرخ تنزیل', 'Discount rate') };
      return {
        items: [['NPV ' + tx(T('بعد از مالیات', 'after tax')), fmt(m.npvAfter, 0)], ['NPV ' + tx(T('قبل از مالیات', 'before tax')), fmt(m.npvBefore, 0)],
          ['ROR ' + tx(T('بعد از مالیات', 'after tax')), pct(m.irrAfter, 3)], ['ROR ' + tx(T('قبل از مالیات', 'before tax')), pct(m.irrBefore, 3)],
          [T('شاخص سودآوری PI', 'Profitability index'), fmt(m.pi, 3)], [T('بازگشت ساده (بعد از مالیات)', 'Payback (after tax)'), yrs(m.paybackAfter)],
          [T('بازگشت تنزیل‌شده', 'Discounted payback'), yrs(m.discPaybackAfter)]],
        tables: [
          { title: T('جریان نقدی سالانه', 'Annual cash flow'), cols: [T('سال', 'Year'), T('درآمد', 'Revenue'), T('حق‌الامتیاز', 'Royalty'), T('هزینه', 'Opex'), T('استهلاک', 'Dep.'), T('مالیات', 'Tax'), 'ATCF'],
            rows: [[0, '', '', '', '', '', fmt(m.atcf[0], 0)]].concat(m.rows.map((r, k) => [r.year, fmt(r.revenue, 0), fmt(r.royalty, 0), fmt(r.opex, 0), fmt(r.dep, 0), fmt(r.tax, 0), fmt(r.atcf, 0)])) },
          { title: T('حساسیت NPV بعد از مالیات به تغییر متغیرها', 'After-tax NPV sensitivity'), cols: [T('متغیر', 'Variable'), '−20%', '−10%', '0', '+10%', '+20%'],
            rows: sens.map((s) => [tx(names[s.id]), ...s.values.map((x) => fmt(x, 0))]) }],
        notes: [T('ارزش اسقاط و سرمایهٔ در گردش در سال آخر وارد جریان نقدی می‌شوند. مالیات فقط برای درآمد مشمول مثبت محاسبه می‌شود.', 'Salvage and working capital return in the final year. Tax is charged on positive taxable income only.')],
      };
    },
  });

  /* ---------- UI strings ---------- */
  const UI = {
    title: T('محاسبات اقتصاد معدن', 'Mining Economics'), sub: T('ماشین‌حساب مهندسی اقتصاد معدن', 'Engineering economics calculator'),
    back: T('بازگشت', 'Back'), fill: T('ورودی‌ها را کامل و معتبر وارد کنید.', 'Enter complete, valid inputs.'),
    reset: T('بازنشانی', 'Reset'), result: T('نتایج', 'Results'), lang: T('EN', 'فا'),
    foot: T('نتایج برآورد مهندسی هستند؛ پیش از تصمیم‌گیری مالی با منابع درسی/استاد تطبیق دهید.', 'Results are engineering estimates; verify against your course references before decisions.'),
  };

  /* ---------- rendering ---------- */
  const app = document.getElementById('app');
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => { if (k === 'class') n.className = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v); });
    kids.flat().forEach((c) => { if (c !== null && c !== undefined) n.append(c.nodeType ? c : document.createTextNode(c)); });
    return n;
  };

  function applyLang() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
    document.title = tx(UI.title);
  }

  function renderHome() {
    shown = ''; location.hash = '';
    app.replaceChildren(
      el('header', { class: 'top' }, el('div', {}, el('h1', {}, tx(UI.title)), el('p', {}, tx(UI.sub))),
        el('button', { class: 'chip', onclick: toggleLang }, tx(UI.lang))),
      el('main', { class: 'grid' }, M.map((m) => el('button', { class: 'card', onclick: () => openModule(m.id) },
        el('span', { class: 'badge', dir: 'ltr' }, m.icon), el('strong', {}, tx(m.title)), el('small', {}, tx(m.desc))))),
      el('footer', {}, tx(UI.foot)));
  }

  function toggleLang() {
    lang = lang === 'fa' ? 'en' : 'fa'; safeSet('lang', lang); applyLang();
    const id = location.hash.slice(1);
    if (id && M.find((m) => m.id === id)) openModule(id); else renderHome();
  }

  function loadVals(m) { try { return JSON.parse(safeGet('me:' + m.id) || '{}'); } catch (e) { return {}; } }

  function openModule(id) {
    const m = M.find((x) => x.id === id); shown = id; location.hash = id; window.scrollTo(0, 0);
    const saved = loadVals(m), inputs = {};
    const out = el('section', { class: 'out', 'aria-live': 'polite' });

    const form = el('div', { class: 'form' }, m.fields.map((f) => {
      let inp;
      const dv = saved[f.k] !== undefined ? saved[f.k] : f.d;
      if (f.t === 's') {
        inp = el('select', {}, f.o.map(([val, lab]) => { const o = el('option', { value: val }, tx(lab)); if (String(val) === String(dv)) o.selected = true; return o; }));
      } else if (f.t === 'list' || f.t === 'rows') {
        inp = el('textarea', { rows: f.t === 'rows' ? 5 : 2, dir: 'ltr', inputmode: 'text', spellcheck: 'false' }); inp.value = dv;
      } else {
        inp = el('input', { type: 'text', inputmode: 'decimal', dir: 'ltr', autocomplete: 'off' }); inp.value = dv;
      }
      inp.addEventListener('input', calc); inp.addEventListener('change', calc);
      inputs[f.k] = inp;
      return el('label', { class: 'fld' }, el('span', {}, tx(f.l), f.u ? el('em', { dir: 'ltr' }, ' (' + f.u + ')') : null), inp, f.hint ? el('small', {}, tx(f.hint)) : null);
    }));

    function collect() {
      const v = {}, raw = {};
      for (const f of m.fields) {
        const s = inputs[f.k].value; raw[f.k] = s;
        if (f.t === 's') v[f.k] = s;
        else if (f.t === 'n') v[f.k] = num(s);
        else if (f.t === 'p') v[f.k] = num(s) / 100;
        else if (f.t === 'list') v[f.k] = list(s);
        else v[f.k] = s.split(/\n+/).map((l) => list(l)).filter((r) => r.length);
        if ((f.t === 'n' || f.t === 'p') && !f.opt && !isFinite(v[f.k])) return { v: null, raw };
      }
      return { v, raw };
    }

    function calc() {
      const { v, raw } = collect();
      safeSet('me:' + m.id, JSON.stringify(raw));
      out.replaceChildren();
      if (!v) { out.append(el('p', { class: 'warn' }, tx(UI.fill))); return; }
      let r;
      try { r = m.run(v); } catch (e) { out.append(el('p', { class: 'warn' }, tx(UI.fill))); return; }
      out.append(el('h2', {}, tx(UI.result)));
      if (r.items) out.append(el('dl', { class: 'res' }, r.items.map(([k, val]) => [el('dt', {}, tx(k)), el('dd', { dir: 'ltr' }, val)]).flat()));
      if (r.chart) out.append(drawChart(r.chart));
      (r.tables || []).forEach((t) => {
        if (t.title) out.append(el('h3', {}, tx(t.title)));
        out.append(el('div', { class: 'tbl' }, el('table', { dir: 'ltr' }, el('thead', {}, el('tr', {}, t.cols.map((c) => el('th', {}, tx(c))))),
          el('tbody', {}, t.rows.map((row) => el('tr', {}, row.map((c) => el('td', {}, String(c)))))))));
      });
      (r.notes || []).forEach((n) => out.append(el('p', { class: 'note' }, tx(n))));
    }

    app.replaceChildren(
      el('header', { class: 'top' }, el('button', { class: 'chip', onclick: renderHome }, '← ' + tx(UI.back)), el('button', { class: 'chip', onclick: toggleLang }, tx(UI.lang))),
      el('main', { class: 'page' }, el('h1', {}, tx(m.title)), el('p', { class: 'desc' }, tx(m.desc)), form,
        el('button', { class: 'ghost', onclick: () => { try { localStorage.removeItem('me:' + m.id); } catch (e) { /* */ } openModule(id); } }, tx(UI.reset)), out));
    calc();
  }

  function drawChart({ xs, ys, xl, yl, xfmt }) {
    const W = 340, H = 200, ml = 46, mr = 10, mt = 10, mb = 30;
    const xmin = xs[0], xmax = xs[xs.length - 1];
    const ymin = Math.min(...ys, 0), ymax = Math.max(...ys, 0), yr = ymax - ymin || 1;
    const X = (x) => ml + ((x - xmin) / (xmax - xmin)) * (W - ml - mr), Y = (y) => mt + (1 - (y - ymin) / yr) * (H - mt - mb);
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'chart'); svg.setAttribute('role', 'img'); svg.setAttribute('dir', 'ltr');
    const add = (tag, a, text) => { const n = document.createElementNS(ns, tag); Object.entries(a).forEach(([k, v]) => n.setAttribute(k, v)); if (text !== undefined) n.textContent = text; svg.append(n); };
    add('line', { x1: ml, x2: W - mr, y1: Y(0), y2: Y(0), class: 'axis' });
    add('line', { x1: ml, x2: ml, y1: mt, y2: H - mb, class: 'axis' });
    add('path', { d: xs.map((x, k) => (k ? 'L' : 'M') + X(x).toFixed(1) + ' ' + Y(ys[k]).toFixed(1)).join(' '), class: 'line', fill: 'none' });
    [0, 0.5, 1].forEach((f) => add('text', { x: X(xmin + f * (xmax - xmin)), y: H - 14, class: 'tick', 'text-anchor': 'middle' }, xfmt(xmin + f * (xmax - xmin))));
    [ymin, ymax].forEach((y) => add('text', { x: ml - 4, y: Y(y) + 3, class: 'tick', 'text-anchor': 'end' }, fmt(y, 0)));
    add('text', { x: W / 2, y: H - 2, class: 'tick', 'text-anchor': 'middle' }, tx(xl) + ' → ' + yl);
    return svg;
  }

  /* ---------- boot ---------- */
  applyLang();
  const startId = location.hash.slice(1);
  if (startId && M.find((m) => m.id === startId)) openModule(startId); else renderHome();
  shown = startId;
  window.addEventListener('hashchange', () => {
    const id = location.hash.slice(1);
    if (id === shown) return;
    shown = id;
    if (id && M.find((m) => m.id === id)) openModule(id); else renderHome();
  });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
