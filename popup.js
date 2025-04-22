// Debug flag
let DEBUG_MODE = false;

// Store for identities and mappings
let identities = [];
let domainMappings = {};
let generalMappings = {};
let currentDomain = '';
let isEditingDomain = false;

// DOM Elements
document.addEventListener('DOMContentLoaded', () => {
  // Initialize debug mode first
  chrome.storage.local.get(['debugMode'], (result) => {
    DEBUG_MODE = result.debugMode || false;
    document.getElementById('debug-toggle').checked = DEBUG_MODE;
    log('Debug mode initialized:', DEBUG_MODE);
  });

  // Tab navigation
  const tabButtons = document.querySelectorAll('.tab-button');
  const sections = document.querySelectorAll('.section');
  
  // Fill form elements
  const currentDomainInput = document.getElementById('current-domain');
  const editDomainButton = document.getElementById('edit-domain');
  const identitySelect = document.getElementById('identity-select');
  const fillFormButton = document.getElementById('fill-form');
  
  // Mapping elements
  const mapDomainInput = document.getElementById('map-domain');
  const scanFormButton = document.getElementById('scan-form');
  const saveMapButton = document.getElementById('save-mappings');
  const noMappingsDiv = document.getElementById('no-mappings');
  const fieldMappingsDiv = document.getElementById('field-mappings');
  
  // Config elements
  const importIdentitiesInput = document.getElementById('import-identities');
  const exportIdentitiesButton = document.getElementById('export-identities');
  const importMappingsInput = document.getElementById('import-mappings');
  const exportMappingsButton = document.getElementById('export-mappings');
  const debugToggle = document.getElementById('debug-toggle');
  
  // Initialize extension
  initialize();
  
  // Tab navigation event listeners
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabId = button.id.replace('tab-', '');
      
      // Update active tab button
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // Show selected section
      sections.forEach(section => {
        section.classList.remove('active');
        if (section.id === `section-${tabId}`) {
          section.classList.add('active');
        }
      });
    });
  });

  // Debug toggle with immediate storage update
  debugToggle.addEventListener('change', () => {
    DEBUG_MODE = debugToggle.checked;
    chrome.storage.local.set({ debugMode: DEBUG_MODE }, () => {
      log('Debug mode ' + (DEBUG_MODE ? 'enabled' : 'disabled'));
      showToast('Debug mode ' + (DEBUG_MODE ? 'enabled' : 'disabled'), 'info');
    });
  });
  
  // Domain editing
  editDomainButton.addEventListener('click', () => {
    if (isEditingDomain) {
      currentDomainInput.setAttribute('readonly', true);
      currentDomainInput.classList.remove('editing');
      isEditingDomain = false;
      
      // Update domain mappings
      currentDomain = currentDomainInput.value;
      mapDomainInput.value = currentDomain;
      
      showToast('Domain updated', 'success');
    } else {
      currentDomainInput.removeAttribute('readonly');
      currentDomainInput.focus();
      currentDomainInput.classList.add('editing');
      isEditingDomain = true;
    }
  });
  
  currentDomainInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && isEditingDomain) {
      editDomainButton.click();
    }
  });
  
  // Fill form
  fillFormButton.addEventListener('click', () => {
    const selectedIdentityId = identitySelect.value;
    
    if (!selectedIdentityId) {
      showToast('Please select an identity', 'error');
      return;
    }
    
    const selectedIdentity = identities.find(identity => identity.id === selectedIdentityId);
    if (!selectedIdentity) {
      showToast('Identity not found', 'error');
      return;
    }
    
    // Get mappings for current domain
    const mappings = getMappingsForDomain(currentDomain);
    
    // Send message to content script
    getCurrentTab().then(tab => {
      chrome.tabs.sendMessage(
        tab.id,
        {
          action: 'fill',
          identity: selectedIdentity,
          mappings: mappings
        },
        (response) => {
          if (chrome.runtime.lastError) {
            log('Error sending message to content script:', chrome.runtime.lastError);
            showToast('Error filling form: ' + chrome.runtime.lastError.message, 'error');
            return;
          }
          
          if (response && response.success) {
            showToast('Form filled successfully', 'success');
            log('Form filled successfully:', response);
          } else {
            showToast('Error filling form', 'error');
            log('Error filling form:', response);
          }
        }
      );
    }).catch(error => {
      showToast('Error accessing tab', 'error');
      log('Error accessing tab:', error);
    });
  });
  
  // Scan form fields
  scanFormButton.addEventListener('click', () => {
    getCurrentTab().then(tab => {
      chrome.tabs.sendMessage(
        tab.id,
        { action: 'scan' },
        (response) => {
          if (chrome.runtime.lastError) {
            log('Error sending message to content script:', chrome.runtime.lastError);
            showToast('Error scanning form: ' + chrome.runtime.lastError.message, 'error');
            return;
          }
          
          if (response && response.success && response.fields) {
            showToast('Form scanned successfully', 'success');
            log('Form fields:', response.fields);
            
            // Display fields for mapping
            displayFieldsForMapping(response.fields);
          } else {
            showToast('No form fields found', 'error');
            log('Error scanning form or no fields found:', response);
          }
        }
      );
    }).catch(error => {
      showToast('Error accessing tab', 'error');
      log('Error accessing tab:', error);
    });
  });
  
  // Save mappings
  saveMapButton.addEventListener('click', () => {
    const mappingRows = document.querySelectorAll('.field-mapping-row');
    const newMappings = [];
    
    mappingRows.forEach(row => {
      const formField = row.getAttribute('data-field');
      const identityField = row.querySelector('.identity-field').value;
      
      if (identityField) {
        newMappings.push({
          formField,
          identityField
        });
      }
    });
    
    // Save domain-specific mappings
    if (!domainMappings[currentDomain]) {
      domainMappings[currentDomain] = [];
    }
    
    domainMappings[currentDomain] = newMappings;
    
    // Save to storage
    saveToStorage('domainMappings', domainMappings).then(() => {
      showToast('Mappings saved successfully', 'success');
    }).catch(error => {
      showToast('Error saving mappings', 'error');
      log('Error saving mappings:', error);
    });
  });
  
  // Import identities
  importIdentitiesInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csv = e.target.result;
        const newIdentities = parseCSV(csv);
        
        if (newIdentities.length > 0) {
          // Generate IDs for identities if they don't have one
          newIdentities.forEach(identity => {
            if (!identity.id) {
              identity.id = generateId();
            }
          });
          
          identities = newIdentities;
          saveToStorage('identities', identities).then(() => {
            populateIdentitiesDropdown();
            showToast(`Imported ${identities.length} identities`, 'success');
          });
        } else {
          showToast('No valid identities found in file', 'error');
        }
      } catch (error) {
        showToast('Error parsing CSV file', 'error');
        log('Error parsing CSV:', error);
      }
    };
    reader.readAsText(file);
  });
  
  // Export identities
  exportIdentitiesButton.addEventListener('click', () => {
    if (identities.length === 0) {
      showToast('No identities to export', 'error');
      return;
    }
    
    const csv = convertToCSV(identities);
    downloadCSV(csv, 'form-autofiller-identities.csv');
    showToast('Identities exported', 'success');
  });
  
  // Import mappings
  importMappingsInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csv = e.target.result;
        const mappingsArray = parseCSV(csv);
        
        if (mappingsArray.length > 0) {
          // Determine if it's domain-specific or general mappings
          if (mappingsArray[0].hasOwnProperty('domain')) {
            // Domain-specific mappings
            const newDomainMappings = {};
            
            mappingsArray.forEach(mapping => {
              const domain = mapping.domain;
              const identityField = mapping.identityField;
              const formField = mapping.formField;
              
              if (domain && identityField && formField) {
                if (!newDomainMappings[domain]) {
                  newDomainMappings[domain] = [];
                }
                
                newDomainMappings[domain].push({
                  identityField,
                  formField
                });
              }
            });
            
            domainMappings = newDomainMappings;
            saveToStorage('domainMappings', domainMappings).then(() => {
              showToast('Domain mappings imported', 'success');
            });
          } else {
            // General mappings
            const newGeneralMappings = {};
            
            mappingsArray.forEach(mapping => {
              const identityField = mapping.identityField;
              const formField = mapping.formField;
              
              if (identityField && formField) {
                newGeneralMappings[formField] = identityField;
              }
            });
            
            generalMappings = newGeneralMappings;
            saveToStorage('generalMappings', generalMappings).then(() => {
              showToast('General mappings imported', 'success');
            });
          }
        } else {
          showToast('No valid mappings found in file', 'error');
        }
      } catch (error) {
        showToast('Error parsing CSV file', 'error');
        log('Error parsing CSV:', error);
      }
    };
    reader.readAsText(file);
  });
  
  // Export mappings
  exportMappingsButton.addEventListener('click', () => {
    // Export domain mappings
    const domainMappingsArray = [];
    
    for (const domain in domainMappings) {
      domainMappings[domain].forEach(mapping => {
        domainMappingsArray.push({
          domain,
          identityField: mapping.identityField,
          formField: mapping.formField
        });
      });
    }
    
    if (domainMappingsArray.length > 0) {
      const csv = convertToCSV(domainMappingsArray);
      downloadCSV(csv, 'form-autofiller-domain-mappings.csv');
      showToast('Domain mappings exported', 'success');
    } else {
      showToast('No domain mappings to export', 'error');
    }
    
    // Export general mappings
    const generalMappingsArray = [];
    
    for (const formField in generalMappings) {
      generalMappingsArray.push({
        identityField: generalMappings[formField],
        formField
      });
    }
    
    if (generalMappingsArray.length > 0) {
      const csv = convertToCSV(generalMappingsArray);
      downloadCSV(csv, 'form-autofiller-general-mappings.csv');
      showToast('General mappings exported', 'success');
    }
  });
});

