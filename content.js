// content.js funcional
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "fill") {
    const identity = message.identity;
    const mappings = message.mappings;

    document.querySelectorAll('input, textarea, select').forEach(el => {
      if (el.type !== 'checkbox' && el.type !== 'radio') {
        el.value = '';
      }
    });

    mappings.forEach(mapping => {
      const value = identity[mapping.CampoIdentidad];
      if (value) {
        const input = document.querySelector(`[name='${mapping.CampoFormulario}']`);
        if (input) {
          input.value = value;
        }
      }
    });
  }

  if (message.action === "scan") {
    const fields = [];
    document.querySelectorAll('input, textarea, select').forEach(el => {
      if (el.name) {
        fields.push({
          label: el.labels && el.labels[0] ? el.labels[0].innerText : el.placeholder || 'Campo sin etiqueta',
          name: el.name
        });
      }
    });
    sendResponse({ fields: fields });
  }
});