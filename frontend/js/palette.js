'use strict';

/* Ctrl+K command palette: type-ahead access to every workspace, lab, and tool. */

let paletteSelection = 0;

function getPaletteCommands() {
  const commands = [
    { label: 'Go to Training mode', hint: 'workspace', run: () => setWorkspaceMode('training', { openFleet: false }) },
    { label: 'Go to Incident mode', hint: 'workspace', run: () => setWorkspaceMode('incident') },
    { label: 'Go to Fleet mode', hint: 'workspace', run: () => setWorkspaceMode('fleet') },
    { label: 'Open start menu', hint: 'navigate', run: () => showLandingHub() },
    { label: 'Open study path', hint: 'learn', run: () => switchLearnTab('study') },
    { label: 'Take practice quiz', hint: 'learn', run: () => switchLearnTab('quiz') },
    { label: 'Open lab intro', hint: 'learn', run: () => switchLearnTab('intro') },
    { label: 'Open fleet dashboard', hint: 'fleet', run: () => openClusterDashboard() },
    { label: 'Open incident history', hint: 'incident', run: () => openIncidentHistory() },
    { label: 'Configure hardware blueprint', hint: 'setup', run: () => { const el = document.getElementById('recon-overlay'); if (el) el.style.display = 'flex'; } },
    { label: 'Toggle lab coach', hint: 'learn', run: () => toggleLabCoach() },
    { label: 'Reset all progress', hint: 'danger', run: () => resetAll() },
  ];
  if (typeof LABS !== 'undefined') {
    Object.keys(LABS).forEach(id => {
      commands.push({
        label: `Lab: ${LABS[id].name}`,
        hint: 'lab',
        run: () => {
          if (!isProvisioned) applyProvisioning();
          setWorkspaceMode('training', { openFleet: false });
          loadLab(id);
        },
      });
    });
  }
  return commands;
}

function getFilteredPaletteCommands() {
  const query = String(document.getElementById('palette-input')?.value || '').trim().toLowerCase();
  const all = getPaletteCommands();
  if (!query) return all;
  return all.filter(cmd => `${cmd.label} ${cmd.hint}`.toLowerCase().includes(query));
}

function isPaletteOpen() {
  const overlay = document.getElementById('palette-overlay');
  return !!overlay && overlay.style.display !== 'none';
}

function renderPaletteList() {
  const list = document.getElementById('palette-list');
  if (!list) return;
  const commands = getFilteredPaletteCommands();
  if (paletteSelection >= commands.length) paletteSelection = Math.max(0, commands.length - 1);
  list.replaceChildren();
  if (!commands.length) {
    const empty = document.createElement('div');
    empty.className = 'palette-empty';
    empty.textContent = 'No matching command.';
    list.appendChild(empty);
    return;
  }
  commands.forEach((cmd, idx) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'palette-item' + (idx === paletteSelection ? ' selected' : '');
    const label = document.createElement('span');
    label.textContent = cmd.label;
    const hint = document.createElement('span');
    hint.className = 'palette-item-hint';
    hint.textContent = cmd.hint;
    row.appendChild(label);
    row.appendChild(hint);
    row.addEventListener('click', () => runPaletteCommand(cmd));
    list.appendChild(row);
  });
}

function runPaletteCommand(cmd) {
  closePalette();
  const hub = document.getElementById('hub-overlay');
  if (hub && hub.style.display !== 'none') {
    localStorage.setItem('gpusim_hub_seen', 'true');
    hub.style.display = 'none';
  }
  cmd.run();
}

function openPalette() {
  const overlay = document.getElementById('palette-overlay');
  const input = document.getElementById('palette-input');
  if (!overlay || !input) return;
  paletteSelection = 0;
  input.value = '';
  overlay.style.display = 'flex';
  renderPaletteList();
  input.focus();
}

function closePalette() {
  const overlay = document.getElementById('palette-overlay');
  if (overlay) overlay.style.display = 'none';
}

function handlePaletteInputKeydown(e) {
  const commands = getFilteredPaletteCommands();
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    paletteSelection = Math.min(paletteSelection + 1, Math.max(0, commands.length - 1));
    renderPaletteList();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    paletteSelection = Math.max(paletteSelection - 1, 0);
    renderPaletteList();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const cmd = commands[paletteSelection];
    if (cmd) runPaletteCommand(cmd);
  }
}

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'k') {
    const login = document.getElementById('login-overlay');
    if (login && login.style.display !== 'none') return;
    e.preventDefault();
    if (isPaletteOpen()) closePalette(); else openPalette();
    return;
  }
  if (e.key === 'Escape' && isPaletteOpen()) closePalette();
});

window.addEventListener('load', () => {
  const input = document.getElementById('palette-input');
  if (input) {
    input.addEventListener('input', () => { paletteSelection = 0; renderPaletteList(); });
    input.addEventListener('keydown', handlePaletteInputKeydown);
  }
  const overlay = document.getElementById('palette-overlay');
  if (overlay) {
    overlay.addEventListener('click', e => { if (e.target === overlay) closePalette(); });
  }
});
