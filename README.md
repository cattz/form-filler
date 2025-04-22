# Form Autofiller Assistant

A Chrome extension for automatically filling out web forms using configurable identities and field mappings.

## Features

- Automatically fill forms based on selected identities and field mappings
- Detect field names in forms and create custom mappings
- Import and export identities and mappings via CSV files
- Store all data locally in your browser - no server communication
- Support for domain-specific and general field mappings
- Debug mode for troubleshooting

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" at the top right
4. Click "Load unpacked" and select the extension directory

## Usage

### Filling Forms

1. Navigate to a web page with a form
2. Click the Form Autofiller Assistant icon in your browser toolbar
3. Select an identity from the dropdown
4. Click "Fill Form" to automatically populate the form fields

### Mapping Fields

1. Navigate to a web page with a form
2. Click the Form Autofiller Assistant icon in your browser toolbar
3. Go to the "Map" tab
4. Click "Scan Form" to detect form fields
5. For each field, select the corresponding identity field
6. Click "Save Mappings" to store your mappings

### Managing Data

1. Click the Form Autofiller Assistant icon in your browser toolbar
2. Go to the "Config" tab
3. Use the Import/Export buttons to manage your identities and mappings

## CSV Format

### Identities CSV

Columns should include identity fields like Name, Surname, Email, Phone, etc.

Example:
```
Name,Surname,Email,Phone
John,Doe,john.doe@example.com,123456789
Jane,Smith,jane.smith@example.com,987654321
```

### Mappings CSV

Domain-specific mappings:
```
domain,identityField,formField
example.com,Name,firstName
example.com,Surname,lastName
```

General mappings:
```
identityField,formField
Name,name
Email,email
```

## License

This project is released under the MIT License.