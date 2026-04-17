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
      goto('teams');
      openTBAModal();
    },
    error(err) { alert('CSV parse error: ' + err.message); }
  });
}

async function loadDefaultCSV() {
  try {
    const response = await fetch('../../../Downloads/TroyDay1Export(in).csv');
    if (!response.ok) throw new Error('File not found at relative path. Attempting fallback...');
    const text = await response.text();
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete(res) {
        rawRows = res.data;
        allTeams = buildAllTeams(rawRows);
        plOrder = allTeams.map(t => t.teamNumber);
        goto('teams');
        openTBAModal();
      }
    });
  } catch (err) {
    alert('Could not auto-load CSV from path. Please use "Choose File" and select "TroyDay1Export(in).csv" from your Downloads.');
  }
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
          goto('teams');
          openTBAModal();
        }
      });
    }
  });
});
