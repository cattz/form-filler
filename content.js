function findInputByLabelText(labelText) {
  const labels = document.querySelectorAll('label');
  for (const label of labels) {
    if (label.textContent.toLowerCase().includes(labelText.toLowerCase())) {
      const htmlFor = label.getAttribute('for');
      if (htmlFor) {
        return document.getElementById(htmlFor);
      }
    }
  }
  return null;
}

function smartFill(data) {
  const mappings = {
    'nombre': ['name', 'nombre', 'full_name'],
    'email': ['email', 'correo'],
    'telefono': ['phone', 'telefono', 'mobile'],
    'direccion': ['address', 'direccion'],
    'ciudad': ['city', 'ciudad'],
    'codigo postal': ['zip', 'postal'],
  };

  for (const key in data) {
    let filled = false;
    const value = data[key];

    // Intentar rellenar usando name
    const inputByName = document.querySelector(`[name='${key}']`);
    if (inputByName) {
      inputByName.value = value;
      filled = true;
    }

    // Intentar rellenar buscando por label
    if (!filled) {
      const inputByLabel = findInputByLabelText(key);
      if (inputByLabel) {
        inputByLabel.value = value;
        filled = true;
      }
    }

    // Intentar rellenar usando mappings
    if (!filled) {
      for (const generalKey in mappings) {
        if (key.toLowerCase().includes(generalKey)) {
          for (const possibleName of mappings[generalKey]) {
            const inputMapped = document.querySelector(`[name*='${possibleName}']`);
            if (inputMapped) {
              inputMapped.value = value;
              filled = true;
              break;
            }
          }
        }
        if (filled) break;
      }
    }
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "fill") {
    const data = message.data;
    smartFill(data);
  }
});
