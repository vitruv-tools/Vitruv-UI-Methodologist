export interface UmlModelGroupInfo {
  name: string;
  color: string;
  fill: string;
}

export interface UmlModelGroupClass {
  id: string;
  x: number;
  y: number;
  isAbstract: boolean;
  isInterface: boolean;
  attributes: ReadonlyArray<unknown>;
  operations?: ReadonlyArray<unknown>;
}

export interface UmlModelGroupBounds {
  name: string;
  color: string;
  fill: string;
  minX: number;
  minY: number;
  width: number;
  height: number;
}

const GROUP_PAD = 20;
const GROUP_HEADER = 24;

export function computeUmlModelGroups<T extends UmlModelGroupClass>(
  classes: T[],
  classModelMap: Map<string, UmlModelGroupInfo>,
  classBoxHeight: (c: T) => number,
  boxWidth: number,
): UmlModelGroupBounds[] {
  const groups = new Map<string, { cls: T[]; color: string; fill: string; name: string }>();

  for (const cls of classes) {
    const info = classModelMap.get(cls.id);
    if (!info) continue;
    if (!groups.has(info.name)) {
      groups.set(info.name, { cls: [], color: info.color, fill: info.fill, name: info.name });
    }
    groups.get(info.name)!.cls.push(cls);
  }

  return Array.from(groups.values()).flatMap(g => {
    if (g.cls.length === 0) return [];
    const minX = Math.min(...g.cls.map(c => c.x)) - GROUP_PAD;
    const minY = Math.min(...g.cls.map(c => c.y)) - GROUP_PAD - GROUP_HEADER;
    const maxX = Math.max(...g.cls.map(c => c.x + boxWidth)) + GROUP_PAD;
    const maxY = Math.max(...g.cls.map(c => c.y + classBoxHeight(c))) + GROUP_PAD;
    return [{
      name: g.name,
      color: g.color,
      fill: g.fill,
      minX,
      minY,
      width: maxX - minX,
      height: maxY - minY,
    }];
  });
}
