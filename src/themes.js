// Fargepaletter. Hver palett mates inn i buildStyle() i style.js, som bygger et
// komplett MapLibre-stilark av den. Legg til et tema = legg til ett objekt her.
//
// Feltene under er de eneste knaggene style.js kjenner til. Vil du ha et nytt
// kartelement farget separat, må feltet legges til her OG brukes i style.js.
//
// Oppskriften som fungerer best (Kobber, Blue World, Terrakotta, Fjord):
//   * Én rolig base. Land, grønt, arealbruk og bygg ligger bare små lyssteg
//     fra hverandre, så de blir tekstur, ikke motiv.
//   * Vann i en tydelig annen tone enn land, så kystlinja tegner formen.
//   * Veiene er den eneste mettede fargen. Hovedvei mot arealbruk ligger rundt
//     4,75:1 i kontrast, lokalvei rundt 2,9:1. Høyere enn det og kartet blir
//     et nett av linjer; lavere og veiene forsvinner.
//   * Kantlinjen på veiene er lik bakgrunnen, ikke en egen farge.
//   * Plakatteksten bruker samme aksent som hovedveiene.

/**
 * @typedef {Object} Palette
 * @property {string} id
 * @property {string} name
 * @property {string} background      land / papir
 * @property {string} water
 * @property {string} waterway        elver og bekker
 * @property {string} green           skog, park, gress
 * @property {string} landuse         bebygde flater, industri
 * @property {string} building
 * @property {string} buildingLine
 * @property {string} roadMajor       motorvei, riksvei
 * @property {string} roadMajorLine   kantlinje
 * @property {string} roadMinor       lokalveier
 * @property {string} roadMinorLine
 * @property {string} path            sti, gangvei
 * @property {string} rail
 * @property {string} boundary
 * @property {string} text
 * @property {string} textHalo
 * @property {string} ink             plakattekst under kartet
 * @property {string} paper           plakatbakgrunn
 */

