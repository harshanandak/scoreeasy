import '@testing-library/jest-dom';
import { configure } from '@testing-library/dom';
import { webcrypto } from 'node:crypto';

Object.defineProperty(globalThis.crypto, 'subtle', { configurable: true, value: webcrypto.subtle });

configure({ asyncUtilTimeout: 5000 });
