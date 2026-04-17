// CSV import and dropzone handling
function handleCSV(e) {
  const file = e.target ? e.target.files[0] : e;
  if (!file) return;
  if (e.target) e.target.value = '';
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete(res) {
      rawRows = res.data;
      allTeams = buildAllTeams(rawRows);
      plOrder = allTeams.map(t => t.teamNumber);
      if (typeof recomputeScheduleCache === 'function') recomputeScheduleCache();
      goto('teams');
      openTBAModal();
    },
    error(err) { alert('CSV parse error: ' + err.message); }
  });
}

window.addEventListener('DOMContentLoaded', () => {
  const dz = document.getElementById('dz');
  if (!dz) return;
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', e => {
    e.preventDefault();
    dz.classList.remove('over');
    const f = e.dataTransfer.files[0];
    if (f) {
      Papa.parse(f, {
        header: true,
        skipEmptyLines: true,
        complete(res) {
          rawRows = res.data;
          allTeams = buildAllTeams(rawRows);
          plOrder = allTeams.map(t => t.teamNumber);
            if (typeof recomputeScheduleCache === 'function') recomputeScheduleCache();
          goto('teams');
          openTBAModal();
        }
      });
    }
  });
});
