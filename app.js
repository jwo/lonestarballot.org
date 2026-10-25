/* Lone Star Ballot — renderer */

(function () {
  'use strict';
  document.documentElement.classList.remove('no-js');

  /* ── Build vote CTAs from CONFIG ── */
  function voteCta() {
    if (!CONFIG.VOTING_OPEN) {
      return '<span class="vote-status">Voting not open yet</span>';
    }
    return '<a class="vote-cta" href="' + escapeHtml(CONFIG.VOTE_URL) + '" target="_blank" rel="noopener">' +
      '<span class="vote-cta__dot" aria-hidden="true"></span>Vote now</a>';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── Data helpers ── */
  var YEARS = Object.keys(BALLOT_DATA || {}).sort(function (a, b) {
    return Number(b) - Number(a);
  });
  var FEATURED = String(CONFIG.CURRENT_YEAR);       // may be a future, no-results year
  var HAS_FEATURED = YEARS.indexOf(FEATURED) !== -1;
  var current = HAS_FEATURED ? FEATURED : (YEARS[0] || FEATURED); // archive focus

  function raceWinnerPct(race) {
    if (race.kind === 'binary') {
      return Math.max(race.yes || 0, race.no || 0);
    }
    var top = 0;
    (race.candidates || []).forEach(function (c) {
      if (c.pct && c.pct > top) top = c.pct;
    });
    return top;
  }

  /* ── Renderers ── */
  function renderCandidateRow(cand, isLeader) {
    var pct = (cand.pct != null) ? cand.pct.toFixed(2) + '%' : '—';
    var badge = '';
    if (cand.write_in) {
      badge = '<span class="cand__badge cand__badge--writein">Write-in</span>';
    } else if (isLeader) {
      badge = '<span class="cand__badge">Leading</span>';
    }
    var bio = '';
    if (cand.bio) {
      bio = '<details class="bio"><summary>Statement</summary><p>' +
        escapeHtml(cand.bio) + '</p></details>';
    }
    var note = cand.note ? '<p class="cand__note">' + escapeHtml(cand.note) + '</p>' : '';
    var width = (cand.pct != null) ? Math.min(cand.pct, 100) : 0;
    return (
      '<div class="cand' + (isLeader ? ' is-leader' : '') + '">' +
        '<div class="cand__topline">' +
          '<span class="cand__name">' + escapeHtml(cand.name) + badge + '</span>' +
          '<span class="cand__pct">' + pct + '</span>' +
        '</div>' +
        '<div class="cand__bar"><div class="cand__barfill" data-w="' + width + '"></div></div>' +
        note + bio +
      '</div>'
    );
  }

  function raceNote(race) {
    return race.note ? '<p class="race__note">' + escapeHtml(race.note) + '</p>' : '';
  }

  function renderRace(race) {
    if (race.kind === 'binary') {
      var candName = race.candidate
        ? '<p class="binrac__candname">' + escapeHtml(race.candidate) + '</p>'
        : '';
      var bio = race.bio
        ? '<details class="bio"><summary>' +
          (race.candidate ? 'Candidate statement' : 'Details') +
          '</summary><p>' + escapeHtml(race.bio) + '</p></details>'
        : '';
      var noteP = raceNote(race);
      var rows = (race.options || []).map(function (opt) {
        var yesish = /^(YES|APPROVED|I ACCEPT)$/i.test(opt.label);
        var w = (opt.pct != null) ? Math.min(opt.pct, 100) : 0;
        return (
          '<div class="binrow ' + (yesish ? 'binrow--yes' : 'binrow--no') + '">' +
            '<div class="binrow__top">' +
              '<span class="binrow__label">' + escapeHtml(opt.label) + '</span>' +
              '<span class="binrow__pct">' +
                (opt.pct != null ? opt.pct.toFixed(2) + '%' : '—') +
              '</span>' +
            '</div>' +
            '<div class="binrow__bar"><div class="binrow__barfill" data-w="' + w + '"></div></div>' +
          '</div>'
        );
      }).join('');
      return (
        '<article class="race">' +
          '<h3 class="race__office">' + escapeHtml(race.office) + '</h3>' +
          noteP + candName +
          '<div class="binrows">' + rows + '</div>' +
          bio +
        '</article>'
      );
    }

    // candidate race
    var leaders = [];
    var top = raceWinnerPct(race);
    var isMulti = (race.candidates || []).filter(function (c) { return !c.write_in; }).length > 1 &&
                  /vote|choose/i.test(race.note || '');
    (race.candidates || []).forEach(function (c) {
      if (c.pct && !isMulti && c.pct === top && !c.write_in) leaders.push(c);
    });
    var isLeaderMap = {};
    leaders.forEach(function (l) { isLeaderMap[l.name] = true; });

    var rows = (race.candidates || []).map(function (cand) {
      return renderCandidateRow(cand, !!isLeaderMap[cand.name]);
    }).join('');

    return (
      '<article class="race">' +
        '<h3 class="race__office">' + escapeHtml(race.office) + '</h3>' +
        raceNote(race) +
        '<div class="rowlist">' + rows + '</div>' +
      '</article>'
    );
  }

  function renderYear(year) {
    var d = BALLOT_DATA[year];
    if (!d || !d.races || !d.races.length) return '';
    var isLatest = YEARS.length > 0 && String(year) === String(YEARS[0]);
    var sub = isLatest ? 'Most recent results' : 'Archived results';
    var inner = d.races.map(renderRace).join('');
    return (
      '<section class="year-section" id="year-' + year + '" data-year="' + year + '">' +
        '<div class="year-section__head">' +
          '<h2 class="year-section__title">' + year + ' Election</h2>' +
          '<p class="year-section__sub">' + sub + '</p>' +
        '</div>' +
        '<hr class="year-section__rule">' +
        inner +
      '</section>'
    );
  }

  /* ── Hero ── */
  function renderHero() {
    var hero = document.getElementById('hero');
    if (!hero) return;

    var statusBand;
    if (CONFIG.VOTING_OPEN) {
      statusBand = '<div class="hero__open-banner"><span class="pulse" aria-hidden="true"></span>Voting is open</div>';
    } else if (HAS_FEATURED) {
      statusBand = '<div class="hero__closed-banner">Voting is closed</div>';
    } else {
      statusBand = '<div class="hero__closed-banner">Voting is not open yet</div>';
    }

    var lede;
    if (!HAS_FEATURED) {
      lede = 'The ' + FEATURED + ' board election has not opened yet. ' +
        'Official results will be posted here once the ballot closes. ' +
        'Past elections are in the archive below.';
    } else {
      lede = 'Official results of the ' + FEATURED + ' board election, with every prior year preserved in the archive below.';
    }

    hero.innerHTML =
      '<p class="hero__eyebrow">' + escapeHtml(CONFIG.ORGANIZATION) + '</p>' +
      '<h2 class="hero__title" id="hero-title">' + FEATURED + ' Board Election</h2>' +
      '<p class="hero__lede">' + lede + '</p>' +
      statusBand;
  }

  /* ── Year tabs ── */
  function renderTabs() {
    var tabs = document.getElementById('year-tabs');
    if (!tabs) return;
    var upcoming = !HAS_FEATURED
      ? '<span class="yearnav__btn yearnav__btn--upcoming" aria-disabled="true">' +
        FEATURED + ' · soon</span>'
      : '';
    tabs.innerHTML = upcoming + YEARS.map(function (y) {
      var active = String(y) === String(current) ? ' is-active' : '';
      return '<a class="yearnav__btn' + active + '" href="#' + y + '" data-year="' + y + '" role="button">' +
        y + '</a>';
    }).join('');
    Array.prototype.forEach.call(tabs.querySelectorAll('.yearnav__btn'), function (b) {
      b.addEventListener('click', function (ev) {
        // handled via hashchange; prevent jump duplicate
        ev.preventDefault();
        selectYear(b.getAttribute('data-year'));
        history.replaceState(null, '', '#' + b.getAttribute('data-year'));
      });
    });
  }

  /* ── Scroll spy: highlight the year currently in view ── */
  function onScroll() {
    var sections = document.querySelectorAll('.year-section');
    var pick = current;
    var mid = window.innerHeight * 0.4;
    Array.prototype.forEach.call(sections, function (s) {
      var r = s.getBoundingClientRect();
      if (r.top <= mid && r.bottom > mid) pick = s.getAttribute('data-year');
    });
    if (pick !== current) {
      current = pick;
      updateTabState();
    }
  }

  function onHash() {
    var h = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (YEARS.indexOf(h) !== -1) {
      current = h;
      renderHero();
      updateTabState();
    }
  }

  function selectYear(y) {
    current = String(y);
    updateTabState();
    renderHero();
    var el = document.getElementById('year-' + y);
    if (el && el.scrollIntoView) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function updateTabState() {
    var tabs = document.getElementById('year-tabs');
    if (!tabs) return;
    Array.prototype.forEach.call(tabs.querySelectorAll('.yearnav__btn'), function (b) {
      var on = String(b.getAttribute('data-year')) === String(current);
      b.classList.toggle('is-active', on);
    });
  }

  function renderAll() {
    renderTabs();
    renderHero();
    var view = document.getElementById('year-view');
    if (!view) return;
    // render the whole archive, newest first
    view.innerHTML = YEARS.map(renderYear).join('');
    animateBars(view);
    var cta = document.getElementById('vote-cta-top');
    if (cta) cta.innerHTML = voteCta();
  }

  function animateBars(root) {
    if (!root) return;
    var bars = root.querySelectorAll('[data-w]');
    // requestAnimationFrame so the width transition runs from 0
    requestAnimationFrame(function () {
      Array.prototype.forEach.call(bars, function (b) {
        b.style.width = b.getAttribute('data-w') + '%';
      });
    });
  }

  /* ── Footer ── */
  function renderFooter() {
    var org = document.getElementById('footer-org');
    var legal = document.getElementById('footer-legal');
    var link = document.getElementById('footer-orglink');
    if (org) org.textContent = CONFIG.ORGANIZATION;
    if (legal) legal.textContent = CONFIG.LEGAL || '';
    if (link && CONFIG.ORG_URL) {
      var a = document.createElement('a');
      a.href = CONFIG.ORG_URL;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = 'Visit the foundation website';
      link.appendChild(a);
    }
  }

  function boot() {
    if (typeof BALLOT_DATA === 'undefined' || typeof CONFIG === 'undefined') {
      console.warn('Ballot data or config missing');
      return;
    }
    // deep link to a year (e.g. #2024), including redirects from old
    // /poll/YYYY/ URLs via 404.html
    var h = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (YEARS.indexOf(h) !== -1) current = h;
    renderFooter();
    renderAll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('hashchange', onHash);
    if (YEARS.indexOf(h) !== -1) {
      onHash();
      var target = document.getElementById('year-' + h);
      if (target) {
        // jump, don't animate — this is a landing position from a redirect
        try {
          target.scrollIntoView({ block: 'start', behavior: 'instant' });
        } catch (e) {
          target.scrollIntoView({ block: 'start' });
        }
      }
    }
    // nudge bars that are now in view once content is laid out
    requestAnimationFrame(onScroll);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
