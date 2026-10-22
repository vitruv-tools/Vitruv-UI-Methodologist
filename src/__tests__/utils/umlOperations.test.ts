import { ecoreToUml } from '../../utils/ecoreToUml';
import { umlToEcore } from '../../utils/umlToEcore';

const wrap = (inner: string) => `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"
                name="test">
  ${inner}
</ecore:EPackage>`;

describe('UML operations round-trip', () => {
  it('imports eOperations into the UML model', () => {
    const xml = wrap(`
      <eClassifiers xsi:type="ecore:EClass" name="Service">
        <eOperations name="run" eType="//EVoid"/>
        <eOperations name="getCount" eType="//EInt"/>
      </eClassifiers>
    `);
    const { classes } = ecoreToUml(xml);
    expect(classes[0].operations.map(o => o.name)).toEqual(['run', 'getCount']);
    expect(classes[0].operations[0].returnType).toBe('Void');
    expect(classes[0].operations[1].returnType).toBe('Int');
  });

  it('serializes operations back to ecore', () => {
    const model = ecoreToUml(wrap(`<eClassifiers xsi:type="ecore:EClass" name="X"/>`));
    model.classes[0].operations = [{
      id: 'x-op-0', name: 'execute', returnType: 'Void', visibility: '+',
    }];
    const xml = umlToEcore(model);
    expect(xml).toContain('name="execute"');
    expect(xml).toContain('eOperations');
  });
});
