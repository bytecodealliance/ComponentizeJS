import { describe, it } from 'vitest';
import { strictEqual, deepStrictEqual } from 'node:assert';
import {
  addOCIAnnotations,
  extractAnnotationsFromPackageJson,
} from '../src/oci-annotations.js';

describe('OCI Annotations', () => {
  describe('extractAnnotationsFromPackageJson', () => {
    it('should extract version from package.json', () => {
      const packageJson = {
        version: '1.0.0',
      };
      const annotations = extractAnnotationsFromPackageJson(packageJson);
      strictEqual(annotations.version, '1.0.0');
    });

    it('should extract description from package.json', () => {
      const packageJson = {
        description: 'A test package',
      };
      const annotations = extractAnnotationsFromPackageJson(packageJson);
      strictEqual(annotations.description, 'A test package');
    });

    it('should extract string author from package.json', () => {
      const packageJson = {
        author: 'John Doe <john@example.com>',
      };
      const annotations = extractAnnotationsFromPackageJson(packageJson);
      strictEqual(annotations.authors, 'John Doe <john@example.com>');
    });

    it('should extract object author from package.json', () => {
      const packageJson = {
        author: {
          name: 'John Doe',
          email: 'john@example.com',
        },
      };
      const annotations = extractAnnotationsFromPackageJson(packageJson);
      strictEqual(annotations.authors, 'John Doe <john@example.com>');
    });

    it('should extract authors array from package.json', () => {
      const packageJson = {
        authors: [
          { name: 'John Doe', email: 'john@example.com' },
          'Jane Smith <jane@example.com>',
        ],
      };
      const annotations = extractAnnotationsFromPackageJson(packageJson);
      strictEqual(
        annotations.authors,
        'John Doe <john@example.com>, Jane Smith <jane@example.com>'
      );
    });

    it('should extract license from package.json', () => {
      const packageJson = {
        license: 'MIT',
      };
      const annotations = extractAnnotationsFromPackageJson(packageJson);
      strictEqual(annotations.licenses, 'MIT');
    });

    it('should extract homepage from package.json', () => {
      const packageJson = {
        homepage: 'https://example.com',
      };
      const annotations = extractAnnotationsFromPackageJson(packageJson);
      strictEqual(annotations.homepage, 'https://example.com');
    });

    it('should extract repository URL string from package.json', () => {
      const packageJson = {
        repository: 'https://github.com/user/repo',
      };
      const annotations = extractAnnotationsFromPackageJson(packageJson);
      strictEqual(annotations.source, 'https://github.com/user/repo');
    });

    it('should extract repository URL object from package.json', () => {
      const packageJson = {
        repository: {
          type: 'git',
          url: 'https://github.com/user/repo.git',
        },
      };
      const annotations = extractAnnotationsFromPackageJson(packageJson);
      strictEqual(annotations.source, 'https://github.com/user/repo.git');
    });

    it('should extract all fields from package.json', () => {
      const packageJson = {
        version: '2.1.0',
        description: 'Full package',
        author: 'Author Name',
        license: 'Apache-2.0',
        homepage: 'https://homepage.com',
        repository: 'https://github.com/user/repo',
      };
      const annotations = extractAnnotationsFromPackageJson(packageJson);
      deepStrictEqual(annotations, {
        version: '2.1.0',
        description: 'Full package',
        authors: 'Author Name',
        licenses: 'Apache-2.0',
        homepage: 'https://homepage.com',
        source: 'https://github.com/user/repo',
      });
    });
  });

  describe('addOCIAnnotations', () => {
    it('should return original component if no annotations', () => {
      // Create a minimal WebAssembly component header
      const component = new Uint8Array([
        0x00, 0x61, 0x73, 0x6d, // magic
        0x0d, 0x00, 0x01, 0x00, // version (component layer)
        0x01, 0x03, 0x00, 0x01, 0x00, // minimal section
      ]);
      const result = addOCIAnnotations(component, {});
      strictEqual(result, component);
    });

    it('should add version custom section', () => {
      const component = new Uint8Array([
        0x00, 0x61, 0x73, 0x6d, // magic
        0x0d, 0x00, 0x01, 0x00, // version (component layer)
      ]);
      const result = addOCIAnnotations(component, { version: '1.0.0' });

      // Verify magic and version are preserved
      strictEqual(result[0], 0x00);
      strictEqual(result[1], 0x61);
      strictEqual(result[2], 0x73);
      strictEqual(result[3], 0x6d);
      strictEqual(result[4], 0x0d);
      strictEqual(result[5], 0x00);
      strictEqual(result[6], 0x01);
      strictEqual(result[7], 0x00);

      // Custom section should be added after header
      // Section ID 0 for custom section
      strictEqual(result[8], 0x00);

      // Verify the result is larger than original
      strictEqual(result.length > component.length, true);
    });

    it('should add multiple annotations', () => {
      const component = new Uint8Array([
        0x00, 0x61, 0x73, 0x6d, // magic
        0x0d, 0x00, 0x01, 0x00, // version
      ]);
      const result = addOCIAnnotations(component, {
        version: '1.0.0',
        description: 'Test',
      });

      // Should be significantly larger due to two custom section entries
      strictEqual(result.length > component.length + 20, true);
    });

    it('should preserve component content after custom sections', () => {
      const component = new Uint8Array([
        0x00, 0x61, 0x73, 0x6d, // magic
        0x0d, 0x00, 0x01, 0x00, // version
        0x01, 0x03, 0x00, 0x01, 0x00, // some content
      ]);
      const result = addOCIAnnotations(component, { version: '1.0.0' });

      // Last 5 bytes should be preserved
      const originalEnd = Array.from(component.slice(-5));
      const resultEnd = Array.from(result.slice(-5));
      deepStrictEqual(resultEnd, originalEnd);
    });
  });
});
