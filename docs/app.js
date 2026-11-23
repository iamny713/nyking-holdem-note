(() => {
  const root = document.getElementById('holdem-preview');
  const form = root.querySelector('form');
  const tbody = root.querySelector('tbody');
  const status = form.querySelector('[role=status]');
  const scope = root.querySelector('[data-scope]');
  const choice = root.querySelector('[data-choice]');
  const choiceLabel = root.querySelector('[data-choice-label]');
  const recordStatus = root.querySelector('[data-record-status]');
  const undo = root.querySelector('.undo');
  const chart = root.querySelector('.chart svg');
  const chartMode = root.querySelector('[data-chart-mode]');
  const pager = root.querySelector('.pager');
  const previous = pager.querySelector('[data-step="-1"]');
  const next = pager.querySelector('[data-step="1"]');
  const pageSize = 5;
  let page = 0;
  const selection = { month: '', venue: '' };
  let deleted;
  let shown;
  const fields = form.elements;
  const newVenueLabel = form.querySelector('[data-new-venue]');
  const newVenueOption = 'new';
  const sampleRows = [
    ['2026-11-21', '성수 포커룸', 50000, 48, 3, 240000],
    ['2026-11-18', '홍대 홀덤펍', 40000, 36, 2, 160000],
    ['2026-11-14', '강남 포커룸', 0, 72, 11, 0, 0, 120000],
    ['2026-11-10', '강남 포커룸', 60000, 58, 1, 280000],
    ['2026-11-09', '성수 포커룸', 30000, 42, 6, 0, 120000],
    ['2026-11-06', '홍대 홀덤펍', 40000, 30, 14, 0],
    ['2026-10-29', '강남 포커룸', 60000, 58, 4, 180000],
    ['2026-10-20', '성수 포커룸', 45000, 40, 16, 0],
  ];
  const money = new Intl.NumberFormat('ko-KR', {
    style: 'currency', currency: 'KRW', maximumFractionDigits: 0,
  });
  const storageKey = 'nyking-holdem-note:v1';
  const demo = new URLSearchParams(location.search).has('demo');
  let rows = demo ? sampleRows : [];
  const venues = new Set(rows.map(row => row[1]));
  const sessionKey = 'nyking-holdem-note:google-session';
  const connectionLabel = root.querySelector('.demo');
  let token = '';
  let busy = false;
  let sheetReady = false;
  const sheetUrl = 'https://sheets.googleapis.com/v4/spreadsheets/1lKynWvfuX9dGxWdPKiVeIk0hiKb2QqHFX5GRQMmEr6Q';
  const dashboard = root.querySelector('[data-dashboard]');
  const sheetMessage = root.querySelector('[data-sheet-status]');
  const load = root.querySelector('[data-sheet-load]');

  function clearGoogleSession() {
    token = '';
    sheetReady = false;
    dashboard.hidden = true;
    connectionLabel.textContent = 'Google Sheets 다시 연결 필요';
    try { sessionStorage.removeItem(sessionKey); } catch {}
  }

  async function sheetRequest(range, method = 'GET', body, query = '') {
    const response = await fetch(sheetUrl + '/values/' + encodeURIComponent(range) + query, {
      method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: body && JSON.stringify(body), signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        clearGoogleSession();
      }
      throw new Error('Google Sheets 요청 실패 (' + response.status + '). 시트 편집 권한과 Google 인증을 확인하세요.');
    }
    return response.json();
  }

  async function refreshSheet() {
    const { values = [] } = await sheetRequest("'기록'!A2:I", 'GET', undefined, '?valueRenderOption=UNFORMATTED_VALUE');
    const imported = [];
    for (const [index, raw] of values.entries()) {
      if (!raw.some(value => value !== '') || raw[8] === '삭제') continue;
      const date = typeof raw[0] === 'number'
        ? new Date(Date.UTC(1899, 11, 30) + Math.floor(raw[0]) * 86400000).toISOString().slice(0, 10)
        : raw[0];
      const numbers = Array.from({ length: 6 }, (_, column) => Number(raw[column + 2] ?? 0));
      const [, entries, place] = numbers;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof raw[1] !== 'string' || !raw[1].trim()
        || numbers.some(number => !Number.isSafeInteger(number) || number < 0) || place < 1 || place > entries) {
        throw new Error('기록 탭 ' + (index + 2) + '행의 날짜, 금액 또는 등수 형식을 확인하세요.');
      }
      const row = [date, raw[1], ...numbers];
      row.sheetRow = index + 2;
      row.raw = raw.slice(0, 8);
      imported.push(row);
    }
    rows = imported.sort((a, b) => b[0].localeCompare(a[0]));
    venues.clear();
    rows.forEach(row => venues.add(row[1]));
    renderVenueOptions();
    sheetReady = true;
    dashboard.hidden = false;
    render();
  }

  async function mutateSheet(write) {
    if (!sheetReady || busy) return false;
    busy = true;
    load.disabled = true;
    dashboard.inert = true;
    let written = false;
    try {
      await write();
      written = true;
      await refreshSheet();
      sheetMessage.textContent = 'Google 스프레드시트에 저장했습니다.';
      return true;
    } catch (error) {
      sheetReady = false;
      dashboard.hidden = true;
      sheetMessage.textContent = (written ? '시트에 저장했지만 ' : '') + error.message + ' 다시 불러와 기록을 확인하세요.';
      return false;
    } finally {
      busy = false;
      load.disabled = false;
      dashboard.inert = false;
    }
  }

  async function setDeleted(row, remove) {
    const range = "'기록'!A" + row.sheetRow + ':I' + row.sheetRow;
    const { values } = await sheetRequest(range, 'GET', undefined, '?valueRenderOption=UNFORMATTED_VALUE');
    const current = values?.[0] ?? [];
    if (JSON.stringify(current.slice(0, 8)) !== JSON.stringify(row.raw) || (current[8] === '삭제') === remove) {
      throw new Error('시트에서 해당 기록이 변경되었습니다.');
    }
    await sheetRequest("'기록'!I" + row.sheetRow, 'PUT', { values: [[remove ? '삭제' : '']] }, '?valueInputOption=RAW');
  }
  const isInMoney = row => row[5] > 0 || (row[6] ?? 0) > 0;

  function syncVenueInput() {
    const direct = fields.venueChoice.value === newVenueOption;
    newVenueLabel.hidden = !direct;
    fields.venue.disabled = !direct;
    fields.venue.required = direct;
  }

  function renderVenueOptions(selected = '') {
    const options = [...venues].sort((a, b) => a.localeCompare(b, 'ko'))
      .map(name => new Option(name, 'venue:' + name));
    const placeholder = new Option('홀덤펍을 선택하세요', '', true);
    placeholder.disabled = true;
    fields.venueChoice.replaceChildren(placeholder, ...options, new Option('+ 직접 입력', newVenueOption));
    fields.venueChoice.value = selected ? 'venue:' + selected : '';
    syncVenueInput();
  }

  const percent = new Intl.NumberFormat('ko-KR', { style: 'percent', maximumFractionDigits: 1 });
  const signedMoney = amount => (amount > 0 ? '+' : '') + money.format(amount);

  function group(row) {
    return scope.value === 'month' ? row[0].slice(0, 7) : row[1];
  }

  function drawChart() {
    const width = Math.max(200, chart.clientWidth);
    const height = 155;
    chart.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    chart.replaceChildren();
    function add(tag, attributes, content = '') {
      const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
      Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
      element.textContent = content;
      chart.append(element);
      return element;
    }

    const daily = new Map();
    for (const [date, , cost, , , award, ticketWon = 0, ticketUsed = 0] of [...shown].reverse()) {
      const ticketNet = chartMode.value === 'ticket' ? ticketWon - ticketUsed : 0;
      daily.set(date, (daily.get(date) ?? 0) + award - cost + ticketNet);
    }
    let net = 0;
    const points = Array.from(daily, ([date, amount]) => {
      net += amount;
      return { date, time: Date.parse(date), net };
    });
    add('desc', { id: 'hn-chart-desc' }, points.length ? '최종 누적 순손익 ' + money.format(net) : '기록 없음');
    if (!points.length) {
      add('text', { x: width / 2, y: 80, 'text-anchor': 'middle' }, '표시할 경기 기록이 없습니다.');
      return;
    }
    const values = points.map(point => point.net);
    const low = Math.min(0, ...values);
    const high = Math.max(0, ...values);
    const left = 103;
    const right = width - 34;
    const range = points.at(-1).time - points[0].time;
    const x = point => range ? left + (right - left) * (point.time - points[0].time) / range : (left + right) / 2;
    const y = amount => low === high ? 65 : 12 + 108 * (high - amount) / (high - low);
    const ticks = new Set([high, 0, low].filter(amount => amount === 0 || Math.abs(y(amount) - y(0)) >= 15));
    for (const amount of ticks) {
      add('line', { x1: left, x2: right, y1: y(amount), y2: y(amount), class: 'guide' });
      add('text', { x: left - 7, y: y(amount) + 4, 'text-anchor': 'end' }, money.format(amount));
    }
    add('polyline', {
      points: points.map(point => x(point) + ',' + y(point.net)).join(' '),
      fill: 'none', stroke: 'currentColor', 'stroke-width': 2.5,
    });
    for (const point of points) {
      add('circle', {
        cx: x(point), cy: y(point.net), r: 4, fill: 'currentColor',
        'data-tooltip': point.date + ' · ' + money.format(point.net),
      });
    }
    const labels = points.length === 1 ? points : [points[0], points.at(-1)];
    for (const point of labels) {
      add('text', { x: x(point), y: 145, 'text-anchor': 'middle' }, point.date.slice(5).replace('-', '.'));
    }
  }

  function render() {
    const filtered = scope.value !== 'all';
    choiceLabel.hidden = !filtered;
    if (filtered) {
      choiceLabel.querySelector('span').textContent = scope.value === 'month' ? '조회 월' : '홀덤펍';
      const options = [...new Set(rows.map(group))].sort((a, b) =>
        scope.value === 'month' ? b.localeCompare(a) : a.localeCompare(b, 'ko'));
      const selected = selection[scope.value] || options[0];
      if (selected && !options.includes(selected)) options.push(selected);
      choice.replaceChildren(...options.map(value => new Option(value, value)));
      choice.value = selected ?? '';
      selection[scope.value] = choice.value;
      choice.disabled = !options.length;
    }
    shown = filtered ? rows.filter(row => group(row) === choice.value) : rows;
    const buyin = shown.reduce((sum, row) => sum + row[2], 0);
    const prize = shown.reduce((sum, row) => sum + row[5], 0);
    const net = prize - buyin;
    const tickets = shown.reduce((sum, row) => sum + (row[6] ?? 0), 0);
    const ticketSpend = shown.reduce((sum, row) => sum + (row[7] ?? 0), 0);
    const rankSum = shown.reduce((sum, row) => sum + row[4] / row[3], 0);
    const itm = shown.filter(isInMoney).length;
    root.querySelector('[data-itm-count]').textContent = shown.length ? itm + ' / ' + shown.length + '경기' : '';
    const values = {
      games: shown.length + '회',
      buyin: money.format(buyin),
      prize: money.format(prize),
      net: signedMoney(net),
      tickets: money.format(tickets),
      adjusted: signedMoney(net + tickets - ticketSpend),
      recovery: buyin > 0 ? percent.format(prize / buyin) : '—',
      rank: shown.length ? '상위 ' + percent.format(rankSum / shown.length) : '—',
      itm: shown.length ? percent.format(itm / shown.length) : '—',
    };
    for (const [key, value] of Object.entries(values)) {
      const metric = root.querySelector('[data-metric="' + key + '"]');
      metric.textContent = value;
      if (key === 'net') metric.className = net > 0 ? 'up' : net < 0 ? 'down' : '';
    }
    renderPage();
    drawChart();
  }

  function renderPage() {
    const pages = Math.max(1, Math.ceil(shown.length / pageSize));
    page = Math.min(page, pages - 1);
    pager.hidden = pages < 2;
    previous.disabled = page === 0;
    next.disabled = page === pages - 1;
    const start = page * pageSize;
    pager.querySelector('output').textContent =
      (start + 1) + '–' + Math.min(start + pageSize, shown.length) + ' / ' + shown.length + '건';
    tbody.replaceChildren();
    if (!shown.length) {
      const cell = tbody.insertRow().insertCell();
      cell.colSpan = 7;
      cell.textContent = '이 구분에 해당하는 경기 기록이 없습니다.';
    }
    for (const row of shown.slice(start, start + pageSize)) {
      const [date, venue, cost, entries, place, award, ticketWon = 0, ticketUsed = 0] = row;
      const tr = tbody.insertRow();
      for (const value of [date.slice(5).replace('-', '.'), venue, money.format(cost),
        entries, place + '위', money.format(award)]) {
        tr.insertCell().textContent = value;
      }
      if (isInMoney(row)) {
        tr.classList.add('in-money');
        const itm = document.createElement('span');
        itm.className = 'itm-label';
        itm.textContent = '인머니';
        tr.cells[5].append(itm);
      }
      if (place >= 1 && place <= 3) {
        const medal = document.createElement('span');
        medal.className = 'medal medal-' + place;
        medal.textContent = place === 1 ? '1위 우승' : place + '위';
        tr.cells[4].replaceChildren(medal);
      }
      for (const [index, amount] of [[2, ticketUsed], [5, ticketWon]]) {
        if (!amount) continue;
        const detail = document.createElement('span');
        detail.className = 'reward-detail';
        detail.textContent = '티켓 ' + money.format(amount);
        tr.cells[index].append(detail);
      }
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'quiet';
      remove.textContent = '삭제';
      remove.setAttribute('aria-label', date + ' ' + venue + ' 경기 기록 삭제');
      remove.addEventListener('click', async () => {
        const index = rows.indexOf(row);
        if (demo) {
          rows.splice(index, 1);
          render();
        } else if (!await mutateSheet(() => setDeleted(row, true))) return;
        deleted = { row, index };
        recordStatus.textContent = date + ' ' + venue + ' 기록을 삭제했습니다.';
        undo.hidden = false;
        undo.focus();
      });
      tr.insertCell().append(remove);
    }
  }

  for (const button of [previous, next]) {
    button.addEventListener('click', () => {
      page += Number(button.dataset.step);
      renderPage();
      if (button.disabled) (button === previous ? next : previous).focus();
    });
  }
  chartMode.addEventListener('change', drawChart);
  undo.addEventListener('click', async () => {
    if (!deleted) return;
    if (demo) rows.splice(deleted.index, 0, deleted.row);
    else if (!await mutateSheet(() => setDeleted(deleted.row, false))) return;
    deleted = undefined;
    rows.sort((a, b) => b[0].localeCompare(a[0]));
    render();
    recordStatus.textContent = '삭제한 경기 기록을 복원했습니다.';
    undo.hidden = true;
    scope.focus();
  });
  scope.addEventListener('change', () => {
    page = 0;
    render();
  });
  choice.addEventListener('change', () => {
    selection[scope.value] = choice.value;
    page = 0;
    render();
  });
  new ResizeObserver(drawChart).observe(chart);
  fields.entries.addEventListener('input', () => {
    if (fields.entries.value) fields.place.max = fields.entries.value;
    else fields.place.removeAttribute('max');
  });
  fields.venueChoice.addEventListener('change', () => {
    syncVenueInput();
    if (!fields.venue.disabled) fields.venue.focus();
  });
  fields.venue.addEventListener('input', () => fields.venue.setCustomValidity(''));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const venue = fields.venueChoice.value === newVenueOption
      ? fields.venue.value.trim()
      : fields.venueChoice.value.slice('venue:'.length);
    if (!venue) {
      fields.venue.setCustomValidity('홀덤펍 이름을 입력하세요.');
      fields.venue.reportValidity();
      return;
    }
    const date = fields.date.value;
    const row = [date, venue, fields.buyin.valueAsNumber, fields.entries.valueAsNumber,
      fields.place.valueAsNumber, fields.prize.valueAsNumber,
      Number(fields.ticketWon.value), Number(fields.ticketUsed.value)];
    page = 0;
    if (demo) {
      rows.unshift(row);
      rows.sort((a, b) => b[0].localeCompare(a[0]));
      venues.add(venue);
    } else if (!await mutateSheet(async () => {
      const response = await fetch(sheetUrl + "/values/" + encodeURIComponent("'기록'!A:H") + ":append?valueInputOption=RAW&insertDataOption=INSERT_ROWS", {
        method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [row] }), signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) clearGoogleSession();
        throw new Error('시트에 기록을 추가하지 못했습니다 (' + response.status + ').');
      }
    })) return;
    if (scope.value !== 'all') selection[scope.value] = group(row);
    render();
    form.reset();
    renderVenueOptions(venue);
    fields.date.value = date;
    fields.place.removeAttribute('max');
    status.textContent = venue + ' 경기 기록을 추가했습니다.';
  });
  if (!demo) {
    const panel = root.querySelector('[data-sheet-panel]');
    const input = root.querySelector('[data-sheet-client]');
    const message = sheetMessage;
    const clientKey = 'nyking-holdem-note:google-client';
    let googleScript;
    try { input.value = localStorage.getItem(clientKey) || ''; } catch {}
    panel.hidden = false;
    panel.open = true;
    dashboard.hidden = true;

    const validClientId = value => /^[a-zA-Z0-9-]+\.apps\.googleusercontent\.com$/.test(value);

    function rememberClientId() {
      const clientId = input.value.trim();
      if (validClientId(clientId)) {
        try { localStorage.setItem(clientKey, clientId); } catch {}
      }
    }

    input.addEventListener('input', rememberClientId);

    async function showConnectedSheet() {
      await refreshSheet();
      message.textContent = '시트 기록 ' + rows.length + '건을 불러왔습니다.';
      connectionLabel.textContent = 'Google Sheets 연결됨';
    }

    async function restoreGoogleSession() {
      let session;
      try { session = JSON.parse(sessionStorage.getItem(sessionKey)); } catch {}
      if (!session) return;
      if (session.clientId !== input.value.trim() || typeof session.token !== 'string'
        || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) {
        clearGoogleSession();
        message.textContent = 'Google 로그인으로 다시 연결하세요.';
        return;
      }
      token = session.token;
      load.disabled = true;
      message.textContent = 'Google Sheets 연결을 복원 중입니다.';
      try {
        await showConnectedSheet();
      } catch (error) {
        message.textContent = error.message;
      } finally {
        load.disabled = false;
      }
    }

    load.addEventListener('click', async () => {
      const clientId = input.value.trim();
      if (!validClientId(clientId)) {
        message.textContent = 'Google Cloud에서 만든 웹 클라이언트 ID를 입력하세요.';
        return;
      }
      rememberClientId();
      load.disabled = true;
      message.textContent = 'Google 인증을 준비 중입니다.';
      try {
        googleScript ??= new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://accounts.google.com/gsi/client';
          script.onload = resolve;
          script.onerror = () => {
            googleScript = undefined;
            script.remove();
            reject(new Error('Google 로그인 스크립트를 불러올 수 없습니다.'));
          };
          document.head.append(script);
        });
        await googleScript;
        const authorization = await new Promise((resolve, reject) => {
          google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: 'https://www.googleapis.com/auth/spreadsheets',
            callback: response => response.access_token ? resolve(response)
              : reject(new Error('Google 인증을 완료하지 못했습니다.')),
            error_callback: () => reject(new Error('Google 로그인 창을 열거나 완료하지 못했습니다.')),
          }).requestAccessToken();
        });
        token = authorization.access_token;
        const expiresAt = Date.now() + Number(authorization.expires_in) * 1000 - 30000;
        if (Number.isFinite(expiresAt) && expiresAt > Date.now()) {
          try { sessionStorage.setItem(sessionKey, JSON.stringify({ clientId, token, expiresAt })); } catch {}
        }
        await showConnectedSheet();
      } catch (error) {
        message.textContent = error.message;
      } finally {
        load.disabled = false;
      }
    });
    void restoreGoogleSession();

    root.querySelector('[data-backup]').hidden = false;
    root.querySelector('[data-export]').addEventListener('click', () => {
      let saved;
      try { saved = JSON.parse(localStorage.getItem(storageKey)); } catch {}
      if (!Array.isArray(saved?.rows)) {
        sheetMessage.textContent = '이 브라우저에 백업할 이전 기록이 없습니다.';
        return;
      }
      const data = JSON.stringify({ version: 1, rows: saved.rows, venues: saved.venues ?? [] }, null, 2);
      const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'nyking-holdem-note-backup.json';
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
  fields.date.defaultValue = today;
  fields.date.value = today;
  if (demo) {
    dashboard.hidden = false;
    root.querySelector('.demo').textContent = '예시 데이터';
    root.querySelector('[data-mode-link]').textContent = '내 기록으로';
    root.querySelector('[data-mode-link]').href = './';
  }
  renderVenueOptions();
  render();
})();
