// Palette, superfici, decorazioni e sagome di ogni ambiente sono definite insieme.
// Gli indici dei tre temi originali restano stabili; il percorso alterna vecchi e nuovi.
export const THEMES = [
    { id: 'city', name: 'SUNSET CITY', sky: 0xd39c98, fog: 0xd3a6a0, road: 0x344654, ground: 0x846e73, primary: 0x628e9a, secondary: 0xd58375, accent: 0x8bffd1, sun: 0xffd7a2,
        textures: ['city_facade_a', 'city_facade_b', 'city_road', 'city_sidewalk'],
        props: [['prop_city_lamp', 4.6], ['prop_city_tree', 4.2], ['prop_city_busstop', 2.8], ['prop_city_sign', 4]],
        roofs: [0xf3dcc0, 0xd8c3a6], height: 1, width: 1, buildings: true, streetlights: true, windows: true },
    { id: 'desert', name: 'DUST VALLEY', sky: 0xe9b783, fog: 0xe6b580, road: 0x776758, ground: 0xbb895d, primary: 0xb57953, secondary: 0xdfa66d, accent: 0xffdc82, sun: 0xffedb7,
        textures: ['desert_facade_a', 'desert_facade_b', 'desert_road', 'desert_ground'],
        props: [['prop_desert_cactus', 3.4], ['prop_desert_tree', 3.6], ['prop_desert_barrels', 1.7], ['prop_desert_sign', 2.6]],
        roofs: [0xc9774a, 0xa85f3a], height: .35, width: 1, buildings: true, streetlights: true, windows: false },
    { id: 'neon', name: 'NEON OUTPOST', sky: 0x172e49, fog: 0x263e5b, road: 0x293849, ground: 0x22384d, primary: 0x365777, secondary: 0x526087, accent: 0x79f3e5, sun: 0x9fcfe7,
        textures: ['neon_facade_a', 'neon_facade_b', 'neon_road', 'neon_plates'],
        props: [['prop_neon_antenna', 4.8], ['prop_neon_holo', 3.4], ['prop_neon_pylon', 4.6], ['prop_neon_canisters', 3.6]],
        roofs: [0x34466a, 0x23314d], height: 1.15, width: .7, buildings: true, streetlights: true, windows: true },
    { id: 'forest', name: 'FORESTA DELLE ROVINE', sky: 0x91b8aa, fog: 0xa0b9a0, road: 0x655f49, ground: 0x536a39, primary: 0x768164, secondary: 0x586a4d, accent: 0xd8d9a0, sun: 0xffe7b1,
        textures: ['forest_facade_a', 'forest_facade_b', 'forest_road', 'forest_ground'],
        props: [['prop_forest_tree', 7], ['prop_forest_arch', 4.2], ['prop_forest_pillar', 3.8], ['prop_forest_ferns', 1.6]],
        roofs: [0x7e8865, 0x596747], height: .22, width: .8, buildings: true, streetlights: false, windows: false, natural: true },
    { id: 'volcano', name: 'VALLE VULCANICA', sky: 0x73545a, fog: 0x947063, road: 0x38343b, ground: 0x43383b, primary: 0x45414a, secondary: 0x65504b, accent: 0xffb365, sun: 0xffad72,
        textures: ['volcano_facade_a', 'volcano_facade_b', 'volcano_road', 'volcano_ground'],
        props: [['prop_volcano_basalt', 5], ['prop_volcano_vent', 3], ['prop_volcano_tree', 4.3], ['prop_volcano_crystals', 2]],
        roofs: [0x65504b, 0x473d44], height: 0, width: 0, buildings: false, streetlights: false, windows: false, natural: true },
    { id: 'snow', name: 'VETTE INNEVATE', sky: 0xa8c9dc, fog: 0xc3d9e4, road: 0x8196a9, ground: 0xe1edf2, primary: 0x657f99, secondary: 0x9ebacb, accent: 0x506b87, sun: 0xfff5da,
        textures: ['snow_facade_a', 'snow_facade_b', 'snow_road', 'snow_ground'],
        props: [['prop_snow_fir', 6.5], ['prop_snow_crystals', 3.8], ['prop_snow_sign', 2.8], ['prop_snow_rocks', 2.2]],
        roofs: [0xecf5f7, 0xbbd2e0], height: 0, width: 0, buildings: false, streetlights: false, windows: false, natural: true },
];
export const SCENERY_ROUTE = [0, 3, 1, 4, 2, 5];
export const sceneryAt = step => SCENERY_ROUTE[step % SCENERY_ROUTE.length];
export const SHARED_PROPS = [['prop_cone', .85], ['prop_block', 1], ['prop_bush', 1.2], ['prop_rocks', 1.4]];
