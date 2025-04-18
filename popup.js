let identities = [];
let mappings = [];
let defaultMappings = [];
let currentDomain = "";

document.addEventListener('DOMContentLoaded', init);

function init() {
  chrome.storage.local.get(['identities', 'mappings', 'defaultMappings'], (result) => {
    if (result.identities) {
      identities = result.identities;
      populateIdentities(identities);
    }
    if (result.mappings) {
      mappings = result.mappings;
      populateDomains(mappings);
    }
    if (result.defaultMappings) {
      defaultMappings = result.defaultMappings;
    }
  });

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = new URL(tabs[0].url);
    currentDomain = url.hostname.replace('www.', '');
    document.getElementById('domainSelect').value = currentDomain;
  });

  document.getElementById('fileInputIdentities').addEventListener('change', handleIdentitiesFile);
  document.getElementById('fileInputMappings').addEventListener('change', handleMappingsFile);
  document.getElementById('fileInputDefaults').addEventListener('change', handleDefaultsFile);
  document.getElementById('identitySelect').addEventListener('change', updatePreview);
  document.getElementById('fillForm').addEventListener('click', fillForm);
}

function handleIdentitiesFile(event) {
  const file = event.target.files[0];
  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    identities = parseCSV(text);
    chrome.storage.local.set({ identities: identities }, () => {
      console.log('Identidades guardadas.');
      populateIdentities(identities);
    });
  };
  reader.readAsText(file);
}

function handleMappingsFile(event) {
  const file = event.target.files[0];
  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    mappings = parseCSV(text);
    chrome.storage.local.set({ mappings: mappings }, () => {
      console.log('Mapeos guardados.');
      populateDomains(mappings);
    });
  };
  reader.readAsText(file);
}

function handleDefaultsFile(event) {
  const file = event.target.files[0];
  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    defaultMappings = parseCSV(text);
    chrome.storage.local.set({ defaultMappings: defaultMappings }, () => {
      console.log('Mapeos por defecto guardados.');
    });
  };
  reader.readAsText(file);
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const entry = {};
    headers.forEach((header, index) => {
      entry[header.trim()] = (values[index] || '').trim();
    });
    return entry;
  });
}

function populateIdentities(identities) {
  const select = document.getElementById('identitySelect');
  select.innerHTML = '';
  identities.forEach((identity, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = identity.Nombre || `Identidad ${index+1}`;
    select.appendChild(option);
  });
  updatePreview();
}

function populateDomains(mappings) {
  const select = document.getElementById('domainSelect');
  const domains = [...new Set(mappings.map(m => m.Dominio))];
  select.innerHTML = '';
  domains.forEach(domain => {
    const option = document.createElement('option');
    option.value = domain;
    option.textContent = domain;
    select.appendChild(option);
  });
}

function updatePreview() {
  const preview = document.getElementById('preview');
  const index = document.getElementById('identitySelect').value;
  if (identities[index]) {
    const identity = identities[index];
    preview.innerHTML = `
      <strong>Nombre:</strong> ${identity.Nombre || ''}<br>
      <strong>Apellidos:</strong> ${identity.Apellidos || ''}<br>
      <strong>NIF:</strong> ${identity.NIF || ''}<br>
      <strong>Email:</strong> ${identity.Email || ''}<br>
      <strong>Teléfono:</strong> ${identity.Telefono || ''}
    `;
  } else {
    preview.innerHTML = '';
  }
}

function fillForm() {
  const selectedIdentity = identities[document.getElementById('identitySelect').value];
  const selectedDomain = document.getElementById('domainSelect').value;
  const domainMappings = mappings.filter(m => m.Dominio === selectedDomain);
  
  const mergedMappings = [...domainMappings, ...defaultMappings];

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: "fill", identity: selectedIdentity, mappings: mergedMappings });
  });
}