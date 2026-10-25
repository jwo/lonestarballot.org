#!/usr/bin/env python3
"""Assemble lonestarballot.org results into clean JSON for the new ballot site.

Source pages: raw/YYYY.html (WordPress + TotalPoll results screens).

Two markup generations:
  2020-2024 : each "question" is an office; "choice items" hold the candidate
              name + vote-bar; candidate bios live in
              `totalpoll-question-choices-item-content` (wrapped or bare text).
  2025-2026 : each "question" is "Office – Candidate"; choices are YES/NO votes;
              the bio lives in the question-content paragraphs.

Output shape per year:
  { poll_id, races: [ { kind, office, ...candidates } ] }
"""
import re
import html
import json
import glob
import os

BASE = os.path.dirname(os.path.abspath(__file__))


def raw_text(t):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', t))).strip()


def split_title(title):
    """'President – Ray Stanhope' -> ('President', 'Ray Stanhope')."""
    m = re.match(r'^\s*(.*?)\s*[-–—]\s*(.*?)\s*$', title)
    return (m.group(1).strip(), m.group(2).strip()) if m else (title, None)


def strip_leading_name(text, name):
    if name and text.lower().startswith(name.lower()):
        return text[len(name):].strip()
    return text


FULL_ITEM = r'<div class="totalpoll-question-choices-item totalpoll-question-choices-item-results'


def parse_year(path):
    data = open(path).read()
    pid_m = re.search(r'totalpoll="(\d+)"', data)
    # split into question blocks on the wrapper div
    qblocks = re.split(r'<div class="totalpoll-question"[ >]', data)
    races = []
    for b in qblocks[1:]:
        # question-content paragraphs (bios for 2025/2026)
        cm = re.search(r'totalpoll-question-content[^>]*>(.*?)'
                       r'(?=<div class="totalpoll-question-choices")', b, re.S)
        content_html = cm.group(1) if cm else ''
        cparas = [raw_text(p) for p in re.findall(r'<p[^>]*>(.*?)</p>',
                                                  content_html, re.S)]
        cparas = [p for p in cparas if p]

        # Position title = first strong in question-content
        title = ''
        tm = re.search(r'<strong>(.*?)</strong>', content_html, re.S)
        if tm:
            title = raw_text(tm.group(1))
        # 2025 Q2 has a bare heading (no <strong>); first para is the heading
        if not title and cparas:
            title = cparas[0]

        # --- Choice items: anchored on the full wrapper class ---
        items = []
        for m in re.finditer(FULL_ITEM, b):
            seg = b[m.start():]
            endm = re.search(r'\s*</div>\s*</div>\s*</div>\s*</div>', seg)
            block = seg[: endm.start()] if endm else seg[:6000]
            label = ''
            lm = re.search(r'item-label[^>]*>\s*<span[^>]*>(.*?)</span>',
                           block, re.S)
            if lm:
                label = raw_text(lm.group(1))
            pct = None
            vm = re.search(r'totalpoll-question-choices-item-votes-text'
                           r'[^>]*>\s*([^<]+)<', block, re.S)
            if vm:
                pct = float(re.sub(r'[^\d.]', '', vm.group(1)))
            else:
                bm = re.search(r'votes-bar" style="width:\s*([\d.]+)%', block)
                if bm:
                    pct = float(bm.group(1))
            if label or pct is not None:
                items.append({'label': label, 'pct': pct})

        # --- Candidate bios from item-content blocks ---
        item_bios = []
        for m in re.finditer(r'totalpoll-question-choices-item-content"?\s*>'
                             r'(.*?)(?=<div class="totalpoll-question-choices-item'
                             r'|totalpoll-form|totalpoll-buttons|$)', b, re.S):
            t = raw_text(m.group(1))
            if t:
                item_bios.append(t)

        BINARY_LABELS = {'YES', 'NO', 'APPROVED', 'DENIED',
                         'I ACCEPT', 'I DO NOT ACCEPT'}
        yn = {i['label'] for i in items} & BINARY_LABELS
        is_binary = bool(yn)

        if is_binary:
            office, cand = split_title(title)
            # bio: either the item-content block (some years) or question-content
            bio = ' '.join(p for p in cparas if p.lower() != title.lower())
            if not bio and item_bios:
                bio = ' '.join(item_bios)
            note = ''
            n = re.search(r'[^.]*\bis currently serving[^.]*\.?', bio, re.I)
            if n:
                note = n.group(0).strip()
            if note:
                bio = bio.replace(note, '').strip()
            races.append({'kind': 'binary', 'office': office,
                          'candidate': cand, 'yes': yes_no(items)[0],
                          'no': yes_no(items)[1], 'options': items,
                          'bio': bio, 'note': note})
        else:
            # candidate race; bios from item-content, or from question-content
            # when the questions embed "<strong>Name</strong> bio..." (2026 Trustee)
            candidates = []
            # prefer item-content bios; fall back to <strong>Name</strong>
            # embedded bios (2026 Trustee) for any candidates missing one
            if item_bios:
                bios = list(item_bios)
                embed = embedded_bios(content_html, [i['label'] for i in items])
                while len(bios) < len(items) and embed:
                    bios.append(embed[len(bios)])
            else:
                bios = embedded_bios(content_html, [i['label'] for i in items])
            for i, it in enumerate(items):
                bio = bios[i] if i < len(bios) else ''
                bio = strip_leading_name(bio, it['label'])
                note = ''
                n = re.search(r'[^.]*\bis currently serving[^.]*\.?', bio, re.I)
                if n:
                    note = n.group(0).strip()
                if note:
                    bio = bio.replace(note, '').strip()
                is_writein = it['label'].lower().startswith('write')
                candidates.append({'name': it['label'], 'pct': it['pct'],
                                   'bio': bio, 'note': note,
                                   'write_in': is_writein})
            # A race note is an instruction like "Please vote for 3 choices".
            # Don't let candidate bios (which share the content area in some
            # years) leak into it.
            note = ''
            for p in cparas:
                if p.lower() == title.lower():
                    continue
                if re.search(r'\b(vote|choose|select|pick)\b', p, re.I) and len(p) < 160:
                    note = p
                    break
            races.append({'kind': 'race', 'office': title, 'note': note,
                          'candidates': candidates})
    return {'poll_id': pid_m.group(1) if pid_m else None, 'races': races}


