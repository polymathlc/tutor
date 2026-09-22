/* Study Buddy's learning adventure. All account data enters through render();
   this view never awards XP or invents leaderboard participants. */
(function () {
  'use strict';
  const COMPANIONS = {
    orbit: { name: 'Orbit', level: 1, emoji: '🤖', title: 'Your curious co-pilot', note: 'Every great discovery starts with a little curiosity.', colour: 'mint' },
    pip: { name: 'Pip', level: 3, emoji: '🦊', title: 'Your courageous explorer', note: 'A tricky question? Sounds like an adventure.', colour: 'peach' },
    nova: { name: 'Nova', level: 5, emoji: '🦉', title: 'Your thoughtful guide', note: 'Take your time. You are growing wiser every day.', colour: 'lilac' }
  };
  const BADGES = {
    first_steps: ['First steps', 'Your first completed practice', 'footsteps'],
    first_practice: ['First steps', 'Your first completed practice', 'footsteps'],
    first_worksheet: ['First chapter', 'Your first completed worksheet', 'book'],
    comeback: ['Comeback kid', 'You revisited a mistake and made progress', 'spark'],
    first_correction: ['Comeback kid', 'You corrected a mistake', 'spark'],
    curious_mind: ['Curious mind', 'Keep asking, keep discovering', 'star'],
    steady_learner: ['Steady explorer', 'You keep showing up', 'flame'],
    three_days: ['Finding your rhythm', 'Studied on three different days', 'flame'],
    seven_days: ['Steady explorer', 'Studied on seven different days', 'flame'],
    ten_practices: ['Practice pioneer', 'Ten practice sessions completed', 'flag'],
    level_3: ['Trailblazer', 'Reached level three', 'flag'],
    level_5: ['Star explorer', 'Reached level five', 'star']
  };
  const PATHS = {
    star: 'm12 3 2.8 5.7 6.3.9-4.6 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z',
    book: 'M12 6c-3-3-7-3-9-2v15c3-1 6-1 9 2m0-15c3-3 7-3 9-2v15c-3-1-6-1-9 2V6',
    flag: 'M5 21V3m0 1c5-4 8 4 14 0v10c-6 4-9-4-14 0',
    arrow: 'M5 12h14m-5-5 5 5-5 5',
    check: 'm5 12 4 4L19 6',
    close: 'm6 6 12 12M18 6 6 18',
    lock: 'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5Zm7 5v2',
    trophy: 'M8 3h8v7a4 4 0 0 1-8 0V3Zm0 2H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 2v6m-4 1h8',
    spark: 'm12 2 2.3 7.7L22 12l-7.7 2.3L12 22l-2.3-7.7L2 12l7.7-2.3Zm7 0v4m-2-2h4',
    flame: 'M12 2c2 6 8 7 8 13a8 8 0 0 1-16 0c0-4 3-7 5-8 0 3 1 4 2 4 2-2 2-5 1-9Zm0 11c3 3 4 5 2 7',
    refresh: 'M20 8a8 8 0 1 0 0 8m0-13v5h-5',
    footsteps: 'M8 3c-3 0-5 7-2 8s5-8 2-8Zm-3 11-1 3 3 1 1-3Zm12-7c-3 0-5 7-2 8s5-8 2-8Zm-3 11-1 3 3 1 1-3',
    clock: 'M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    heart: 'M12 21 3 12C-3 4 7-2 12 6c5-8 15-2 9 6Z'
  };
  let host, callback, state = {}, modal, modalKind, modalOrigin, inertElements = [], previousOverflow = '', toast, toastTimer;
  let idSequence = 0;
  const number = (value) => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
  const format = (value) => number(value).toLocaleString();
  const text = (value, fallback = '') => value == null ? fallback : String(value);
  const companionKey = (key) => Object.hasOwn(COMPANIONS, key) ? key : 'orbit';
  function node(tag, cls, content) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (content != null) el.textContent = text(content);
    return el;
  }
  function icon(name, cls) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.7');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', 'adv-icon' + (cls ? ' ' + cls : ''));
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', PATHS[name] || PATHS.star);
    svg.append(path);
    return svg;
  }
  function button(label, action, cls, symbol) {
    const el = node('button', 'adv-button ' + (cls || ''), label);
    el.type = 'button';
    if (symbol) el.append(icon(symbol));
    el.addEventListener('click', action);
    return el;
  }
  function send(action, payload) {
    if (callback) callback(action, payload || {});
  }
  function image(key, pose, cls) {
    key = companionKey(key);
    const wrap = node('span', 'adv-character ' + (cls || ''));
    const img = node('img');
    img.src = 'assets/companions/' + key + '-' + pose + '.webp';
    img.alt = COMPANIONS[key].name + ', your learning companion';
    img.width = 360; img.height = 360; img.decoding = 'async';
    img.addEventListener('error', () => {
      const fallback = node('span', 'adv-character-fallback', COMPANIONS[key].emoji);
      fallback.setAttribute('role', 'img'); fallback.setAttribute('aria-label', img.alt);
      wrap.replaceChildren(fallback);
    }, { once: true });
    wrap.append(img);
    return wrap;
  }
  function pill(label, symbol, cls) {
    const el = node('span', 'adv-pill ' + (cls || ''));
    if (symbol) el.append(icon(symbol));
    el.append(node('span', '', label));
    return el;
  }
  function progress(current, target, label, cls) {
    current = number(current); target = Math.max(1, number(target));
    const bar = node('div', 'adv-progress ' + (cls || ''));
    bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-label', label);
    bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', text(target));
    bar.setAttribute('aria-valuenow', text(Math.min(current, target)));
    const fill = node('span', 'adv-progress-fill');
    fill.style.width = Math.min(100, current / target * 100) + '%';
    bar.append(fill);
    return bar;
  }
  function profile() { return state.profile || {}; }
  function level() { return Math.max(1, number(profile().level)); }
  function badges() { return Array.isArray(profile().badges) ? profile().badges.filter(badge => typeof badge !== 'object' || badge.earned !== false) : []; }
  function levelInfo() {
    const p = profile(), start = number(p.levelStartXp ?? ((level() - 1) * 200));
    const end = Math.max(start + 1, number(p.nextLevelXp ?? (level() * 200)));
    return { current: number(p.levelProgress ?? (number(p.lifetimeXp) - start)), target: Math.max(1, number(p.levelTarget ?? (end - start))) };
  }
  function hero() {
    const p = profile(), buddy = companionKey(p.companion), info = levelInfo();
    const heroEl = node('section', 'adv-hero');
    heroEl.setAttribute('aria-label', 'Your learning adventure');
    const copy = node('div', 'adv-hero-copy');
    const kicker = node('div', 'adv-eyebrow'); kicker.append(icon('spark'), node('span', '', 'YOUR LEARNING ADVENTURE'));
    copy.append(kicker, node('h1', 'adv-title', 'Little steps.\nBig discoveries.'));
    copy.append(node('p', 'adv-hero-description', 'Hey ' + text(p.alias, 'Explorer') + '! Every question is a chance to grow. Let’s discover what you can do today.'));
    const actions = node('div', 'adv-actions');
    actions.append(button('Let’s practise', () => send('practice'), 'adv-button-primary', 'arrow'), button('My collection', () => openModal('collection'), 'adv-button-white', 'star'));
    copy.append(actions);
    const visual = node('div', 'adv-hero-visual');
    const ring = node('div', 'adv-hero-orbit'); ring.setAttribute('aria-hidden', 'true');
    const starOne = icon('spark', 'adv-spark adv-spark-one'), starTwo = icon('star', 'adv-spark adv-spark-two');
    visual.append(ring, starOne, starTwo, image(buddy, 'welcome', 'adv-hero-character'));
    const speech = node('div', 'adv-speech'); speech.append(node('span', '', COMPANIONS[buddy].name + ' says'), node('strong', '', 'You’ve got this!'));
    visual.append(speech);
    const xp = node('div', 'adv-level-card');
    const levelRow = node('div', 'adv-level-row');
    levelRow.append(pill('Level ' + level(), 'star', 'adv-pill-teal'), node('strong', '', level() >= 5 ? 'Star explorer' : level() >= 3 ? 'Trailblazer' : 'Curious explorer'));
    xp.append(levelRow, progress(info.current, info.target, 'Progress to level ' + (level() + 1)), node('div', 'adv-level-caption', format(Math.min(info.current, info.target)) + ' / ' + format(info.target) + ' XP to level ' + (level() + 1)));
    visual.append(xp);
    heroEl.append(copy, visual);
    const metrics = node('div', 'adv-metrics');
    [['Lifetime XP', p.lifetimeXp, 'spark'], ['XP this week', p.weeklyXp, 'trophy'], ['Study days', p.studyDays, 'flame']].forEach(([label, value, symbol]) => {
      const metric = node('div', 'adv-metric');
      const mark = node('span', 'adv-metric-icon'); mark.append(icon(symbol));
      const words = node('div'); words.append(node('strong', '', format(value)), node('span', '', label));
      metric.append(mark, words); metrics.append(metric);
    });
    heroEl.append(metrics);
    return heroEl;
  }
  function teacherHero() {
    const section = node('section', 'adv-hero adv-teacher-hero'); section.setAttribute('aria-label', 'Your learning community');
    const copy = node('div', 'adv-hero-copy'), kicker = node('div', 'adv-eyebrow');
    kicker.append(icon('spark'), node('span', '', 'YOUR LEARNING COMMUNITY'));
    copy.append(kicker, node('h1', 'adv-title', 'Big discoveries start\nwith encouragement.'), node('p', 'adv-hero-description', 'Give every learner a reason to keep going. Manage weekly league membership from People, then let their curiosity lead the way.'));
    const actions = node('div', 'adv-actions'); actions.append(button('Manage learners', () => send('people'), 'adv-button-primary', 'arrow')); copy.append(actions);
    const visual = node('div', 'adv-hero-visual'), orbit = node('div', 'adv-hero-orbit'); orbit.setAttribute('aria-hidden', 'true');
    const speech = node('div', 'adv-speech'); speech.append(node('span', '', 'A little encouragement'), node('strong', '', 'Goes a long way!'));
    visual.append(orbit, icon('spark', 'adv-spark adv-spark-one'), image('orbit', 'welcome', 'adv-hero-character'), speech);
    section.append(copy, visual); return section;
  }
  function heading(title, eyebrow, action) {
    const wrap = node('div', 'adv-section-heading'), copy = node('div');
    if (eyebrow) copy.append(node('p', 'adv-eyebrow', eyebrow));
    copy.append(node('h2', '', title)); wrap.append(copy);
    if (action) wrap.append(action);
    return wrap;
  }
  function quests() {
    const section = node('section', 'adv-quests');
    section.append(heading('A little progress, every day', 'TODAY’S QUESTS', pill('Fresh goals daily', 'clock', 'adv-pill-muted')));
    const list = node('div', 'adv-quest-grid');
    const items = Array.isArray(state.quests) ? state.quests : [];
    if (!items.length) {
      const empty = node('div', 'adv-empty adv-empty-inline'); empty.append(icon('flag'), node('p', '', state.loading ? 'Getting your quests ready…' : 'Your quests will appear when your adventure is ready.'));
      list.append(empty);
    }
    items.forEach((quest, index) => {
      const current = number(quest.current), target = Math.max(1, number(quest.target)), done = current >= target;
      const card = node('article', 'adv-quest adv-quest-' + (['mint', 'peach', 'lilac'][index % 3]) + (done ? ' is-complete' : ''));
      const top = node('div', 'adv-quest-top');
      const mark = node('span', 'adv-quest-icon'); mark.append(icon(done ? 'check' : ['book', 'spark', 'flag'][index % 3]));
      top.append(mark, pill(done ? 'Complete' : '+' + format(quest.xp) + ' XP', done ? 'check' : 'star', 'adv-quest-reward'));
      card.append(top, node('h3', '', quest.title), node('p', 'adv-quest-description', quest.description));
      const bottom = node('div', 'adv-quest-bottom'); bottom.append(progress(current, target, text(quest.title) + ' progress'), node('span', '', format(Math.min(current, target)) + ' / ' + format(target)));
      card.append(bottom);
      const action = text(quest.action, /mistake|comeback|correct|revisit/i.test(text(quest.id)) ? 'mistakes' : 'practice');
      const cta = button(done ? 'Nicely done!' : (action === 'mistakes' ? 'Revisit a mistake' : 'Let’s go'), () => send(action, { quest: quest.id }), 'adv-quest-link', done ? 'check' : 'arrow');
      cta.disabled = done; card.append(cta); list.append(card);
    });
    section.append(list); return section;
  }
  function leaderboardEntries() {
    return Array.isArray(state.leaderboard?.entries) ? state.leaderboard.entries : [];
  }
  function rankRow(entry, index) {
    const row = node('li', 'adv-rank-row' + (entry.isYou ? ' is-you' : ''));
    const rank = number(entry.rank) || index + 1;
    const frame = text(entry.frame, entry.isYou ? profile().frame : 'none');
    row.append(node('span', 'adv-rank-number', rank <= 3 ? ['①', '②', '③'][rank - 1] : text(rank)), image(entry.companion, 'welcome', 'adv-rank-avatar' + (['sunrise', 'starlight'].includes(frame) ? ' adv-frame-' + frame : '')));
    const name = node('div', 'adv-rank-name'); name.append(node('strong', '', text(entry.alias, 'Explorer')));
    if (entry.isYou) name.append(node('span', 'adv-you-label', 'You'));
    row.append(name, node('strong', 'adv-rank-xp', format(entry.xp) + ' XP'));
    return row;
  }
  function daysRemaining() {
    const raw = state.leaderboard?.weekEndsAt;
    const end = raw?.toDate ? raw.toDate().getTime() : typeof raw === 'number' ? raw : Date.parse(raw);
    if (!Number.isFinite(end)) return 'A fresh adventure each week';
    const days = Math.max(0, Math.ceil((end - Date.now()) / 86400000));
    return days > 1 ? 'Resets in ' + days + ' days' : days === 1 ? 'Resets within 24 hours' : 'A new week is starting';
  }
  function leaguePreview() {
    const section = node('section', 'adv-panel adv-league-preview');
    const title = heading('The weekly league', 'GROW TOGETHER', icon('trophy', 'adv-panel-symbol'));
    section.append(title, node('p', 'adv-panel-description', 'A little friendly motivation. A fresh start every week.'));
    const entries = leaderboardEntries();
    if (entries.length) {
      const list = node('ol', 'adv-rank-list');
      const visible = entries.slice(0, 3), own = entries.find((entry) => entry.isYou);
      if (own && !visible.includes(own)) visible.push(own);
      visible.forEach((entry, index) => list.append(rankRow(entry, index))); section.append(list);
    } else {
      const empty = node('div', 'adv-league-empty');
      empty.append(icon('trophy'), node('strong', '', state.leaderboard?.available === false ? 'Your league is getting ready' : 'Every explorer starts somewhere'), node('p', '', state.leaderboard?.reason || 'Join in with a nickname and celebrate your weekly progress together.'));
      section.append(empty);
    }
    const foot = node('div', 'adv-panel-foot');
    foot.append(node('span', '', daysRemaining()), button('View league', () => openModal('leaderboard'), 'adv-button-text', 'arrow'));
    section.append(foot); return section;
  }
  function rhythm() {
    const section = node('section', 'adv-panel adv-rhythm');
    section.append(heading('Find your rhythm', 'SHOWING UP COUNTS', icon('flame', 'adv-panel-symbol')));
    const count = node('div', 'adv-rhythm-count'); count.append(node('strong', '', format(profile().studyDays)), node('span', '', 'days of discovery'));
    section.append(count, node('p', 'adv-panel-description', 'A few questions today. A little more confidence tomorrow. Every study day counts.'));
    const week = node('div', 'adv-week');
    const dates = Array.isArray(state.activeDays) ? state.activeDays : Array.isArray(profile().activeDays) ? profile().activeDays : [];
    const today = text(state.today, new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
    const now = new Date(today + 'T12:00:00Z');
    const day = now.getUTCDay(), monday = new Date(now); monday.setUTCDate(now.getUTCDate() - ((day + 6) % 7));
    ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach((label, index) => {
      const date = new Date(monday); date.setUTCDate(monday.getUTCDate() + index);
      const iso = date.toISOString().slice(0, 10), active = dates.includes(iso), isToday = iso === today;
      const cell = node('div', 'adv-day' + (active ? ' is-active' : '') + (isToday ? ' is-today' : ''));
      cell.setAttribute('aria-label', date.toLocaleDateString('en', { timeZone: 'UTC', weekday: 'long' }) + ': ' + (active ? 'studied' : isToday ? 'today' : 'no study recorded'));
      cell.append(node('span', '', label));
      const dot = node('span', 'adv-day-dot'); dot.append(active ? icon('check') : node('span', '', isToday ? '•' : '')); cell.append(dot); week.append(cell);
    });
    section.append(week);
    const foot = node('div', 'adv-rhythm-foot'); foot.append(icon('heart'), node('span', '', 'Miss a day? Your progress is always yours.')); section.append(foot);
    return section;
  }
  function render(nextState) {
    state = nextState || {};
    if (!host) return;
    host.classList.add('adv-root');
    host.setAttribute('aria-busy', state.loading ? 'true' : 'false');
    const children = [];
    if (state.error) {
      const alert = node('div', 'adv-notice'); alert.setAttribute('role', 'status');
      alert.append(node('p', '', text(state.error)), button('Try again', () => send('refresh'), 'adv-button-text', 'refresh'));
      children.push(alert);
    }
    if (state.loading && !state.profile) {
      const loading = node('div', 'adv-loading'); loading.setAttribute('role', 'status');
      loading.append(image('orbit', 'thinking', 'adv-loading-character'), node('div', '', 'Getting your adventure ready…')); children.push(loading);
    } else if (state.isTeacher) {
      children.push(teacherHero());
      const divider = node('div', 'adv-section-divider'); divider.append(icon('book'), node('span', '', 'Make room for the next discovery')); children.push(divider);
    } else if (!state.profile) {
      const empty = node('div', 'adv-loading');
      empty.append(image('orbit', 'encourage', 'adv-loading-character'), node('strong', '', 'Your next adventure is waiting'), node('p', '', state.error ? 'You can keep practising while we reconnect your progress.' : 'Complete your profile to start your learning adventure.'));
      empty.append(button('Keep practising', () => send('practice'), 'adv-button-primary', 'arrow')); children.push(empty);
    } else {
      children.push(hero(), quests());
      const bottom = node('div', 'adv-bottom-grid'); bottom.append(leaguePreview(), rhythm()); children.push(bottom);
      const end = node('div', 'adv-section-divider'); end.append(icon('book'), node('span', '', 'Your next chapter starts here')); children.push(end);
    }
    host.replaceChildren(...children);
    if (modal) refreshModal();
  }
  function badgeMeta(badge) {
    const id = typeof badge === 'object' ? badge.id : badge;
    const known = BADGES[id];
    return { name: typeof badge === 'object' && (badge.name || badge.label || badge.title) || known?.[0] || text(id).replace(/[_-]/g, ' '), description: typeof badge === 'object' && badge.description || known?.[1] || 'A milestone on your learning journey', icon: known?.[2] || 'star' };
  }
  function collectionBody() {
    const body = node('div', 'adv-collection');
    body.append(node('p', 'adv-modal-intro', 'A little company for a big adventure. Your companions grow with you.'));
    const grid = node('div', 'adv-companion-grid');
    Object.entries(COMPANIONS).forEach(([key, meta]) => {
      const unlocked = Array.isArray(profile().unlockedCompanions) ? profile().unlockedCompanions.includes(key) : level() >= meta.level, selected = companionKey(profile().companion) === key;
      const card = node('article', 'adv-companion-card adv-quest-' + meta.colour + (selected ? ' is-selected' : '') + (!unlocked ? ' is-locked' : ''));
      card.append(pill(unlocked ? selected ? 'Your companion' : 'Unlocked' : 'Level ' + meta.level, unlocked ? selected ? 'check' : 'star' : 'lock'));
      card.append(image(key, 'welcome'), node('h3', '', meta.name), node('strong', 'adv-companion-title', meta.title), node('p', '', meta.note));
      const choose = button(selected ? 'Adventuring together' : unlocked ? 'Choose ' + meta.name : 'Unlock at level ' + meta.level, () => send('companion', { companion: key }), selected ? 'adv-button-primary' : 'adv-button-white', selected ? 'check' : unlocked ? 'arrow' : 'lock');
      choose.disabled = !unlocked || selected || !!state.saving; card.append(choose); grid.append(card);
    });
    body.append(grid);
    const frames = node('section', 'adv-frames'); frames.append(node('h3', '', 'Make it yours'), node('p', 'adv-modal-intro', 'New avatar frames arrive as you level up.'));
    const frameList = node('div', 'adv-frame-list');
    [['none', 'Classic', 1], ['sunrise', 'Sunrise', 3], ['starlight', 'Starlight', 5]].forEach(([id, label, required]) => {
      const selected = text(profile().frame, 'none') === id, unlocked = Array.isArray(profile().unlockedFrames) ? profile().unlockedFrames.includes(id) : level() >= required;
      const choice = button('', () => send('frame', { frame: id }), 'adv-frame-choice' + (selected ? ' is-selected' : ''));
      choice.setAttribute('aria-pressed', selected ? 'true' : 'false'); choice.disabled = !unlocked || !!state.saving;
      choice.append(image(profile().companion, 'welcome', 'adv-frame-avatar adv-frame-' + id), node('strong', '', label), node('small', '', unlocked ? selected ? 'Selected' : 'Choose frame' : 'Level ' + required)); frameList.append(choice);
    });
    frames.append(frameList); body.append(frames);
    const awards = node('section', 'adv-badge-section'); awards.append(heading('Little wins, well earned', 'YOUR ACHIEVEMENTS', pill(format(badges().length) + ' collected', 'star')));
    if (!badges().length) {
      const empty = node('div', 'adv-badges-empty'); empty.append(icon('star'), node('div', '', 'Your story is just beginning. Practise and revisit mistakes to discover your first achievement.')); awards.append(empty);
    } else {
      const list = node('div', 'adv-badge-grid');
      badges().forEach((badge) => {
        const meta = badgeMeta(badge), card = node('article', 'adv-badge');
        const mark = node('span', 'adv-badge-mark'); mark.append(icon(meta.icon));
        card.append(mark, node('strong', '', meta.name), node('p', '', meta.description)); list.append(card);
      });
      awards.append(list);
    }
    body.append(awards); return body;
  }
  function leaderboardBody() {
    const body = node('div', 'adv-league-body'), board = state.leaderboard || {}, entries = leaderboardEntries();
    const intro = node('div', 'adv-league-intro'); intro.append(pill(board.groupLabel || 'Weekly explorers', 'flag', 'adv-pill-teal'), pill(daysRemaining(), 'clock', 'adv-pill-muted'));
    body.append(intro, node('p', 'adv-modal-intro', 'Celebrate effort, build confidence, and cheer each other on. Your league shows XP earned for this subject after teacher approval. Your personal weekly total includes all subjects. Weekly scores reset; your lifetime progress stays with you.'));
    const settings = node('section', 'adv-league-settings');
    const settingWords = node('div'); settingWords.append(node('h3', '', state.isTeacher ? 'A league for your learners' : 'Join the weekly league'), node('p', '', state.isTeacher ? 'Approve learners in People to give them access to the weekly league.' : 'Your explorer nickname and companion are visible to your league. Joining is optional.'));
    const toggle = button('', () => send('optIn', { optIn: !profile().optIn }), 'adv-switch' + (profile().optIn ? ' is-on' : ''));
    toggle.setAttribute('role', 'switch'); toggle.setAttribute('aria-checked', profile().optIn ? 'true' : 'false'); toggle.setAttribute('aria-label', 'Join the weekly league');
    toggle.disabled = board.available === false || board.approved === false || !!state.saving || !!state.isTeacher;
    toggle.append(node('span')); settings.append(settingWords);
    settings.append(state.isTeacher ? button('Manage learners', () => { closeModal(); send('people'); }, 'adv-button-white', 'arrow') : toggle);
    body.append(settings);
    const identity = node('p', 'adv-league-identity');
    identity.append(node('span', '', 'Your explorer nickname: '), node('strong', '', text(profile().alias, 'Explorer')), node('small', '', 'Made for your adventure. Your full name is never shown in the league.'));
    body.append(identity);
    if (board.available === false) {
      const empty = node('div', 'adv-empty'); empty.append(image('orbit', 'thinking', 'adv-empty-character'), node('h3', '', 'Your league is getting ready'), node('p', '', board.reason || 'Keep learning — your worksheets and tutor are ready whenever you are.')); body.append(empty);
    } else if (!entries.length) {
      const empty = node('div', 'adv-empty'); empty.append(image(profile().companion, 'encourage', 'adv-empty-character'), node('h3', '', 'A fresh page for everyone'), node('p', '', profile().optIn ? 'Complete some practice to get your week started. Your league will appear here as explorers join.' : 'Join the league when you’re ready. You can also enjoy your adventure privately.')); body.append(empty);
    } else {
      const podium = node('div', 'adv-podium');
      entries.slice(0, 3).forEach((entry, index) => {
        const place = node('div', 'adv-podium-place adv-podium-' + index), rank = number(entry.rank) || index + 1;
        place.append(image(entry.companion, 'celebrate'), node('strong', '', text(entry.alias, 'Explorer') + (entry.isYou ? ' (you)' : '')), node('span', '', format(entry.xp) + ' XP'));
        const pedestal = node('div', 'adv-podium-pedestal'); pedestal.append(icon('trophy'), node('strong', '', '#' + rank)); place.append(pedestal); podium.append(place);
      });
      body.append(podium);
      const list = node('ol', 'adv-rank-list adv-rank-list-full'); list.setAttribute('aria-label', 'Weekly rankings'); entries.forEach((entry, index) => list.append(rankRow(entry, index))); body.append(list);
    }
    const foot = node('div', 'adv-league-foot'); foot.append(node('p', '', 'Equal XP shares a rank. Hints are always welcome — asking for help never costs XP.'), button('Refresh', () => send('refresh'), 'adv-button-text', 'refresh')); body.append(foot);
    return body;
  }
  function refreshModal() {
    if (!modal) return;
    const content = modal.querySelector('.adv-modal-content'), active = document.activeElement;
    const restoreFocus = content.contains(active);
    const scroll = content.scrollTop;
    const children = [];
    if (state.error) {
      const notice = node('div', 'adv-notice'); notice.setAttribute('role', 'status');
      notice.append(node('p', '', state.error), button('Try again', () => send('refresh'), 'adv-button-text', 'refresh'));
      children.push(notice);
    }
    children.push(modalKind === 'collection' ? collectionBody() : leaderboardBody());
    content.replaceChildren(...children);
    content.scrollTop = scroll;
    if (restoreFocus) modal.querySelector('.adv-close').focus();
  }
  function modalKeydown(event) {
    if (!modal) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeModal(); return; }
    if (event.key !== 'Tab') return;
    const controls = [...modal.querySelectorAll('button:not(:disabled),input:not(:disabled),[tabindex="0"],a[href]')].filter(el => el.getClientRects().length);
    const first = controls[0], last = controls[controls.length - 1];
    if (!first) { event.preventDefault(); modal.querySelector('.adv-modal').focus(); return; }
    if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
  }
  function openModal(kind) {
    if (!profile() || !state.profile) return;
    if (modal) closeModal();
    modalKind = kind === 'collection' ? 'collection' : 'leaderboard'; modalOrigin = document.activeElement;
    modal = node('div', 'adv-modal-backdrop');
    const dialog = node('section', 'adv-modal'); dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.tabIndex = -1;
    const titleId = 'adv-modal-title-' + (++idSequence); dialog.setAttribute('aria-labelledby', titleId);
    const top = node('div', 'adv-modal-header'), title = node('h2', '', modalKind === 'collection' ? 'Your adventure collection' : 'The weekly league'); title.id = titleId;
    const close = button('', closeModal, 'adv-close', 'close'); close.setAttribute('aria-label', 'Close ' + (modalKind === 'collection' ? 'collection' : 'weekly league'));
    top.append(title, close); dialog.append(top, node('div', 'adv-modal-content')); modal.append(dialog);
    modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
    previousOverflow = document.body.style.overflow;
    [...document.body.children].forEach((el) => { if (!['SCRIPT', 'STYLE', 'LINK'].includes(el.tagName)) { inertElements.push([el, el.inert]); el.inert = true; } });
    document.body.append(modal); document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', modalKeydown, true); refreshModal(); close.focus();
    if (modalKind === 'leaderboard') send('leaderboard');
  }
  function closeModal() {
    if (!modal) return;
    modal.remove(); modal = null; modalKind = null;
    document.removeEventListener('keydown', modalKeydown, true);
    inertElements.forEach(([el, inert]) => { el.inert = inert; }); inertElements = [];
    document.body.style.overflow = previousOverflow;
    if (modalOrigin?.isConnected) modalOrigin.focus();
    else host?.querySelector('button')?.focus();
    modalOrigin = null;
  }
  function celebrate(reward) {
    reward = reward || {};
    clearTimeout(toastTimer); toast?.remove();
    toast = node('div', 'adv-celebration'); toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite'); toast.setAttribute('aria-atomic', 'true');
    toast.append(image(profile().companion, 'celebrate', 'adv-toast-character'));
    const copy = node('div', 'adv-toast-copy');
    copy.append(node('strong', '', reward.message || 'A little wiser. A little stronger.'));
    const detail = [];
    if (number(reward.xp)) detail.push('+' + format(reward.xp) + ' XP');
    if (Array.isArray(reward.badges) && reward.badges.length) detail.push(reward.badges.map(item => badgeMeta(item).name).join(' · '));
    copy.append(node('span', '', detail.join(' · ') || 'Your progress is worth celebrating.')); toast.append(copy);
    const close = button('', () => { clearTimeout(toastTimer); toast?.remove(); toast = null; }, 'adv-toast-close', 'close'); close.setAttribute('aria-label', 'Dismiss celebration'); toast.append(close);
    const confetti = node('div', 'adv-confetti'); confetti.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 12; i++) { const piece = node('i'); piece.style.setProperty('--i', text(i)); confetti.append(piece); }
    toast.append(confetti); document.body.append(toast);
    toastTimer = setTimeout(() => { toast?.remove(); toast = null; }, 6500);
  }
  function destroy() {
    closeModal(); clearTimeout(toastTimer); toast?.remove(); toast = null;
    if (host) { host.replaceChildren(); host.classList.remove('adv-root'); }
    host = null; callback = null; state = {};
  }
  function mount(options) {
    destroy(); options = options || {};
    host = typeof options.homeHost === 'string' ? document.querySelector(options.homeHost) : options.homeHost;
    if (!host) throw new Error('StudyAdventureUI needs a homeHost element.');
    callback = options.onAction; render({ loading: true });
    return window.StudyAdventureUI;
  }
  window.StudyAdventureUI = Object.freeze({ mount, render, celebrate, destroy, open: openModal, close: closeModal });
})();
