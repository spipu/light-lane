/**
 * The catalogue of row patterns (generation § 4.3, § 4.4): Id, the elements by lane from left to right ('.' free; the
 * codes of LightLaneTuning.OBSTACLES; 'R' prowler; 'T<' / 'T>' stalker), the lowest tier, the weight, and the coins
 * the pattern carries (arc over its hurdle, a line, coins at its centre). A pattern of 3 lanes is laid on 3 consecutive
 * lanes; the centre element of a corridor (K4, K5, G4) is centred along its blocks.
 */
class LightLanePatterns {
    /**
     * @param {string} id
     * @returns {{id: string, lanes: string[], tier: int, weight: number, coins: string|null, corridor: boolean}|undefined}
     */
    static get(id) {
        return LightLanePatterns.BY_ID.get(id);
    }

    /**
     * @param {string[]} lanes
     * @returns {string[]} the same pattern mirrored (left ↔ right, T< ↔ T>)
     */
    static mirror(lanes) {
        return lanes.slice().reverse().map((code) => ((code === 'T<') ? 'T>' : ((code === 'T>') ? 'T<' : code)));
    }
}

// [Id, elements, tier, weight, coins: 'arc' over the hurdle, 'line' on the free centre, 'centre' along the corridor]
LightLanePatterns.TABLE = Object.freeze([
    ['S1', 'H . .', 0, 10], ['S2', '. H .', 0, 10], ['S3', 'P . .', 0, 10], ['S4', '. P .', 0, 10],
    ['S5', 'H . .', 0, 6, 'arc'], ['S6', '. . .', 0, 4, 'line'],
    ['D1', 'H H .', 1, 8], ['D2', 'H . H', 1, 8], ['D3', 'P P .', 1, 8], ['D4', 'H P .', 1, 6], ['D5', 'P . H', 1, 6],
    ['A1', 'H H H', 2, 5], ['A2', 'P P P', 2, 5], ['A3', 'H P H', 2, 4], ['A4', 'P H P', 2, 4],
    ['K1', 'B3 . .', 1, 8], ['K2', 'B6 . B6', 1, 6], ['K3', 'B3 B3 .', 1, 6], ['K4', 'B6 H B6', 2, 4], ['K5', 'B6 P B6', 2, 4],
    ['L1', 'B10 . B10', 2, 5], ['L2', 'B16 . .', 2, 4], ['L3', 'B10 . H', 2, 4], ['L4', 'B16 . B16', 2, 3, 'centre'], ['L5', 'B10 B10 .', 2, 3],
    ['E1', 'R . .', 3, 8], ['E2', '. R .', 3, 8], ['E3', 'R . B6', 3, 5], ['E4', 'R H .', 3, 5], ['E5', 'R P .', 3, 5], ['E6', 'R . R', 3, 3],
    ['G1', 'X3 . .', 4, 7], ['G2', '. X3 .', 4, 7], ['G3', 'X5 X5 .', 4, 4], ['G4', 'B6 X3 B6', 4, 3], ['G5', 'X3 H .', 4, 4],
    ['C1', 'T> . .', 5, 6], ['C2', '. T< .', 5, 6], ['C3', 'T> . B6', 5, 4], ['C4', 'R . T<', 5, 3],
    ['M1', 'R X3 P', 7, 3], ['M2', 'B10 H R', 7, 3], ['M3', 'P R X3', 7, 3],
    ['F1', 'H . P . H', 2, 6], ['F2', 'B6 . B6 . B6', 2, 5], ['F3', '. H H H .', 2, 5], ['F4', 'P P . P P', 2, 4],
    ['F5', 'R . . . R', 3, 5], ['F6', 'B10 . R . B10', 3, 3], ['F7', 'X3 . H . X3', 4, 4], ['F8', 'T> . B6 . T<', 5, 3],
].map(([id, elements, tier, weight, coins]) => {
    const lanes = elements.split(' ');

    return Object.freeze({
        id:       id,
        lanes:    Object.freeze(lanes),
        tier:     tier,
        weight:   weight,
        coins:    (coins ?? null),
        corridor: ((lanes.length === 3) && lanes[0].startsWith('B') && (lanes[0] === lanes[2]) && (lanes[1] !== '.'))
    });
}));
LightLanePatterns.BY_ID = new Map(LightLanePatterns.TABLE.map((pattern) => [pattern.id, pattern]));
// The enemies' codes: rows holding one are left out of the draw until plan step 11 brings the enemies.
LightLanePatterns.ENEMIES = Object.freeze(['R', 'T<', 'T>']);
