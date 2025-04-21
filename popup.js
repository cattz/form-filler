// popup.js funcional
const DEBUG_MODE = true;

let identities = [];
let mappings = [];
let defaultMappings = [];
let domainDetected = "";
let fieldsDetected = [];

document.addEventListener('DOMContentLoaded', init);

function init() {
  showView('mainView');
  chrome.storage.local.get(['identities', 'mappings', 'defaultMappings'], (result) => {
    identities = result.identities || [];
    mappings = result.mappings || [];
    defaultMappings = result.defaultMappings || [];
    populateIdentities();
    populateDomains();
  });

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      const url = new URL(tabs[0].url);
      domainDetected = url.hostname.replace('www.', '');
      if (DEBUG_MODE) console.log("[DEBUG] Dominio detectado:", domainDetected);
    }
  });

  document.getElementById('fillForm').addEventListener('click', fillForm);
  document.getElementById('openConfig').addEventListener('click', () => showView('configView'));
  document.getElementById('openMapper').addEventListener('click', openMapper);
  document.getElementById('backMainFromConfig').addEventListener('click', () => showView('mainView'));
  document.getElementById('cancelMapping').addEventListener('click', () => showView('mainView'));

  document.getElementById('fileInputIdentities').addEventListener('change', handleIdentitiesFile);
  document.getElementById('fileInputMappings').addEventListener('change', handleMappingsFile);
  document.getElementById('fileInputDefaults').addEventListener('change', handleDefaultsFile);
  document.getElementById('saveMapping').addEventListener('click', saveMapping);
  document.getElementById('exportMappings').addEventListener('click', exportMappings);

  document.getElementById('identitySelect').addEventListener('change', updatePreview);
}

function showView(view) {
  document.querySelectorAll('.view').forEach(div => div.classList.add('hidden'));
  document.getElementById(view).classList.remove('hidden');
}

function showMessage(text, type = 'success') {
  const msg = document.createElement('div');
  msg.className = 'message ' + (type === 'error' ? 'error' : '');
  msg.textContent = text;
  document.body.appendChild(msg);
  setTimeout(() => msg.remove(), 4000);
}

// Cargar archivos
function handleIdentitiesFile(e) { handleFile(e, 'identities', 'statusIdentities'); }
function handleMappingsFile(e) { handleFile(e, 'mappings', 'statusMappings'); }
function handleDefaultsFile(e) { handleFile(e, 'defaultMappings', 'statusDefaults'); }

function handleFile(event, key, statusId) {
  const file = event.target.files[0];
  const fileName = file.name.toLowerCase();
  const reader = new FileReader();

  reader.onload = function(e) {
    if (fileName.endsWith('.csv')) {
      const text = e.target.result;
      const data = parseCSV(text);
      saveData(key, data, statusId);
    } else {
      showMessage('Formato de archivo no soportado.', 'error');
    }
  };

  reader.readAsText(file);
}

function saveData(key, data, statusId) {
  chrome.storage.local.set({ [key]: data }, () => {
    if (DEBUG_MODE) console.log("[DEBUG] " + key + " guardado", data);
    if (key === 'identities') identities = data;
    if (key === 'mappings') mappings = data;
    if (key === 'defaultMappings') defaultMappings = data;
    populateIdentities();
    populateDomains();
    document.getElementById(statusId).textContent = "Cargado correctamente.";
    showMessage("Carga correcta.");
  });
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const entry = {};
    headers.forEach((h, i) => entry[h.trim()] = (values[i] || '').trim());
    return entry;
  });
}

function populateIdentities() {
  const select = document.getElementById('identitySelect');
  select.innerHTML = '';
  identities.forEach((id, i) => {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = id.Nombre || `Identidad ${i+1}`;
    select.appendChild(option);
  });
  updatePreview();
}

function populateDomains() {
  const select = document.getElementById('domainSelect');
  select.innerHTML = '';
  const dominios = [...new Set(mappings.map(m => m.Dominio))];
  dominios.forEach(domain => {
    const option = document.createElement('option');
    option.value = domain;
    option.textContent = domain;
    select.appendChild(option);
  });
  if (domainDetected) select.value = domainDetected;
}

function updatePreview() {
  const index = document.getElementById('identitySelect').value;
  const identity = identities[index];
  const preview = document.getElementById('preview');
  if (!identity) { preview.innerHTML = ''; return; }
  preview.innerHTML = `<strong>Nombre:</strong> ${identity.Nombre || ''}<br><strong>Apellidos:</strong> ${identity.Apellidos || ''}<br><strong>Email:</strong> ${identity.Email || ''}<br><strong>Teléfono:</strong> ${identity.Telefono || ''}`;
}

function fillForm() {
  const selectedIdentity = identities[document.getElementById('identitySelect').value];
  const selectedDomain = document.getElementById('domainSelect').value;
  const domainMappings = mappings.filter(m => m.Dominio === selectedDomain);

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: "fill", identity: selectedIdentity, mappings: domainMappings });
  });
}

function openMapper() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: "scan" }, (response) => {
      fieldsDetected = response.fields || [];
      generateMappingUI();
      showView('mapperView');
    });
  });
}

function generateMappingUI() {
  const container = document.getElementById('mappingList');
  container.innerHTML = '';

  fieldsDetected.forEach(field => {
    const div = document.createElement('div');
    div.classList.add('section');
    div.innerHTML = `<strong>${field.label}</strong> (${field.name})<br>
      <select data-field="${field.name}" class="select">
        <option value="">-- No asignado --</option>
        ${Object.keys(identities[0] || {}).map(key => `<option value="${key}">${key}</option>`).join('')}
      </select>`;
    container.appendChild(div);
  });
}

function saveMapping() {
  const selects = document.querySelectorAll('#mappingList select');
  const newMappings = [];

  selects.forEach(sel => {
    if (sel.value) {
      newMappings.push({
        Dominio: domainDetected,
        CampoIdentidad: sel.value,
        CampoFormulario: sel.dataset.field
      });
    }
  });

  mappings = mappings.concat(newMappings);
  chrome.storage.local.set({ mappings: mappings }, () => {
    showMessage("Mapeo guardado correctamente.");
    showView('mainView');
    populateDomains();
    if (DEBUG_MODE) console.log("[DEBUG] Nuevos mapeos guardados:", newMappings);
  });
}

function exportMappings() {
  const specificCSV = mappings.map(m => `${m.Dominio},${m.CampoIdentidad},${m.CampoFormulario}`).join('\n');
  const generalCSV = defaultMappings.map(m => `${m.CampoIdentidad},${m.CampoFormulario}`).join('\n');

  downloadCSV('mapeo_especifico.csv', 'Dominio,CampoIdentidad,CampoFormulario\n' + specificCSV);
  downloadCSV('mapeo_default.csv', 'CampoIdentidad,CampoFormulario\n' + generalCSV);
  showMessage("Mapeos exportados correctamente.");
}

function downloadCSV(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.click();
}