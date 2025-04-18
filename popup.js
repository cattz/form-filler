import * as XLSX from 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm';

let identities = [];

document.getElementById('fileInput').addEventListener('change', handleFile);
document.getElementById('fillForm').addEventListener('click', fillForm);

function handleFile(event) {
  const file = event.target.files[0];
  const reader = new FileReader();

  reader.onload = function(e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    identities = XLSX.utils.sheet_to_json(sheet);
    populateSelect(identities);
  };

  reader.readAsArrayBuffer(file);
}

function populateSelect(identities) {
  const select = document.getElementById('identitySelect');
  select.innerHTML = '';
  identities.forEach((identity, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = identity.Nombre || `Identidad ${index+1}`;
    select.appendChild(option);
  });
}

function fillForm() {
  const selectedIndex = document.getElementById('identitySelect').value;
  const selectedIdentity = identities[selectedIndex];

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: "fill", data: selectedIdentity });
  });
}