// Initialize the extension
function initialize() {
  // Load settings from storage
  Promise.all([
    loadFromStorage('identities'),
    loadFromStorage('domainMappings'),
    loadFromStorage('generalMappings'),
    loadFromStorage('debugMode')
  ]).then(([loadedIdentities, loadedDomainMappings, loadedGeneralMappings, loadedDebugMode]) => {
    // Initialize identities
    identities = loadedIdentities || [];
    populateIdentitiesDropdown();
    
    // Initialize mappings
    domainMappings = loadedDomainMappings || {};
    generalMappings = loadedGeneralMappings || {};
    
    // Initialize debug mode
    DEBUG_MODE = loadedDebugMode || false;
    document.getElementById('debug-toggle').checked = DEBUG_MODE;
    
    // Get current domain
    getCurrentTab().then(tab => {
      currentDomain = new URL(tab.url).hostname;
      document.getElementById('current-domain').value = currentDomain;
      document.getElementById('map-domain').value = currentDomain;
      
      log('Initialized with domain:', currentDomain);
    }).catch(error => {
      log('Error getting current tab:', error);
    });
  }).catch(error => {
    log('Error initializing extension:', error);
  });
}

// Get the current active tab
async function getCurrentTab() {
  const queryOptions = { active: true, currentWindow: true };
  const [tab] = await chrome.tabs.query(queryOptions);
  return tab;
}

