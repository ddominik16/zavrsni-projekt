// Zajednice dobivaju boju po redoslijedu velicine. Paleta je fiksna da
// ista zajednica uvijek ima istu boju na svim stranicama.

const PALETTE = [
  "#a8391f",
  "#c89b1e",
  "#10514e",
  "#2c4257",
  "#6a3550",
  "#5f6f33",
  "#a96f44",
  "#4e6e8e",
  "#7b5c8a",
  "#3f6b5f",
  "#8a6a2f",
  "#5a5a5a",
];

export function buildColorMap(communityIds) {
  const map = new Map();
  communityIds.forEach((id, i) => {
    map.set(id, PALETTE[i % PALETTE.length]);
  });
  return map;
}

export function colorFor(map, communityId) {
  return map.get(communityId) || "#9aa093";
}

export { PALETTE };
