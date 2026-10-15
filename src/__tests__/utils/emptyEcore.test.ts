import { createEmptyEcore, createEmptyEcoreFile, toEPackageName } from '../../utils/emptyEcore';
import { ecoreToUml } from '../../utils/ecoreToUml';
import { umlToEcore } from '../../utils/umlToEcore';

const parseRootPackage = (xml: string): Element => {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
  return doc.documentElement;
};

describe('toEPackageName', () => {
  it.each([
    ['Families', 'families'],
    ['Family Tree', 'familytree'],
    ['  UML 2.5 (draft) ', 'uml25draft'],
    ['Família Größe', 'familiagroe'],
    ['2nd model', '_2ndmodel'],
    ['---', 'model'],
    ['', 'model'],
  ])('turns %p into %p', (input, expected) => {
    expect(toEPackageName(input)).toBe(expected);
  });
});

describe('createEmptyEcore', () => {
  it('is a single EPackage without classifiers', () => {
    const root = parseRootPackage(createEmptyEcore('Family Tree'));

    expect(root.tagName).toBe('ecore:EPackage');
    expect(root.getAttribute('name')).toBe('familytree');
    expect(root.getAttribute('nsURI')).toBe('http://www.example.org/familytree');
    expect(root.getAttribute('nsPrefix')).toBe('familytree');
    expect(root.getAttribute('xmlns:ecore')).toBe('http://www.eclipse.org/emf/2002/Ecore');
    expect(root.children).toHaveLength(0);
  });

  it('keeps its package identity when the editor saves classes into it', () => {
    const empty = createEmptyEcore('Family Tree');
    const model = ecoreToUml(empty);
    expect(model).toEqual({ classes: [], relationships: [] });

    const saved = umlToEcore(
      {
        classes: [{
          id: 'Person', name: 'Person', isAbstract: false, isInterface: false,
          attributes: [], operations: [], x: 0, y: 0,
        }],
        relationships: [],
      },
      empty,
    );

    const root = parseRootPackage(saved);
    expect(root.getAttribute('name')).toBe('familytree');
    expect(root.getAttribute('nsURI')).toBe('http://www.example.org/familytree');
    expect(root.getAttribute('nsPrefix')).toBe('familytree');
    expect(ecoreToUml(saved).classes.map(c => c.name)).toEqual(['Person']);
  });
});

describe('createEmptyEcoreFile', () => {
  it('names the file after the package', () => {
    const file = createEmptyEcoreFile('Family Tree');

    expect(file.name).toBe('familytree.ecore');
    expect(file.type).toBe('application/xml');
    expect(file.size).toBe(new Blob([createEmptyEcore('Family Tree')]).size);
  });
});
