// Form Autofiller Content Script
// This script runs in the context of web pages to detect and fill forms

// Debug mode flag - will be updated from storage
let DEBUG_MODE = false;

// Initialize
init();

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Check if debug mode is enabled
  chrome.storage.local.get(['debugMode'], (result) => {
    DEBUG_MODE = result.debugMode || false;
    
    // Process message
    processMessage(message, sender, sendResponse);
  });
  
  // Important: Return true to indicate that we will send a response asynchronously
  return true;
});

// Initialize content script
function init() {
  log('Form Autofiller content script initialized');
}

// Process messages from popup
function processMessage(message, sender, sendResponse) {
  try {
    log('Received message:', message);
    
    switch (message.action) {
      case 'fill':
        fillForm(message.identity, message.mappings, sendResponse);
        break;
        
      case 'scan':
        scanForm(sendResponse);
        break;
        
      default:
        log('Unknown action:', message.action);
        sendResponse({ success: false, error: 'Unknown action' });
    }
  } catch (error) {
    log('Error processing message:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Fill form with identity data
function fillForm(identity, mappings, sendResponse) {
  try {
    log('Filling form with identity:', identity);
    log('Using mappings:', mappings);
    
    // First clear all form fields to avoid partial filling
    clearFormFields();
    
    // Track fields that were filled
    const filledFields = [];
    
    // Process inputs (text, email, tel, number, etc.)
    document.querySelectorAll('input:not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([readonly])').forEach(input => {
      fillField(input, identity, mappings, filledFields);
    });
    
    // Process textareas
    document.querySelectorAll('textarea:not([readonly])').forEach(textarea => {
      fillField(textarea, identity, mappings, filledFields);
    });
    
    // Process selects
    document.querySelectorAll('select:not([disabled])').forEach(select => {
      fillSelectField(select, identity, mappings, filledFields);
    });
    
    // Process checkboxes and radio buttons
    document.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(input => {
      fillCheckboxOrRadio(input, identity, mappings, filledFields);
    });
    
    log('Filled fields:', filledFields);
    
    sendResponse({
      success: true,
      message: `Filled ${filledFields.length} fields`,
      filledFields: filledFields
    });
  } catch (error) {
    log('Error filling form:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Clear all form fields
function clearFormFields() {
  log('Clearing all form fields');
  
  // Clear text inputs
  document.querySelectorAll('input:not([type="submit"]):not([type="button"]):not([type="reset"]):not([readonly])').forEach(input => {
    if (input.type === 'checkbox' || input.type === 'radio') {
      input.checked = false;
    } else {
      input.value = '';
    }
  });
  
  // Clear textareas
  document.querySelectorAll('textarea:not([readonly])').forEach(textarea => {
    textarea.value = '';
  });
  
  // Reset selects to first option
  document.querySelectorAll('select:not([disabled])').forEach(select => {
    select.selectedIndex = 0;
  });
}

// Fill a field with identity data
function fillField(field, identity, mappings, filledFields) {
  // Try to find field in mappings by various attributes
  const identityField = findMatchingField(field, mappings);
  
  if (identityField && identity[identityField]) {
    // Fill the field
    field.value = identity[identityField];
    
    // Dispatch input event to trigger form validation
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    
    // Add to filled fields list
    filledFields.push({
      element: getElementIdentifier(field),
      identityField: identityField,
      value: identity[identityField]
    });
    
    log(`Filled field ${getElementIdentifier(field)} with ${identityField}`);
  }
}

// Fill a select field with identity data
function fillSelectField(select, identity, mappings, filledFields) {
  const identityField = findMatchingField(select, mappings);
  
  if (identityField && identity[identityField]) {
    const value = identity[identityField];
    let optionFound = false;
    
    // First try to match by value
    for (const option of select.options) {
      if (option.value === value || option.textContent.trim() === value) {
        select.value = option.value;
        optionFound = true;
        break;
      }
    }
    
    // If no match found, try partial matching
    if (!optionFound) {
      for (const option of select.options) {
        if (option.textContent.toLowerCase().includes(value.toLowerCase())) {
          select.value = option.value;
          optionFound = true;
          break;
        }
      }
    }
    
    // Dispatch change event if an option was selected
    if (optionFound) {
      select.dispatchEvent(new Event('change', { bubbles: true }));
      
      filledFields.push({
        element: getElementIdentifier(select),
        identityField: identityField,
        value: value
      });
      
      log(`Filled select ${getElementIdentifier(select)} with ${identityField}`);
    }
  }
}

// Fill a checkbox or radio button
function fillCheckboxOrRadio(input, identity, mappings, filledFields) {
  const identityField = findMatchingField(input, mappings);
  
  if (identityField && identity[identityField]) {
    const value = identity[identityField].toString().toLowerCase();
    
    // Check if the identity value matches the input value, label, or is a boolean value
    if (
      input.value.toLowerCase() === value ||
      (getAssociatedLabelText(input) || '').toLowerCase() === value ||
      input.name.toLowerCase() === identityField.toLowerCase() ||
      (value === 'true' || value === 'yes' || value === '1')
    ) {
      input.checked = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      
      filledFields.push({
        element: getElementIdentifier(input),
        identityField: identityField,
        value: value
      });
      
      log(`Checked ${input.type} ${getElementIdentifier(input)} with ${identityField}`);
    }
  }
}

// Find a matching field in mappings
function findMatchingField(element, mappings) {
  // Try to match by various attributes
  const attributes = [
    element.id,
    element.name,
    element.getAttribute('data-field'),
    element.getAttribute('aria-label'),
    element.getAttribute('placeholder'),
    getAssociatedLabelText(element)
  ].filter(Boolean); // Remove null/undefined values
  
  // Try class names separately (since there could be multiple)
  const classNames = Array.from(element.classList || []);
  
  // Combine all possible identifiers
  const identifiers = [...attributes, ...classNames];
  
  // Try to find a match in mappings
  for (const identifier of identifiers) {
    if (mappings[identifier]) {
      return mappings[identifier];
    }
    
    // Try case-insensitive match
    const lowerIdentifier = identifier.toLowerCase();
    for (const key in mappings) {
      if (key.toLowerCase() === lowerIdentifier) {
        return mappings[key];
      }
    }
  }
  
  // No match found
  return null;
}

// Get text from label associated with an element
function getAssociatedLabelText(element) {
  // Try by for attribute
  if (element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label) {
      return label.textContent.trim();
    }
  }
  
  // Try by parent label
  const parentLabel = element.closest('label');
  if (parentLabel) {
    // Get text excluding the text from the input itself
    const clone = parentLabel.cloneNode(true);
    const inputs = clone.querySelectorAll('input, select, textarea, button');
    inputs.forEach(input => input.remove());
    return clone.textContent.trim();
  }
  
  // Try by aria-labelledby
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelElement = document.getElementById(labelledBy);
    if (labelElement) {
      return labelElement.textContent.trim();
    }
  }
  
  // No label found
  return null;
}

// Get an identifier for an element for logging
function getElementIdentifier(element) {
  if (element.id) {
    return `#${element.id}`;
  }
  if (element.name) {
    return `[name="${element.name}"]`;
  }
  if (element.getAttribute('data-field')) {
    return `[data-field="${element.getAttribute('data-field')}"]`;
  }
  
  // Fallback to element type with some context
  const elementType = element.tagName.toLowerCase();
  const label = getAssociatedLabelText(element);
  if (label) {
    return `${elementType} "${label}"`;
  }
  
  return elementType;
}

// Scan a form for field names
function scanForm(sendResponse) {
  try {
    // Collect all form fields
    const fields = [];
    
    // Collect input fields (excluding buttons)
    document.querySelectorAll('input:not([type="submit"]):not([type="button"]):not([type="reset"])').forEach(input => {
      const fieldIdentifier = getFieldIdentifier(input);
      if (fieldIdentifier) {
        fields.push(fieldIdentifier);
      }
    });
    
    // Collect textarea fields
    document.querySelectorAll('textarea').forEach(textarea => {
      const fieldIdentifier = getFieldIdentifier(textarea);
      if (fieldIdentifier) {
        fields.push(fieldIdentifier);
      }
    });
    
    // Collect select fields
    document.querySelectorAll('select').forEach(select => {
      const fieldIdentifier = getFieldIdentifier(select);
      if (fieldIdentifier) {
        fields.push(fieldIdentifier);
      }
    });
    
    log('Scanned fields:', fields);
    
    // Return unique fields
    const uniqueFields = [...new Set(fields)];
    sendResponse({ success: true, fields: uniqueFields });
  } catch (error) {
    log('Error scanning form:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Get the best identifier for a form field
function getFieldIdentifier(element) {
  // Priority: id > name > label > placeholder > aria-label
  if (element.id) {
    return element.id;
  }
  
  if (element.name) {
    return element.name;
  }
  
  const label = getAssociatedLabelText(element);
  if (label) {
    return label;
  }
  
  if (element.placeholder) {
    return element.placeholder;
  }
  
  if (element.getAttribute('aria-label')) {
    return element.getAttribute('aria-label');
  }
  
  // Fallback to a combination of element type and some distinguishing feature
  if (element.classList.length > 0) {
    return `${element.tagName.toLowerCase()}.${element.classList[0]}`;
  }
  
  // If all else fails, return null
  return null;
}

// Debug logging
function log(...args) {
  if (DEBUG_MODE) {
    console.log('[Form Autofiller]', ...args);
  }
}