// Storage helpers
function saveToStorage(key, value) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

function loadFromStorage(key) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([key], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result[key]);
      }
    });
  });
}

// Show toast message
function showToast(message, type = 'info') {
  const toastContainer = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  toastContainer.appendChild(toast);
  
  // Force reflow
  toast.offsetHeight;
  
  // Add opacity to make it visible
  toast.style.opacity = '1';
  
  // Remove after 3 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

// Populate identities dropdown
function populateIdentitiesDropdown() {
  const select = document.getElementById('identity-select');
  
  // Clear current options
  while (select.options.length > 1) {
    select.remove(1);
  }
  
  // Add identities
  identities.forEach(identity => {
    const option = document.createElement('option');
    option.value = identity.id;
    
    // Display name depends on what fields are available
    let displayName = 'Unknown Identity';
    if (identity.Name && identity.Surname) {
      displayName = `${identity.Name} ${identity.Surname}`;
    } else if (identity.FullName) {
      displayName = identity.FullName;
    } else if (identity.Email) {
      displayName = identity.Email;
    } else if (identity.id) {
      displayName = `Identity ${identity.id}`;
    }
    
    option.textContent = displayName;
    select.appendChild(option);
  });
}

// Display fields for mapping
function displayFieldsForMapping(fields) {
  const container = document.getElementById('field-mappings');
  const noMappings = document.getElementById('no-mappings');
  
  // Clear current mappings
  container.innerHTML = '';
  
  if (fields.length === 0) {
    container.classList.add('hidden');
    noMappings.classList.remove('hidden');
    document.getElementById('save-mappings').disabled = true;
    return;
  }
  
  // Get existing mappings for this domain
  const existingMappings = domainMappings[currentDomain] || [];
  
  // Create mapping UI for each field
  fields.forEach(field => {
    const row = document.createElement('div');
    row.className = 'field-mapping-row';
    row.setAttribute('data-field', field);
    
    // Form field name
    const fieldName = document.createElement('span');
    fieldName.textContent = field;
    fieldName.className = 'form-field-name';
    
    // Identity field selector
    const identityFieldSelect = document.createElement('select');
    identityFieldSelect.className = 'identity-field';
    
    // Add empty option
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = '-- Select field --';
    identityFieldSelect.appendChild(emptyOption);
    
    // Get all possible identity fields from all identities
    const identityFields = getIdentityFieldNames();
    
    // Add options for each identity field
    identityFields.forEach(fieldName => {
      const option = document.createElement('option');
      option.value = fieldName;
      option.textContent = fieldName;
      identityFieldSelect.appendChild(option);
    });
    
    // Set selected value if mapping exists
    const existingMapping = existingMappings.find(
      mapping => mapping.formField === field
    );
    
    if (existingMapping) {
      identityFieldSelect.value = existingMapping.identityField;
    } else if (generalMappings[field]) {
      // Fall back to general mapping if available
      identityFieldSelect.value = generalMappings[field];
    }
    
    // Remove mapping button
    const removeButton = document.createElement('button');
    removeButton.className = 'remove-mapping';
    removeButton.innerHTML = '×';
    
    removeButton.addEventListener('click', () => {
      row.remove();
      
      // Disable save button if no mappings left
      if (container.children.length === 0) {
        document.getElementById('save-mappings').disabled = true;
        container.classList.add('hidden');
        noMappings.classList.remove('hidden');
      }
    });
    
    // Add elements to row
    row.appendChild(fieldName);
    row.appendChild(identityFieldSelect);
    row.appendChild(removeButton);
    
    // Add row to container
    container.appendChild(row);
  });
  
  // Show mapping container
  container.classList.remove('hidden');
  noMappings.classList.add('hidden');
  document.getElementById('save-mappings').disabled = false;
}

// Get all identity field names from all identities
function getIdentityFieldNames() {
  const fieldNames = new Set();
  
  identities.forEach(identity => {
    Object.keys(identity).forEach(key => {
      if (key !== 'id') {
        fieldNames.add(key);
      }
    });
  });
  
  return Array.from(fieldNames);
}

// Get mappings for a specific domain
function getMappingsForDomain(domain) {
  const mappings = {};
  
  // Start with general mappings
  Object.assign(mappings, generalMappings);
  
  // Override with domain-specific mappings
  if (domainMappings[domain]) {
    domainMappings[domain].forEach(mapping => {
      mappings[mapping.formField] = mapping.identityField;
    });
  }
  
  return mappings;
}

// CSV parsing and generation
function parseCSV(csv) {
  const lines = csv.split('\n');
  const result = [];
  const headers = lines[0].split(',');
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
    const obj = {};
    const currentLine = lines[i].split(',');
    
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j].trim();
      const value = currentLine[j] ? currentLine[j].trim() : '';
      obj[header] = value;
    }
    
    result.push(obj);
  }
  
  return result;
}

function convertToCSV(data) {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvRows = [];
  
  // Add headers
  csvRows.push(headers.join(','));
  
  // Add rows
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header] || '';
      // Escape quotes and wrap in quotes if contains comma
      return value.includes(',') ? `"${value.replace(/"/g, '""')}"` : value;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Generate unique ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Debug logging
function log(...args) {
  if (DEBUG_MODE) {
    console.log('[Form Autofiller]', ...args);
  }
}