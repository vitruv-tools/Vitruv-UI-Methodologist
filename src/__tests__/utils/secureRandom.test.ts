import { ECORE_XML_NAMESPACE, XSI_XML_NAMESPACE } from '../../utils/ecoreXmlNamespaces';
import { randomUniqueSuffix } from '../../utils/secureRandom';

describe('ecoreXmlNamespaces', () => {
  it('exports standard EMF/XSD namespace URIs', () => {
    expect(ECORE_XML_NAMESPACE).toBe('http://www.eclipse.org/emf/2002/Ecore');
    expect(XSI_XML_NAMESPACE).toBe('http://www.w3.org/2001/XMLSchema-instance');
  });
});

describe('randomUniqueSuffix', () => {
  beforeAll(() => {
    if (!(globalThis as { crypto?: Crypto }).crypto) {
      Object.defineProperty(globalThis, 'crypto', {
        value: {
          randomUUID: () => `test-${Math.random().toString(36).slice(2)}`,
          getRandomValues: (arr: Uint32Array) => {
            arr[0] = 123456;
            arr[1] = 789012;
            return arr;
          },
        },
      });
    }
  });

  it('returns distinct values', () => {
    const a = randomUniqueSuffix();
    const b = randomUniqueSuffix();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });
});
