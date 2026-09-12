/* Trading sandbox (investing.html): one timed session with fixed starting
   cash, scored against a persisted personal record. The market model lives
   in market.js and the UI in trading.js; this file only owns the session
   summary and record. Session length comes from the real data itself (see
   sessionDurationMs in market.js) rather than a fixed timer. */
(function () {
  const STARTING_CASH = 10000;

  const el = id => document.getElementById(id);
  const money = n => (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const market = createMarket();
  const account = { cash: STARTING_CASH, holdings: {}, cost: {} };
  const summaryBackdropEl = el('summaryBackdrop');

  const floor = createTradingFloor(el('floor'), {
    market,
    account,
    backLink: { href: 'career.html', label: '← Nest Egg' },
    onEnd: showSummary,
  });

  // Hidden until the session ends; re-shows the summary after it's closed.
  const resultsBtn = floor.addTopbarButton('Results', 'results-btn', () => summaryBackdropEl.classList.add('active'));
  resultsBtn.hidden = true;

  function showSummary({ endValue }) {
    const gain = Math.round((endValue - STARTING_CASH) * 100) / 100;
    const record = loadRecord();
    const result = calcReward(gain, record);

    el('summaryTitle').textContent = result.isNewRecord ? 'New personal record!' : 'Session complete';
    el('recordBadgeWrap').innerHTML = result.isNewRecord ? '<span class="badge-record">&#9733; NEW RECORD</span>' : '';
    el('sumFinal').textContent = money(endValue);
    el('sumGain').textContent = (gain >= 0 ? '+' : '') + money(gain);
    el('sumGain').style.color = gain >= 0 ? 'var(--green)' : 'var(--red)';
    el('sumBest').textContent = money(Math.max(record.bestGain, gain) + STARTING_CASH);
    el('sumImprove').textContent = (result.improvementRatio * 100).toFixed(0) + '%';
    el('sumReward').textContent = result.reward;

    saveRecord({ bestGain: Math.max(record.bestGain, gain), bestValue: Math.max(record.bestValue, endValue), runs: (record.runs || 0) + 1 });
    resultsBtn.hidden = false;
    summaryBackdropEl.classList.add('active');
  }

  el('summaryCloseBtn').addEventListener('click', () => summaryBackdropEl.classList.remove('active'));
  el('playAgainBtn').addEventListener('click', () => location.reload());
  // Capture phase so closing the summary doesn't also close the chart behind it.
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && summaryBackdropEl.classList.contains('active')) { summaryBackdropEl.classList.remove('active'); e.preventDefault(); }
  }, true);

  floor.start();

  // debug hook for manual testing in the console
  window.__game = { market, account, endSession: floor.end };
})();