/** @type {Palette[]} Mørke temaer først, så lyse. */
export const THEMES = [
  // ------------------------------------------------------------ mørke
  {
    id: 'kobber',
    name: 'Kobber',
    background: '#1C1714',
    water: '#0E0C0B',
    waterway: '#141110',
    green: '#201A16',
    landuse: '#221B17',
    building: '#2A211B',
    buildingLine: '#3A2C23',
    roadMajor: '#C87137',
    roadMajorLine: '#1C1714',
    roadMinor: '#8A5A38',
    roadMinorLine: '#1C1714',
    path: '#5C4030',
    rail: '#6B4A36',
    boundary: '#4A3527',
    text: '#D9BFA7',
    textHalo: '#1C1714',
    ink: '#C87137',
    paper: '#1C1714',
  },
  {
    // Kobber i blått.
    id: 'blueworld',
    name: 'Blue World',
    background: '#141C28',
    water: '#0A0F17',
    waterway: '#101826',
    green: '#172131',
    landuse: '#18222F',
    building: '#1F2B3C',
    buildingLine: '#2A3A50',
    roadMajor: '#5C90C7',
    roadMajorLine: '#141C28',
    roadMinor: '#3F6690',
    roadMinorLine: '#141C28',
    path: '#2E4A6A',
    rail: '#36517A',
    boundary: '#2E4560',
    text: '#B9CCE0',
    textHalo: '#141C28',
    ink: '#8DB8E3',
    paper: '#141C28',
  },
  {
    id: 'nordlys',
    name: 'Nordlys',
    background: '#2E2E33',
    water: '#071026',
    waterway: '#0C1B36',
    green: '#222C22',
    landuse: '#31353F',
    building: '#3A3A44',
    buildingLine: '#45454F',
    roadMajor: '#5C5C68',
    roadMajorLine: '#2E2E33',
    roadMinor: '#44444E',
    roadMinorLine: '#2E2E33',
    path: '#4A4A54',
    rail: '#55555F',
    boundary: '#6A6A76',
    text: '#C8C8D2',
    textHalo: '#1F1F24',
    ink: '#EDEDF2',
    paper: '#2E2E33',
  },
  {
    id: 'blaakopi',
    name: 'Blåkopi',
    background: '#0D3B66',
    water: '#08294A',
    waterway: '#0A3157',
    green: '#0F4373',
    landuse: '#10416D',
    building: '#14508A',
    buildingLine: '#1D66AD',
    roadMajor: '#E6F1FF',
    roadMajorLine: '#0D3B66',
    roadMinor: '#9EC3E8',
    roadMinorLine: '#0D3B66',
    path: '#5E93C4',
    rail: '#7FAAD6',
    boundary: '#5E93C4',
    text: '#E6F1FF',
    textHalo: '#0D3B66',
    ink: '#E6F1FF',
    paper: '#0D3B66',
  },
  {
    id: 'blekk',
    name: 'Blekk',
    background: '#0F1116',
    water: '#05070C',
    waterway: '#0A0E16',
    green: '#141821',
    landuse: '#151820',
    building: '#1B1F29',
    buildingLine: '#242A36',
    roadMajor: '#E8E4DA',
    roadMajorLine: '#0F1116',
    roadMinor: '#7C8494',
    roadMinorLine: '#0F1116',
    path: '#4A5160',
    rail: '#5A6172',
    boundary: '#3A4150',
    text: '#D8D4CA',
    textHalo: '#0F1116',
    ink: '#EFEBE1',
    paper: '#0F1116',
  },
  {
    id: 'midnatt',
    name: 'Midnatt',
    background: '#10131A',
    water: '#161B26',
    waterway: '#1B2130',
    green: '#12161D',
    landuse: '#141821',
    building: '#1A1F2A',
    buildingLine: '#222938',
    roadMajor: '#F2C14E',
    roadMajorLine: '#10131A',
    roadMinor: '#5B6479',
    roadMinorLine: '#10131A',
    path: '#39414F',
    rail: '#454E5F',
    boundary: '#2C3340',
    text: '#AEB6C6',
    textHalo: '#10131A',
    ink: '#F2C14E',
    paper: '#10131A',
  },
  {
    id: 'skog',
    name: 'Skog',
    background: '#132C1F',
    water: '#0B2634',
    waterway: '#0E2E3F',
    green: '#17392A',
    landuse: '#163325',
    building: '#1D4431',
    buildingLine: '#27573F',
    roadMajor: '#D9E7C8',
    roadMajorLine: '#132C1F',
    roadMinor: '#7EA184',
    roadMinorLine: '#132C1F',
    path: '#4E7460',
    rail: '#5C8570',
    boundary: '#3C6350',
    text: '#CFE3CE',
    textHalo: '#132C1F',
    ink: '#E4F0DA',
    paper: '#132C1F',
  },
  {
    id: 'neon',
    name: 'Neon',
    background: '#0A0612',
    water: '#12082A',
    waterway: '#180B38',
    green: '#0E0A1C',
    landuse: '#110B22',
    building: '#1A0F33',
    buildingLine: '#2C1857',
    roadMajor: '#FF2E97',
    roadMajorLine: '#0A0612',
    roadMinor: '#22D3EE',
    roadMinorLine: '#0A0612',
    path: '#7C3AED',
    rail: '#A855F7',
    boundary: '#4C1D95',
    text: '#E9D5FF',
    textHalo: '#0A0612',
    ink: '#FF2E97',
    paper: '#0A0612',
  },

  // ------------------------------------------------------------- lyse
  {
    // Kobber på lyst papir, monokromt: alt ligger i samme terrakottatone
    // (18–30°), bare lysheten varierer. Vannet skilles fra land på lyshet
    // alene — ingen kjølig gråblå, ingen olivengrønn.
    id: 'terrakotta',
    name: 'Terrakotta',
    background: '#F4EBE3',
    water: '#E0C6B3',
    waterway: '#D6B49E',
    green: '#EBDDCF',
    landuse: '#EFE3D8',
    building: '#E6D5C6',
    buildingLine: '#DCC6B4',
    roadMajor: '#A5471F',
    roadMajorLine: '#F4EBE3',
    roadMinor: '#BB7450',
    roadMinorLine: '#F4EBE3',
    path: '#D9B49C',
    rail: '#C99A80',
    boundary: '#C9A28A',
    text: '#6B3A22',
    textHalo: '#F4EBE3',
    ink: '#A5471F',
    paper: '#F4EBE3',
  },
  {
    // Blue World på lyst papir: isblå base, tydelig fjordvann, dype blå veier.
    id: 'fjord',
    name: 'Fjord',
    background: '#EEF2F5',
    water: '#C3D3E0',
    waterway: '#B2C5D5',
    green: '#E1E8E6',
    landuse: '#E7ECF0',
    building: '#DCE3EA',
    buildingLine: '#CBD5DF',
    roadMajor: '#386A9B',
    roadMajorLine: '#EEF2F5',
    roadMinor: '#7090B0',
    roadMinorLine: '#EEF2F5',
    path: '#B4C4D4',
    rail: '#9DB1C6',
    boundary: '#A8B8C8',
    text: '#23405E',
    textHalo: '#EEF2F5',
    ink: '#23405E',
    paper: '#EEF2F5',
  },
  {
    // Det klassiske lyse kartet: hvite veier med grå kant. Leire lå for tett
    // opptil dette og er slått sammen hit.
    id: 'papir',
    name: 'Papir',
    background: '#F4F1EA',
    water: '#CFD9DF',
    waterway: '#BFCBD4',
    green: '#E2E6D8',
    landuse: '#EDE9E0',
    building: '#E4DFD4',
    buildingLine: '#D6D0C2',
    roadMajor: '#FFFFFF',
    roadMajorLine: '#C9C2B4',
    roadMinor: '#FFFFFF',
    roadMinorLine: '#D8D2C6',
    path: '#D0C9BA',
    rail: '#C4BDAE',
    boundary: '#B9B1A1',
    text: '#4A463E',
    textHalo: '#F4F1EA',
    ink: '#2C2A25',
    paper: '#F4F1EA',
  },
  {
    id: 'sepia',
    name: 'Sepia',
    background: '#EFE3D0',
    water: '#C8B99C',
    waterway: '#BCAC8D',
    green: '#DFD2B6',
    landuse: '#E8DBC5',
    building: '#DCCDB2',
    buildingLine: '#C9B896',
    roadMajor: '#FBF5EA',
    roadMajorLine: '#B7A484',
    roadMinor: '#F6EEE0',
    roadMinorLine: '#C4B393',
    path: '#BFAE8E',
    rail: '#AD9B7A',
    boundary: '#A8957A',
    text: '#5A4A32',
    textHalo: '#EFE3D0',
    ink: '#4A3C28',
    paper: '#EFE3D0',
  },
  {
    // Svart hav, hvitt land, svarte veier. Den gamle versjonen hadde lysegrått
    // vann på hvitt, så kystlinja — det som gir et kart form — nesten forsvant.
    id: 'minimal',
    name: 'Minimal',
    background: '#FFFFFF',
    water: '#1C1C1C',
    waterway: '#1C1C1C',
    green: '#F3F3F3',
    landuse: '#FAFAFA',
    building: '#EDEDED',
    buildingLine: '#E0E0E0',
    roadMajor: '#111111',
    roadMajorLine: '#FFFFFF',
    roadMinor: '#8A8A8A',
    roadMinorLine: '#FFFFFF',
    path: '#C2C2C2',
    rail: '#6E6E6E',
    boundary: '#BDBDBD',
    text: '#111111',
    textHalo: '#FFFFFF',
    ink: '#111111',
    paper: '#FFFFFF',
  },
];

export const THEMES_BY_ID = Object.fromEntries(THEMES.map((t) => [t.id, t]));

// Temaer som er fjernet, pekt til nærmeste gjenlevende. Uten dette ville et
// lagret oppsett med Leire eller Korall stille falt tilbake til første tema.
const RETIRED = {
  leire: 'papir',
  korall: 'terrakotta',
};

export function getTheme(id) {
  return THEMES_BY_ID[id] || THEMES_BY_ID[RETIRED[id]] || THEMES[0];
}