def yes_no(items):
    """Return (yes_pct, no_pct) for the first YES-ish / NO-ish option."""
    yes = no = None
    for i in items:
        if i['label'] in ('YES', 'APPROVED', 'I ACCEPT') and yes is None:
            yes = i['pct']
        elif i['label'] in ('NO', 'DENIED', 'I DO NOT ACCEPT') and no is None:
            no = i['pct']
    return yes, no


def embedded_bios(content_html, names):
    """Split question-content where '<strong>Name</strong> bio...' repeat
    (2026 Trustee). Returns a list aligned to `names` order."""
    if not names:
        return []
    # locate each name as a <strong> header in order
    positions = []
    for nm in names:
        m = re.search(r'<strong>\s*' + re.escape(nm) + r'\s*</strong>',
                      content_html, re.I)
        positions.append(m.start() if m else -1)
    # build slices between consecutive strong headers
    if any(p == -1 for p in positions):
        return []
    arr = list(enumerate(positions))
    arr.sort(key=lambda t: t[1])
    bios = [None] * len(names)
    for k in range(len(arr)):
        idx, pos = arr[k]
        end = arr[k + 1][1] if k + 1 < len(arr) else len(content_html)
        bios[idx] = raw_text(content_html[pos:end])
    return bios


if __name__ == '__main__':
    out = {}
    for path in sorted(glob.glob(os.path.join(BASE, 'raw', '*.html'))):
        y = os.path.basename(path).split('.')[0]
        out[y] = parse_year(path)
    out = {y: out[y] for y in sorted(out)}
    with open(os.path.join(BASE, 'parsed_data.json'), 'w') as f:
        json.dump(out, f, indent=2)

    for y in sorted(out, reverse=True):
        print('=' * 72)
        print(y)
        for r in out[y]['races']:
            if r['kind'] == 'binary':
                opts = ' / '.join(f"{o['label']} {o['pct']}%" for o in r['options'])
                print(f"  [{r['office']} | {r['candidate']}]  {opts}"
                      f"  bio:{len(r['bio'])}  note:{r['note'][:40]!r}")
            else:
                print(f"  [{r['office']}]"
                      + (f"  {r['note'][:40]!r}" if r['note'] else ""))
                for c in r['candidates']:
                    print(f"      {c['name']:22s} {c['pct']:.2f}%"
                          f"  bio:{len(c['bio'])}  note:{c['note'][:44]!r}"
                          + ("  (write-in)" if c['write_in'] else ""))
