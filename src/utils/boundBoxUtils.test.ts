import { calculateAndUpdateBoundingBoxes } from "./boundingBoxUtils";

test("bug-boundingBoxUtils-undefined-rearrangeKey", () => {
  const boxes = [
    {
      rearrangeKey: "CAD.ecore",
      left: 285,
      right: 1865,
      top: -2197.9784313032787,
      bottom: -811.9864779983675,
    },
    {
      rearrangeKey: "model.ecore",
      left: 1077.7281956034262,
      right: 3745.367817365809,
      top: -811.9864779983675,
      bottom: 782.8883270046923,
    },
    {
      rearrangeKey: "model2.ecore",
      left: 130,
      right: 1469.7281956034262,
      top: -763.2278572155034,
      bottom: 737.6157116063195,
    },
  ];
  const offsets = calculateAndUpdateBoundingBoxes(boxes);
  expect(offsets).toBeDefined();
  //@ts-expect-error
  expect(offsets.includes(undefined)).toBe(false);
});
