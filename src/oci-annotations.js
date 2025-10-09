/**
 * OCI Annotations support for WebAssembly components
 *
 * This module implements the WebAssembly tool-conventions for OCI annotations
 * as defined in: https://github.com/WebAssembly/tool-conventions/pull/248
 *
 * The following custom sections are supported:
 * - version: Version of the packaged software
 * - description: Human-readable description of the binary
 * - authors: Contact details of the authors
 * - licenses: SPDX license expression
 * - homepage: URL to find more information about the package
 * - source: URL to get source code for building the package
 * - revision: Hash of the commit used to build the package
 */

/**
 * Encode a number as LEB128 unsigned integer
 * @param {number} value
 * @returns {Uint8Array}
 */
function encodeLEB128(value) {
  const bytes = [];
  do {
    let byte = value & 0x7f;
    value >>= 7;
    if (value !== 0) {
      byte |= 0x80;
    }
    bytes.push(byte);
  } while (value !== 0);
  return new Uint8Array(bytes);
}

/**
 * Encode a custom section with the given name and data
 * @param {string} name - Section name
 * @param {string} data - Section data (UTF-8 string)
 * @returns {Uint8Array}
 */
function encodeCustomSection(name, data) {
  const nameBytes = new TextEncoder().encode(name);
  const dataBytes = new TextEncoder().encode(data);

  const nameLengthBytes = encodeLEB128(nameBytes.length);
  const payloadSize = nameLengthBytes.length + nameBytes.length + dataBytes.length;
  const sectionSizeBytes = encodeLEB128(payloadSize);

  // Custom section ID is 0
  const sectionId = new Uint8Array([0]);

  // Concatenate all parts
  const section = new Uint8Array(
    sectionId.length +
    sectionSizeBytes.length +
    nameLengthBytes.length +
    nameBytes.length +
    dataBytes.length
  );

  let offset = 0;
  section.set(sectionId, offset);
  offset += sectionId.length;
  section.set(sectionSizeBytes, offset);
  offset += sectionSizeBytes.length;
  section.set(nameLengthBytes, offset);
  offset += nameLengthBytes.length;
  section.set(nameBytes, offset);
  offset += nameBytes.length;
  section.set(dataBytes, offset);

  return section;
}

/**
 * Add OCI annotation custom sections to a WebAssembly component
 * @param {Uint8Array} component - The WebAssembly component binary
 * @param {Object} annotations - OCI annotations to add
 * @param {string} [annotations.version] - Package version
 * @param {string} [annotations.description] - Package description
 * @param {string} [annotations.authors] - Package authors (freeform contact details)
 * @param {string} [annotations.licenses] - SPDX license expression
 * @param {string} [annotations.homepage] - Package homepage URL
 * @param {string} [annotations.source] - Source repository URL
 * @param {string} [annotations.revision] - Source revision/commit hash
 * @returns {Uint8Array} - Component with OCI annotations added
 */
export function addOCIAnnotations(component, annotations) {
  if (!annotations || Object.keys(annotations).length === 0) {
    return component;
  }

  const sections = [];

  // Add each annotation as a custom section
  // Order matters: add in a consistent order for reproducibility
  const fields = ['version', 'description', 'authors', 'licenses', 'homepage', 'source', 'revision'];

  for (const field of fields) {
    if (annotations[field]) {
      sections.push(encodeCustomSection(field, annotations[field]));
    }
  }

  if (sections.length === 0) {
    return component;
  }

  // Calculate total size needed
  let totalSize = component.length;
  for (const section of sections) {
    totalSize += section.length;
  }

  // The WebAssembly module/component starts with a magic number and version
  // Magic: 0x00 0x61 0x73 0x6d (for modules)
  // Component magic: 0x00 0x61 0x73 0x6d (same magic, different layer encoding)
  // Version: 4 bytes
  // We want to insert custom sections after the header (8 bytes)

  const WASM_HEADER_SIZE = 8;
  const result = new Uint8Array(totalSize);

  // Copy header
  result.set(component.subarray(0, WASM_HEADER_SIZE), 0);

  let offset = WASM_HEADER_SIZE;

  // Add custom sections
  for (const section of sections) {
    result.set(section, offset);
    offset += section.length;
  }

  // Copy rest of component
  result.set(component.subarray(WASM_HEADER_SIZE), offset);

  return result;
}

/**
 * Extract OCI annotations from package.json metadata
 * @param {Object} packageJson - Parsed package.json content
 * @returns {Object} OCI annotations
 */
export function extractAnnotationsFromPackageJson(packageJson) {
  const annotations = {};

  if (packageJson.version) {
    annotations.version = packageJson.version;
  }

  if (packageJson.description) {
    annotations.description = packageJson.description;
  }

  // Authors can be a string or an array of objects/strings
  if (packageJson.author) {
    if (typeof packageJson.author === 'string') {
      annotations.authors = packageJson.author;
    } else if (packageJson.author.name) {
      const author = packageJson.author;
      let authorStr = author.name;
      if (author.email) authorStr += ` <${author.email}>`;
      annotations.authors = authorStr;
    }
  } else if (packageJson.authors && Array.isArray(packageJson.authors)) {
    const authorStrs = packageJson.authors.map(a => {
      if (typeof a === 'string') return a;
      let str = a.name || '';
      if (a.email) str += ` <${a.email}>`;
      return str;
    }).filter(s => s);
    if (authorStrs.length > 0) {
      annotations.authors = authorStrs.join(', ');
    }
  }

  if (packageJson.license) {
    annotations.licenses = packageJson.license;
  }

  if (packageJson.homepage) {
    annotations.homepage = packageJson.homepage;
  }

  // Extract source URL from repository field
  if (packageJson.repository) {
    if (typeof packageJson.repository === 'string') {
      annotations.source = packageJson.repository;
    } else if (packageJson.repository.url) {
      annotations.source = packageJson.repository.url;
    }
  }

  return annotations;
}
