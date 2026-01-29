/**
 * Global polyfills for Node.js environment
 * MUST be imported FIRST before any other code
 */

// Polyfill fetch API (for node-fetch compatibility)
if (!globalThis.fetch) {
  const fetch = require('node-fetch');
  globalThis.fetch = fetch as any;
  globalThis.Headers = (fetch as any).Headers;
  globalThis.Request = (fetch as any).Request;
  globalThis.Response = (fetch as any).Response;
}

// Polyfill Web Streams API (for LangChain compatibility)
if (!globalThis.ReadableStream) {
  try {
    const { ReadableStream, WritableStream, TransformStream } = require('node:stream/web');
    globalThis.ReadableStream = ReadableStream as any;
    globalThis.WritableStream = WritableStream as any;
    globalThis.TransformStream = TransformStream as any;
  } catch (error) {
    console.warn('Warning: Could not load Web Streams API. Using fallback.');
    // Fallback for older Node versions
    try {
      const { ReadableStream, WritableStream, TransformStream } = require('web-streams-polyfill');
      globalThis.ReadableStream = ReadableStream as any;
      globalThis.WritableStream = WritableStream as any;
      globalThis.TransformStream = TransformStream as any;
    } catch (fallbackError) {
      console.error('Error: Could not load Web Streams polyfill. LangChain may not work correctly.');
    }
  }
}

// Polyfill Blob API (for undici/fetch compatibility)
if (!globalThis.Blob) {
  try {
    const { Blob } = require('node:buffer');
    globalThis.Blob = Blob as any;
  } catch (error) {
    console.warn('Warning: Could not load Blob API. Using fallback.');
    // Fallback: try to use from node-fetch or create a minimal implementation
    try {
      const fetch = require('node-fetch');
      if (fetch.Blob) {
        globalThis.Blob = fetch.Blob as any;
      }
    } catch (fallbackError) {
      console.error('Error: Could not load Blob polyfill. Some features may not work correctly.');
    }
  }
}

// Polyfill File API (for undici/fetch compatibility)
if (!globalThis.File) {
  try {
    const { File } = require('node:buffer');
    globalThis.File = File as any;
  } catch (error) {
    // File API not critical, skip warning
  }
}

// Polyfill FormData (for undici/fetch compatibility)
if (!globalThis.FormData) {
  try {
    const fetch = require('node-fetch');
    if (fetch.FormData) {
      globalThis.FormData = fetch.FormData as any;
    }
  } catch (error) {
    // FormData not critical, skip warning
  }
}

// Polyfill DOMException (for undici/WebSocket compatibility)
// This MUST be set before undici loads
if (typeof globalThis.DOMException === 'undefined') {
  // Node.js 18+ has DOMException as a global
  // Node.js 16-17 has it in util
  if (typeof DOMException !== 'undefined') {
    globalThis.DOMException = DOMException;
  } else {
    try {
      const util = require('node:util');
      if (util.DOMException) {
        globalThis.DOMException = util.DOMException;
      } else {
        throw new Error('DOMException not found in util');
      }
    } catch (error) {
      // Fallback: create a minimal DOMException implementation
      globalThis.DOMException = class DOMException extends Error {
        public code: number;
        constructor(message = '', name = 'Error') {
          super(message);
          this.name = name;
          this.code = 0;

          // Set error code based on name (standard DOMException codes)
          const codes: Record<string, number> = {
            IndexSizeError: 1,
            HierarchyRequestError: 3,
            WrongDocumentError: 4,
            InvalidCharacterError: 5,
            NoModificationAllowedError: 7,
            NotFoundError: 8,
            NotSupportedError: 9,
            InvalidStateError: 11,
            SyntaxError: 12,
            InvalidModificationError: 13,
            NamespaceError: 14,
            InvalidAccessError: 15,
            SecurityError: 18,
            NetworkError: 19,
            AbortError: 20,
            URLMismatchError: 21,
            QuotaExceededError: 22,
            TimeoutError: 23,
            InvalidNodeTypeError: 24,
            DataCloneError: 25,
          };

          this.code = codes[name] || 0;
        }
      } as any;
    }
  }
}
