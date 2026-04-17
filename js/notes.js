// Notes tab: per-team qualitative notes editor

function loadTeamNotesFromStorage() {
  try {
    const raw = localStorage.getItem('teamNotes_v1');
    if (raw) teamNotes = JSON.parse(raw);
  } catch (e) { console.error('Failed to load team notes', e); }
}

function saveTeamNotesToStorage() {
  try {
    localStorage.setItem('teamNotes_v1', JSON.stringify(teamNotes));
  } catch (e) { console.error('Failed to save team notes', e); }
}

function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function renderNotes() {
  loadTeamNotesFromStorage();
  const body = document.getElementById('notesList');
  const badge = document.getElementById('notesBadge');
  if (!body || !badge) return;
  const q = (document.getElementById('nSearch')?.value || '').toLowerCase();
  const teams = (allTeams || []).filter(t => !q || String(t.teamNumber).includes(q) || t.teamName.toLowerCase().includes(q));
  teams.sort((a, b) => a.teamNumber - b.teamNumber);
  badge.textContent = teams.length;
  const rows = teams.map(t => {
    const has = teamNotes[t.teamNumber] ? ' •' : '';
    return `<div class="note-row" id="note-row-${t.teamNumber}" onclick="selectNote(${t.teamNumber})" style="padding:8px;border-bottom:1px solid var(--bdr);cursor:pointer;display:flex;justify-content:space-between;align-items:center">
      <div><strong>${t.teamNumber}</strong> ${esc(t.teamName)}</div>
      <div style="font-size:11px;color:var(--mut)">${teamNotes[t.teamNumber] ? 'Saved' : ''}${has}</div>
    </div>`;
  }).join('');
  body.innerHTML = rows || '<div style="padding:12px;color:var(--mut)">No teams</div>';
  // auto-select first item if none selected
  if (!document.querySelector('#notesList .note-row.note-selected') && teams.length) selectNote(teams[0].teamNumber);
}

function selectNote(teamNumber) {
  document.querySelectorAll('#notesList .note-row').forEach(el => { el.classList.remove('note-selected'); el.style.background = ''; });
  const row = document.getElementById('note-row-' + teamNumber);
  if (row) { row.classList.add('note-selected'); row.style.background = 'var(--surf2)'; }
  renderNoteEditor(teamNumber);
}

function renderNoteEditor(teamNumber) {
  const editor = document.getElementById('noteEditor');
  if (!editor) return;
  const t = allTeams.find(x => x.teamNumber === teamNumber) || { teamNumber };
  const noteObj = teamNotes[teamNumber] || { allianceNotes: '', strengths: '', weaknesses: '', general: '' };
  editor.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <h3 style="margin:0">${t.teamNumber}${t.teamName ? ' — ' + esc(t.teamName) : ''}</h3>
      <div>
        <button class="bsm" onclick="saveNote(${teamNumber})">Save</button>
        <button class="bsec" onclick="clearNote(${teamNumber})">Clear</button>
      </div>
    </div>
    <div style="margin-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div style="display:flex;flex-direction:column;gap:8px">
        <label style="font-size:12px;color:var(--mut)">Alliance scouter notes</label>
        <textarea id="note_alliance" style="width:100%;height:120px">${esc(noteObj.allianceNotes)}</textarea>
        <label style="font-size:12px;color:var(--mut)">Strengths (comma separated)</label>
        <input id="note_strengths" style="width:100%" value="${esc(noteObj.strengths)}">
        <label style="font-size:12px;color:var(--mut)">Weaknesses (comma separated)</label>
        <input id="note_weaknesses" style="width:100%" value="${esc(noteObj.weaknesses)}">
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <label style="font-size:12px;color:var(--mut)">General notes</label>
        <textarea id="note_general" style="width:100%;height:240px">${esc(noteObj.general)}</textarea>
      </div>
    </div>
    <div style="margin-top:8px;display:flex;gap:8px;align-items:center">
      <input type="file" id="notesImport" style="display:none" accept=".json" onchange="importNotes(event)">
      <button class="bsec" onclick="document.getElementById('notesImport').click()">Import JSON</button>
      <button class="bsec" onclick="exportNotes()">Export JSON</button>
      <span id="notesStatus" style="margin-left:8px;color:var(--mut)"></span>
    </div>
  `;
}

function saveNote(teamNumber) {
  const allianceNotes = document.getElementById('note_alliance')?.value || '';
  const strengths = document.getElementById('note_strengths')?.value || '';
  const weaknesses = document.getElementById('note_weaknesses')?.value || '';
  const general = document.getElementById('note_general')?.value || '';
  teamNotes[teamNumber] = { allianceNotes, strengths, weaknesses, general, updatedAt: Date.now() };
  saveTeamNotesToStorage();
  const status = document.getElementById('notesStatus');
  if (status) { status.textContent = 'Saved'; setTimeout(() => { if (status) status.textContent = ''; }, 1500); }
  renderNotes();
}

function clearNote(teamNumber) {
  if (teamNotes[teamNumber]) delete teamNotes[teamNumber];
  saveTeamNotesToStorage();
  renderNotes();
  renderNoteEditor(teamNumber);
}

function exportNotes() {
  const data = JSON.stringify(teamNotes, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'team-notes.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importNotes(e) {
  const f = e?.target?.files?.[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const parsed = JSON.parse(r.result);
      if (typeof parsed === 'object' && parsed !== null) {
        // merge
        Object.keys(parsed).forEach(k => { teamNotes[k] = parsed[k]; });
        saveTeamNotesToStorage();
        renderNotes();
        const status = document.getElementById('notesStatus');
        if (status) { status.textContent = 'Imported'; setTimeout(() => { if (status) status.textContent = ''; }, 1500); }
      }
    } catch (err) { console.error('Invalid notes JSON', err); }
  };
  r.readAsText(f);
}

// ensure notes are loaded when script loads
loadTeamNotesFromStorage();
*** End Patch