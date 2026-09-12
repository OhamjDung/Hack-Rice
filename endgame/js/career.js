/* Nest Egg UI (career.html). Renders the career engine (career-engine.js)
   as screens: start, one card per yearly phase, retirement + leaderboard.
   Holds the only live state: `career` (saved to localStorage after every
   change), `market`, and the trading floor while a session is open.
   Buttons use data-action and are handled by one delegated listener. */
(function () {
  const SAVE_KEY = 'endgame-nestegg-save-v1';
  const BOARD_KEY = 'endgame-nestegg-leaderboard-v1';
  const PHASES = [['paycheck', 'Paycheck'], ['expenses', 'Expenses'], ['invest', 'Invest'], ['trade', 'Trade'], ['review', 'Year end']];

  const el = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const fmt = fmtMoney;
  const signed = n => (n >= 0 ? '+' : '') + fmt(n);
  const pct = n => (n >= 0 ? '+' : '') + (n * 100).toFixed(1) + '%';
  const tone = n => (n >= 0 ? 'up' : 'down');

  const storage = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
    remove(k) { try { localStorage.removeItem(k); } catch { /* storage unavailable */ } },
  };

  let career = null;
  let market = null;
  let floor = null;

  // ---------- persistence ----------
  function save() {
    if (!career || career.phase === 'retired') return;
    career.marketPrices = marketPrices(market);
    storage.set(SAVE_KEY, JSON.stringify(career));
  }
  function loadSave() {
    try {
      const c = JSON.parse(storage.get(SAVE_KEY));
      return c && c.version === 1 && c.cur && c.phase !== 'retired' ? c : null;
    } catch { return null; }
  }
  function loadBoard() {
    try {
      const b = JSON.parse(storage.get(BOARD_KEY));
      return Array.isArray(b) ? b.filter(e => e && Number.isFinite(e.total)) : [];
    } catch { return []; }
  }

  // ---------- shared pieces ----------
  function boardHtml(board, highlightId) {
    if (!board.length) return '<p class="fine">Nobody has retired yet. Be the first on the board.</p>';
    return `<div class="table-scroll"><table class="board">
      <thead><tr><th>#</th><th>Name</th><th>Retired</th><th class="num">Kept</th></tr></thead>
      <tbody>${board.map((e, i) => `<tr class="${e.id === highlightId ? 'me' : ''}">
        <td>${i + 1}</td><td><b>${esc(e.name)}</b><span class="sub">${esc(e.job)}</span></td>
        <td>age ${e.age}</td><td class="num">${fmt(e.total)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function chartHtml(tall) {
    const t = career.timeline;
    if (t.length < 2) return '<div class="nw-chart empty">Finish your first year to see your net worth grow.</div>';
    return `<div class="nw-chart ${tall ? 'tall' : ''}"><svg id="nwChart" viewBox="0 0 900 400" preserveAspectRatio="none" role="img" aria-label="Net worth by age"></svg></div>
      <div class="axis"><span>Age ${t[0].age}</span><span>Peak ${fmt(Math.max(...t.map(p => p.netWorth)))}</span><span>Age ${t[t.length - 1].age}</span></div>`;
  }
  function drawChart() {
    const svg = el('nwChart');
    if (svg) renderChart(svg, career.timeline.map((p, i) => ({ seq: i, price: p.netWorth })), []);
  }

  // ---------- start screen ----------
  function startHtml() {
    const saved = loadSave();
    return `<div class="split">
      <section class="card hero">
        <div class="eyebrow">&#129370; Nest Egg</div>
        <h1>Earn it. Budget it. Grow it. Retire whenever you want.</h1>
        <ol class="loop">
          <li><b>Get paid</b>, after taxes</li>
          <li><b>Write and pay</b> your expenses</li>
          <li><b>Invest what's left</b> in a 401(k), Traditional IRA or Roth IRA, or trade stocks yourself</li>
          <li><b>Retire any year.</b> The leaderboard ranks what you keep after taxes.</li>
        </ol>
        ${saved ? `<div class="callout info continue">
          <div><b>${esc(saved.name)}</b>, ${esc(saved.jobTitle)}, age ${saved.age}<span class="sub">Saved career in progress</span></div>
          <div class="actions tight"><button class="btn ghost small" data-action="abandon">Discard</button><button class="btn primary small" data-action="continue">Continue &rarr;</button></div>
        </div>` : ''}
        <form id="startForm" class="start-form" autocomplete="off">
          <label class="field"><span>Your name</span><input id="nameInput" maxlength="24" placeholder="Alex" required></label>
          <div class="field"><span>Pick your first job</span>
            <div class="jobs">${JOBS.map((j, i) => `<label class="job">
              <input type="radio" name="job" value="${j.id}" ${i === 1 ? 'checked' : ''}>
              <div><b>${j.title}</b><span class="salary">${fmt(j.salary)} a year</span><span class="blurb">${j.blurb}</span></div>
            </label>`).join('')}</div>
          </div>
          <button class="btn primary big" type="submit">Start at age ${CAREER.startAge} &rarr;</button>
        </form>
        <a class="sandbox-link" href="investing.html">Just want to trade? Open the 12-minute trading sandbox &rarr;</a>
      </section>
      <section class="card"><h3>&#127942; Leaderboard</h3>${boardHtml(loadBoard())}</section>
    </div>`;
  }

  // ---------- in-game frame ----------
  function headerHtml() {
    const c = career;
    return `<div class="brand"><span class="logo">&#129370;</span>Nest Egg</div>
      <div class="chips">
        <span class="chip"><b>${esc(c.name)}</b> · ${esc(c.jobTitle)}</span>
        <span class="chip">Age <b>${c.age}</b></span>
        <span class="chip">Salary <b>${fmt(c.salary)}</b></span>
      </div>
      <div class="spacer"></div>
      <div class="metric"><div class="label">Net worth</div><div class="val">${fmt(netWorth(c, market))}</div></div>
      <button class="btn ghost small" data-action="askRetire" ${canRetire(c) ? '' : 'disabled title="Finish this year first"'}>Retire</button>`;
  }

  function stepperHtml() {
    const current = PHASES.findIndex(([id]) => id === career.phase);
    return `<ol class="stepper">${PHASES.map(([id, label], i) =>
      `<li class="step ${i < current ? 'done' : i === current ? 'current' : ''}">${label}</li>`).join('')}</ol>`;
  }

  function accountsHtml() {
    const c = career, a = c.accounts;
    const stocks = holdingsValue(market, c.brokerage.holdings);
    const rows = [
      ['Savings', `${(CAREER.savingsApy * 100).toFixed(1)}% APY`, a.savings],
      ['Brokerage', `${fmt(c.brokerage.cash)} cash · ${fmt(stocks)} stocks`, brokerageValue(c, market)],
      ['401(k)', 'pre-tax · tracks the market', a.k401],
      ['Traditional IRA', 'pre-tax · tracks the market', a.tradIra],
      ['Roth IRA', 'tax-free later · tracks the market', a.roth],
    ];
    if (a.debt > 0) rows.push(['Credit-card debt', `${Math.round(CAREER.debtApr * 100)}% APR`, -a.debt]);
    return `<div class="card">
        <h3>Your accounts</h3>
        ${rows.map(([name, sub, v]) => `<div class="acct ${v < 0 ? 'debt' : ''}"><div>${name}<span class="sub">${sub}</span></div><b>${fmt(v)}</b></div>`).join('')}
        <div class="acct-total"><span>Net worth</span><span>${fmt(netWorth(c, market))}</span></div>
      </div>
      <div class="card"><h3>Net worth by age</h3>${chartHtml(false)}</div>
      <div class="card">
        <h3>Career so far</h3>
        <div class="acct"><div>Employer match earned<span class="sub">free money in your 401(k)</span></div><b>${fmt(c.stats.match)}</b></div>
        <div class="acct"><div>Income tax avoided<span class="sub">from pre-tax contributions</span></div><b>${fmt(c.stats.taxSaved)}</b></div>
        <div class="acct"><div>Trading profit/loss</div><b class="${tone(c.stats.tradingPnl)}">${signed(c.stats.tradingPnl)}</b></div>
      </div>`;
  }

  function eyebrow() { return `<div class="eyebrow">Year ${career.year + 1} · Age ${career.age}</div>`; }

  // ---------- phase: paycheck ----------
  function paycheckHtml() {
    const c = career, cur = c.cur, t = cur.taxes, ev = cur.event;
    let evDetail = '';
    if (ev && ev.cash) evDetail = ev.cash < 0 ? `${fmt(-ev.cash)} comes out of this year's money.` : `${fmt(ev.cash)} added to this year's money.`;
    if (ev && ev.salaryPct) evDetail = `Your pay this year is ${Math.abs(ev.salaryPct * 100).toFixed(0)}% ${ev.salaryPct > 0 ? 'higher' : 'lower'}.`;
    if (ev && ev.raisePct) evDetail = `Your salary is now ${fmt(c.salary)}.`;
    const good = ev && (ev.cash > 0 || ev.salaryPct > 0 || ev.raisePct > 0);
    return `${eyebrow()}
      <h2>Payday</h2>
      <p class="lead">Before your salary reaches you, taxes take their cut.</p>
      ${ev ? `<div class="callout ${good ? 'good' : 'warn'}"><b>Life happened:</b> ${esc(ev.text)} ${evDetail}</div>` : ''}
      ${cur.bumped.length ? `<div class="callout info">Prices rose with inflation. ${esc(cur.bumped.join(', '))} went up to this year's minimum.</div>` : ''}
      <table class="money-table">
        <tr><td>Gross salary</td><td>${fmt(cur.gross)}</td></tr>
        <tr class="minus"><td>Federal income tax <span class="hint">top bracket ${Math.round(t.marginal * 100)}%</span></td><td>-${fmt(t.federal)}</td></tr>
        <tr class="minus"><td>State income tax <span class="hint">flat ${Math.round(TAX.stateRate * 100)}%</span></td><td>-${fmt(t.state)}</td></tr>
        <tr class="minus"><td>Social Security &amp; Medicare <span class="hint">7.65%</span></td><td>-${fmt(t.fica)}</td></tr>
        <tr class="total"><td>Take-home pay</td><td>${fmt(cur.takeHome)}</td></tr>
      </table>
      <p class="fine">That's ${fmt(cur.takeHome / 12)} a month. Income tax only applies to ${fmt(t.taxable)}: your pay minus the ${fmt(t.standardDeduction)} standard deduction. Overall you pay ${(t.total / Math.max(1, cur.gross) * 100).toFixed(1)}% in taxes.</p>
      <div class="actions"><button class="btn primary" data-action="toExpenses">Write this year's expenses &rarr;</button></div>`;
  }

  // ---------- phase: expenses ----------
  function expensesHtml() {
    const c = career;
    return `${eyebrow()}
      <h2>Write &amp; pay your expenses</h2>
      <p class="lead">Monthly costs for the year. Essentials have a minimum; everything else is up to you.</p>
      <div class="expense-head"><span>Expense</span><span>Per month</span><span></span></div>
      ${c.expenses.map((e, i) => `<div class="expense-row">
        <input class="ne-input" data-expense="${i}" data-field="label" value="${esc(e.label)}" maxlength="40" aria-label="Expense name" ${e.essential ? 'readonly tabindex="-1"' : ''}>
        <div class="money-input"><span>$</span><input class="ne-input" type="number" min="0" step="10" inputmode="decimal" data-expense="${i}" data-field="monthly" value="${e.monthly}" aria-label="${esc(e.label)} per month"></div>
        <div class="row-meta">${e.essential ? `min ${fmt(expenseMinimum(c, e))}` : `<button class="icon-btn" data-action="removeExpense" data-index="${i}" aria-label="Remove ${esc(e.label)}">&#10005;</button>`}</div>
      </div>`).join('')}
      <button class="btn ghost small" data-action="addExpense">+ Add an expense</button>
      <div class="summary-box" id="expenseSummary"></div>
      <div class="errors" id="expenseErrors" role="alert"></div>
      <div class="actions"><button class="btn primary" data-action="payExpenses">Pay expenses &rarr;</button></div>`;
  }

  function updateExpenseSummary() {
    const c = career, cur = c.cur;
    const monthly = monthlyExpenses(c), left = leftoverPreview(c);
    el('expenseSummary').innerHTML = `<table class="money-table compact">
      <tr><td>Take-home pay</td><td>${fmt(cur.takeHome)}</td></tr>
      <tr class="minus"><td>Expenses <span class="hint">12 × ${fmt(monthly)}</span></td><td>-${fmt(monthly * 12)}</td></tr>
      ${cur.event && cur.event.cash ? `<tr class="${cur.event.cash < 0 ? 'minus' : 'plus'}"><td>Life event</td><td>${signed(cur.event.cash)}</td></tr>` : ''}
      <tr class="total"><td>Left over</td><td class="${tone(left)}">${fmt(left)}</td></tr>
    </table>
    ${left < 0 ? `<p class="fine warn-text">You're short ${fmt(-left)}. It comes out of savings, then brokerage cash, and anything left goes on a credit card at ${Math.round(CAREER.debtApr * 100)}% interest.</p>` : ''}`;
  }

  // ---------- phase: invest ----------
  function investHtml() {
    const c = career, cur = c.cur, ctx = investContext(c);
    const limits = contributionLimits(c.age, c.year);
    const suggested = suggestedAllocation(c);
    const matchCap = Math.round(c.salary * ACCOUNT_RULES.matchCapPct);
    const accounts = [
      ['k401', '401(k)', 'Pre-tax · employer match', `Taken out before income tax, so it costs you less than it adds. Your employer adds 50 cents per $1 on up to ${fmt(matchCap)} (6% of salary). Taxed when withdrawn; 10% penalty before 59½.`, `Limit ${fmt(limits.k401)}`, true],
      ['tradIra', 'Traditional IRA', 'Pre-tax', 'Lowers this year\'s income tax. Taxed when withdrawn; 10% penalty before 59½.', `Shared IRA limit ${fmt(limits.ira)}`],
      ['roth', 'Roth IRA', 'After-tax · tax-free later', 'No tax break now, but everything it grows into comes out tax-free after 59½.', `Shared IRA limit ${fmt(limits.ira)}`],
      ['brokerage', 'Brokerage account', 'Trade stocks · no limits', 'Pick stocks yourself on the Grapefruit Trading floor. No tax break; 15% tax on gains when you cash out.', 'No limit'],
    ];
    return `${eyebrow()}
      <h2>Put your leftover money to work</h2>
      <p class="lead">Your 401(k) and IRAs follow the whole stock market. The brokerage account is yours to trade.</p>
      ${cur.shortfall ? `<div class="callout warn">Expenses ran ${fmt(cur.shortfall.total)} over your pay.
        ${cur.shortfall.fromSavings ? `${fmt(cur.shortfall.fromSavings)} came from savings. ` : ''}${cur.shortfall.fromBrokerage ? `${fmt(cur.shortfall.fromBrokerage)} came from brokerage cash. ` : ''}${cur.shortfall.toDebt ? `<b>${fmt(cur.shortfall.toDebt)} went on a credit card.</b>` : ''}</div>` : ''}
      <div class="available">
        <div><span>Left over this year</span><b>${fmt(cur.leftover)}</b></div>
        <div><span>Already in savings</span><b>${fmt(c.accounts.savings)}</b></div>
        <div><span>Available to invest</span><b class="up">${fmt(ctx.available)}</b></div>
      </div>
      ${accounts.map(([key, name, tag, text, limit, match]) => `<div class="alloc-row">
        <div><h4>${name} <span class="tag">${tag}</span></h4><p>${text}</p></div>
        <div class="alloc-ctrl">
          <div class="money-input"><span>$</span><input class="ne-input" type="number" min="0" step="100" inputmode="decimal" data-alloc="${key}" value="${suggested[key] || ''}" placeholder="0" aria-label="${name} contribution"></div>
          <div class="quick">${match ? '<button class="btn ghost tiny" data-action="allocMatch">Full match</button>' : ''}<button class="btn ghost tiny" data-action="allocMax" data-field="${key}">Max</button><button class="btn ghost tiny" data-action="allocClear" data-field="${key}">Clear</button></div>
          <div class="limit">${limit}</div>
        </div>
      </div>`).join('')}
      <div class="fine match-hint" id="matchHint"></div>
      <div class="summary-box" id="investSummary"></div>
      <div class="errors" id="investErrors" role="alert"></div>
      <div class="actions"><button class="btn primary" data-action="confirmInvest">Lock in my plan &rarr;</button></div>`;
  }

  function readAlloc() {
    const a = {};
    ALLOC_FIELDS.forEach(f => { const input = document.querySelector(`[data-alloc="${f}"]`); a[f] = input ? Number(input.value) || 0 : 0; });
    return a;
  }
  function setAlloc(field, value) {
    const input = document.querySelector(`[data-alloc="${field}"]`);
    if (input) input.value = value || '';
    updateInvestSummary();
  }

  function updateInvestSummary() {
    const c = career, plan = planAllocation(investContext(c), readAlloc());
    const debtPaid = Math.max(0, Math.min(c.accounts.debt, plan.remaining));
    const fullMatch = employerMatch(c.salary, c.salary * ACCOUNT_RULES.matchCapPct);
    el('investSummary').innerHTML = `<table class="money-table compact">
      <tr><td>You're putting in</td><td>${fmt(plan.contributed)}</td></tr>
      ${plan.taxSaved > 0 ? `<tr class="plus"><td>Income tax you skip <span class="hint">pre-tax accounts</span></td><td>-${fmt(plan.taxSaved)}</td></tr>` : ''}
      <tr class="total"><td>Real cost to you</td><td>${fmt(plan.cashNeeded)}</td></tr>
      ${plan.match > 0 ? `<tr class="plus"><td>Employer match <span class="hint">free money</span></td><td>+${fmt(plan.match)}</td></tr>` : ''}
      ${c.accounts.debt > 0 ? `<tr><td>Pays off credit-card debt</td><td>${fmt(debtPaid)}</td></tr>` : ''}
      <tr><td>Stays in savings</td><td>${fmt(Math.max(0, plan.remaining - debtPaid))}</td></tr>
    </table>`;
    el('investErrors').innerHTML = plan.errors.map(e => `<div>${esc(e)}</div>`).join('');
    el('matchHint').textContent = plan.match < fullMatch - 1 ? `Tip: you're leaving ${fmt(fullMatch - plan.match)} of free employer match on the table.` : '';
    document.querySelector('[data-action="confirmInvest"]').disabled = !plan.ok;
  }

  // ---------- phase: trade ----------
  function tradeHtml() {
    const c = career, cur = c.cur;
    const value = brokerageValue(c, market), stocks = holdingsValue(market, c.brokerage.holdings);
    const next = '<div class="actions"><button class="btn primary" data-action="finishYear">Close out the year &rarr;</button></div>';
    if (cur.tradeUsed) {
      return `${eyebrow()}<h2>Trading's done for this year</h2>
        ${cur.trade ? `<p class="lead">Your session made <b class="${tone(cur.trade.pnl)}">${signed(cur.trade.pnl)}</b>.</p>` : '<p class="lead">You held your positions.</p>'}${next}`;
    }
    if (value <= 0) {
      return `${eyebrow()}<h2>Nothing to trade yet</h2>
        <p class="lead">Your brokerage account is empty. Put money in next year if you want to try picking stocks.</p>${next}`;
    }
    return `${eyebrow()}
      <h2>Trade your brokerage account</h2>
      <p class="lead">You have <b>${fmt(c.brokerage.cash)}</b> in cash and <b>${fmt(stocks)}</b> in stocks. Open the trading floor for a ${CAREER.tradingSessionSec}-second session, or skip and hold.</p>
      <ul class="tips">
        <li>Breaking news moves a whole sector. Part of the move lands instantly; the rest plays out over about 15 seconds.</li>
        <li>Yellow tickers are ETFs: a whole sector in one buy. GRPX is the entire market, the same index your 401(k) and IRAs follow.</li>
        <li>Whatever you still hold when the session ends rides the rest of the year's market move.</li>
      </ul>
      <div class="actions"><button class="btn ghost" data-action="finishYear">Skip, hold my positions</button><button class="btn primary" data-action="openTrading">Open the trading floor &rarr;</button></div>`;
  }

  // ---------- phase: year-end review ----------
  function reviewHtml() {
    const c = career, cur = c.cur, r = cur.review;
    const delta = r.netWorthEnd - r.netWorthStart;
    const atMax = c.age >= CAREER.maxAge;
    return `<div class="eyebrow">Year ${c.year} complete · you're now ${c.age}</div>
      <h2>Year in review</h2>
      ${cur.autoPlayed ? `<div class="callout info">Fast-forwarded ${cur.autoPlayed} year${cur.autoPlayed === 1 ? '' : 's'} using the same expenses and investment plan (no trading). This is the latest year.</div>` : ''}
      <div class="big-number">${fmt(r.netWorthEnd)} <span class="${tone(delta)}">${signed(delta)}</span></div>
      <div class="fine">Net worth this year</div>
      <table class="money-table">
        <tr><td>Stock market <span class="hint">GRPX index</span></td><td class="${tone(r.indexReturn)}">${pct(r.indexReturn)}</td></tr>
        <tr><td>Retirement accounts, market gain</td><td class="${tone(r.retirementGrowth)}">${signed(r.retirementGrowth)}</td></tr>
        ${cur.trade ? `<tr><td>Trading session</td><td class="${tone(cur.trade.pnl)}">${signed(cur.trade.pnl)}</td></tr>` : ''}
        ${r.brokerageMarketMove ? `<tr><td>Brokerage, rest-of-year move</td><td class="${tone(r.brokerageMarketMove)}">${signed(r.brokerageMarketMove)}</td></tr>` : ''}
        ${cur.plan && cur.plan.match ? `<tr class="plus"><td>Employer match</td><td>+${fmt(cur.plan.match)}</td></tr>` : ''}
        <tr class="plus"><td>Savings interest</td><td>+${fmt(r.interest)}</td></tr>
        ${r.debtInterest ? `<tr class="minus"><td>Credit-card interest</td><td>-${fmt(r.debtInterest)}</td></tr>` : ''}
        ${r.debtPaidFromSavings ? `<tr><td>Debt paid from savings</td><td>${fmt(r.debtPaidFromSavings)}</td></tr>` : ''}
        <tr><td>Next year's salary <span class="hint">+${(c.raise * 100).toFixed(1)}% raise</span></td><td>${fmt(r.newSalary)}</td></tr>
      </table>
      <div class="lesson">&#128161; ${esc(r.lesson)}</div>
      <div class="actions">
        ${atMax
          ? `<span class="fine">You've reached ${CAREER.maxAge}. Time to retire.</span><button class="btn primary" data-action="askRetire">Retire &rarr;</button>`
          : `<button class="btn ghost" data-action="askRetire">Retire at ${c.age}</button>
             <button class="btn ghost" data-action="fastForward">Fast-forward ${Math.min(CAREER.fastForwardYears, CAREER.maxAge - c.age)} years</button>
             <button class="btn primary" data-action="nextYear">Start year ${c.year + 1} &rarr;</button>`}
      </div>`;
  }

  // ---------- retired ----------
  function retiredHtml() {
    const c = career, p = c.payout;
    const peak = Math.max(...c.timeline.map(t => t.netWorth));
    return `<div class="split">
      <section class="card">
        <div class="eyebrow">Retired at ${c.age} after ${c.year} year${c.year === 1 ? '' : 's'} as a ${esc(c.jobTitle)}</div>
        <h1>${esc(c.name)} keeps ${fmt(p.total)}</h1>
        <p class="lead">${c.rank <= 10 ? `<b>#${c.rank}</b> on the leaderboard.` : `Rank #${c.rank}. Just outside the top 10.`} That's what's left of ${fmt(p.gross)} after taxes${p.penalties ? ' and penalties' : ''}.</p>
        ${p.early ? `<div class="callout warn">Retiring before 59½ triggered a 10% early-withdrawal penalty on your retirement accounts: <b>${fmt(p.penalties)}</b>.</div>` : ''}
        <div class="table-scroll"><table class="payout">
          <thead><tr><th>Account</th><th class="num">Balance</th><th class="num">Taxes</th><th class="num">Penalty</th><th class="num">You keep</th></tr></thead>
          <tbody>${p.rows.map(r => `<tr><td>${r.label}<span class="note">${esc(r.note)}</span></td><td class="num">${fmt(r.balance)}</td>
            <td class="num">${r.tax ? '-' + fmt(r.tax) : '—'}</td><td class="num">${r.penalty ? '-' + fmt(r.penalty) : '—'}</td><td class="num"><b>${fmt(r.net)}</b></td></tr>`).join('')}</tbody>
          <tfoot><tr><td>Total</td><td class="num">${fmt(p.gross)}</td><td class="num">-${fmt(p.taxes)}</td><td class="num">-${fmt(p.penalties)}</td><td class="num">${fmt(p.total)}</td></tr></tfoot>
        </table></div>
        <div class="highlights">
          <div><span>Employer match earned</span><b>${fmt(c.stats.match)}</b></div>
          <div><span>Income tax avoided</span><b>${fmt(c.stats.taxSaved)}</b></div>
          <div><span>Trading profit/loss</span><b class="${tone(c.stats.tradingPnl)}">${signed(c.stats.tradingPnl)}</b></div>
          <div><span>Peak net worth</span><b>${fmt(peak)}</b></div>
        </div>
        <h3>Net worth by age</h3>
        ${chartHtml(true)}
        <div class="actions"><button class="btn primary" data-action="newCareer">Start a new career &rarr;</button></div>
      </section>
      <section class="card"><h3>&#127942; Leaderboard</h3>${boardHtml(loadBoard(), c.entryId)}</section>
    </div>`;
  }

  // ---------- render ----------
  function render() {
    const header = el('neHeader'), screen = el('screen');
    if (!career) {
      header.hidden = true;
      screen.innerHTML = startHtml();
      return;
    }
    if (career.phase === 'retired') {
      header.hidden = true;
      screen.innerHTML = retiredHtml();
      drawChart();
      return;
    }
    header.hidden = false;
    header.innerHTML = headerHtml();
    const phaseHtml = { paycheck: paycheckHtml, expenses: expensesHtml, invest: investHtml, trade: tradeHtml, review: reviewHtml }[career.phase];
    screen.innerHTML = `<div class="split game">
      <section>${stepperHtml()}<div class="card phase-card" data-phase="${career.phase}">${phaseHtml()}</div></section>
      <aside>${accountsHtml()}</aside>
    </div>`;
    if (career.phase === 'expenses') updateExpenseSummary();
    if (career.phase === 'invest') updateInvestSummary();
    drawChart();
  }

  function go() { save(); render(); window.scrollTo(0, 0); }

  // ---------- trading floor ----------
  function openTrading() {
    const c = career;
    c.cur.tradeUsed = true;
    save();
    const host = el('tradingHost');
    host.hidden = false;
    document.body.classList.add('no-scroll');
    let endBtn = null, backBtn = null;
    floor = createTradingFloor(host, {
      market,
      account: c.brokerage,
      durationMs: CAREER.tradingSessionSec * 1000,
      eventMinMs: CAREER.tradingEventMinMs,
      eventMaxMs: CAREER.tradingEventMaxMs,
      title: `Grapefruit Trading · ${esc(c.name)}'s brokerage`,
      onChange: save,
      onEnd({ startValue, endValue }) {
        recordTradingSession(c, startValue, endValue);
        save();
        floor.closeDetail();
        endBtn.hidden = true;
        backBtn.hidden = false;
        backBtn.focus();
      },
    });
    endBtn = floor.addTopbarButton('End session early', 'topbar-btn', () => floor.end());
    backBtn = floor.addTopbarButton('Session over. Back to Nest Egg →', 'results-btn', closeTrading);
    backBtn.hidden = true;
    floor.start();
  }

  function closeTrading() {
    if (floor) {
      if (floor.isActive()) floor.end();
      floor.destroy();
      floor = null;
    }
    el('tradingHost').hidden = true;
    document.body.classList.remove('no-scroll');
    finishYear(career, market);
    go();
  }

  // ---------- retire ----------
  function askRetire() {
    if (!canRetire(career)) return;
    const p = previewRetirement(career, market);
    el('confirmCard').innerHTML = `<h2>Retire at ${career.age}?</h2>
      <div class="sub">You'll cash out every account and this career ends.</div>
      <div class="summary-grid">
        <div class="item"><div class="label">All balances</div><div class="val">${fmt(p.gross)}</div></div>
        <div class="item"><div class="label">You'd keep</div><div class="val" style="color:var(--green)">${fmt(p.total)}</div></div>
        <div class="item"><div class="label">Taxes</div><div class="val">${fmt(p.taxes)}</div></div>
        <div class="item"><div class="label">Early penalty</div><div class="val" style="color:${p.penalties ? 'var(--red)' : 'inherit'}">${fmt(p.penalties)}</div></div>
      </div>
      ${p.early ? `<p class="fine">You're under 59½, so 401(k) and IRA withdrawals get a 10% penalty. Working until ${CAREER.penaltyFreeAge} avoids it.</p>` : ''}
      <div class="summary-actions"><button class="close-btn" data-action="closeConfirm">Keep working</button><button class="play-again" data-action="retire">Retire now</button></div>`;
    el('confirmModal').classList.add('active');
    el('confirmCard').querySelector('[data-action="closeConfirm"]').focus();
  }

  function closeConfirm() { el('confirmModal').classList.remove('active'); }

  function retire() {
    closeConfirm();
    const payout = retireCareer(career, market);
    if (!payout) return;
    const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: career.name, job: career.jobTitle, age: career.age, total: payout.total, gross: payout.gross, date: new Date().toISOString().slice(0, 10) };
    const { board, rank } = addToLeaderboard(loadBoard(), entry);
    storage.set(BOARD_KEY, JSON.stringify(board));
    career.entryId = entry.id;
    career.rank = rank;
    storage.remove(SAVE_KEY);
    render();
    window.scrollTo(0, 0);
  }

  // ---------- actions ----------
  const actions = {
    continue() { career = loadSave(); if (!career) { render(); return; } market = createMarket(career.marketPrices); go(); },
    abandon() { storage.remove(SAVE_KEY); render(); },
    toExpenses() { career.phase = 'expenses'; go(); },
    addExpense() {
      career.expenses.push({ id: `custom-${Date.now()}`, label: 'New expense', monthly: 0, min: 0, essential: false });
      save(); render();
      const input = document.querySelector(`[data-expense="${career.expenses.length - 1}"][data-field="label"]`);
      if (input) { input.focus(); input.select(); }
    },
    removeExpense(btn) {
      const i = Number(btn.dataset.index);
      if (career.expenses[i] && !career.expenses[i].essential) career.expenses.splice(i, 1);
      save(); render();
    },
    payExpenses() {
      const errors = payExpenses(career);
      if (errors.length) { el('expenseErrors').innerHTML = errors.map(e => `<div>${esc(e)}</div>`).join(''); return; }
      go();
    },
    allocMax(btn) {
      const f = btn.dataset.field, a = readAlloc();
      a[f] = 0;
      setAlloc(f, maxAllocation(investContext(career), a, f));
    },
    allocMatch() {
      const a = readAlloc();
      a.k401 = 0;
      setAlloc('k401', maxAllocation(investContext(career), a, 'k401', Math.ceil(career.salary * ACCOUNT_RULES.matchCapPct)));
    },
    allocClear(btn) { setAlloc(btn.dataset.field, 0); },
    confirmInvest() {
      const plan = investLeftover(career, readAlloc());
      if (!plan.ok) { updateInvestSummary(); return; }
      go();
    },
    openTrading,
    finishYear() { finishYear(career, market); go(); },
    nextYear() { beginYear(career, market); go(); },
    fastForward() {
      let years = 0;
      while (years < CAREER.fastForwardYears && autoYear(career, market)) years++;
      if (years) career.cur.autoPlayed = years;
      go();
    },
    askRetire,
    closeConfirm,
    retire,
    newCareer() { career = null; market = null; render(); window.scrollTo(0, 0); },
  };

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled || !actions[btn.dataset.action]) return;
    e.preventDefault();
    actions[btn.dataset.action](btn);
  });

  document.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.expense !== undefined && career && career.phase === 'expenses') {
      const exp = career.expenses[Number(t.dataset.expense)];
      if (!exp) return;
      if (t.dataset.field === 'label') exp.label = t.value;
      else exp.monthly = t.value === '' ? '' : Number(t.value);
      updateExpenseSummary();
      el('expenseErrors').innerHTML = '';
      save();
    }
    if (t.dataset.alloc !== undefined && career && career.phase === 'invest') updateInvestSummary();
  });

  document.addEventListener('submit', e => {
    if (e.target.id !== 'startForm') return;
    e.preventDefault();
    const name = el('nameInput').value.trim();
    if (!name) { el('nameInput').focus(); return; }
    const job = (e.target.querySelector('input[name="job"]:checked') || {}).value;
    market = createMarket();
    career = newCareer(name, job, market);
    go();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && el('confirmModal').classList.contains('active')) closeConfirm();
  });
  el('confirmModal').addEventListener('click', e => { if (e.target === el('confirmModal')) closeConfirm(); });

  render();

  // debug hook for manual testing in the console
  window.__nestEgg = { get career() { return career; }, get market() { return market; }, get floor() { return floor; }, save, render };
})();
