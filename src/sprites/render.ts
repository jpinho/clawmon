import type { ClawmonBones, Eye, Hat, Species } from '../types.js';

// Each sprite is 5 lines tall. {E} is replaced with the eye character.
// Frame 0 is default idle. We only ship frame 0 for POC.
const BODIES: Partial<Record<Species, string[]>> = {
  compilox: [
    '            ',
    '   .---.    ',
    '   |{E}{E}|    ',
    '   |=====|  ',
    "   '---'    ",
  ],
  buggnaw: [
    '            ',
    '    /~~\\    ',
    '   ({E}{E})    ',
    '    (==)    ',
    '    /  \\    ',
  ],
  fernox: [
    '     ^^     ',
    '    (  )    ',
    '    ({E}{E})    ',
    '    {~~}    ',
    '     ..     ',
  ],
  glacielle: [
    '      *     ',
    '     / \\    ',
    '    ({E}{E})    ',
    '     \\=/    ',
    '      V     ',
  ],
  musinox: [
    '      o     ',
    '    .~~.    ',
    '   ({E}  {E})   ',
    '   (~~~~)   ',
    '    ~~~~    ',
  ],
  spectrox: [
    '            ',
    '   .----.   ',
    '  / {E}  {E} \\  ',
    '  |      |  ',
    "  ~`~``~`~  ",
  ],
  termikitty: [
    '            ',
    '   /\\_/\\    ',
    '  ( {E}   {E})  ',
    '  (  w  )   ',
    '  (")_(")   ',
  ],
  capybrix: [
    '            ',
    '  n______n  ',
    ' ( {E}    {E} ) ',
    ' (   oo   ) ',
    "  `------'  ",
  ],
  owlette: [
    '            ',
    '   /\\  /\\   ',
    '  (({E})({E}))  ',
    '  (  ><  )  ',
    "   `----'   ",
  ],
  penguink: [
    '            ',
    '  .---.     ',
    '  ({E}>{E})     ',
    ' /(   )\\    ',
    "  `---'     ",
  ],
  drakemaw: [
    '            ',
    '  /^\\  /^\\  ',
    ' <  {E}  {E}  > ',
    ' (   ~~   ) ',
    "  `-vvvv-'  ",
  ],
  ashphoenix: [
    '    /|\\     ',
    '   / | \\    ',
    '  ({E}   {E})   ',
    '  \\~~~~~//  ',
    '   \\^^^/    ',
  ],
  foxember: [
    '            ',
    '   /\\ /\\    ',
    '  ( {E} {E} )   ',
    '   ( v )    ',
    '    ~~~     ',
  ],
  snailore: [
    '            ',
    ' {E}    .--. ',
    '  \\  ( @ )  ',
    "   \\_`--'   ",
    '  ~~~~~~~   ',
  ],
  chronark: [
    '     @      ',
    '   .-|-.    ',
    '  ({E}   {E})   ',
    '  (12 6 )  ',
    "   '---'    ",
  ],
  deplorix: [
    '     A      ',
    '    /|\\     ',
    '   ({E}{E})     ',
    '   /||\\     ',
    '  ^^  ^^    ',
  ],
  kubrik: [
    '            ',
    '  [=====]   ',
    '  [{E}   {E}]  ',
    '  [=====]   ',
    '  [_____]   ',
  ],
  hashling: [
    '     #      ',
    '   .{=}.    ',
    '  ({E}   {E})   ',
    '  |#####|   ',
    "   '---'    ",
  ],
};

// Fallback for species without defined sprites
const FALLBACK: string[] = [
  '            ',
  '   .----.   ',
  '  ( {E}  {E} )  ',
  '  (      )  ',
  "   `----'   ",
];

const HAT_LINES: Record<Hat, string> = {
  none: '            ',
  crown: '   \\^^^/    ',
  tophat: '   [___]    ',
  propeller: '    -+-     ',
  halo: '   (   )    ',
  wizard: '    /^\\     ',
  beanie: '   (___)    ',
};

export function renderSprite(bones: ClawmonBones, _frame = 0): string[] {
  const body = (BODIES[bones.species] ?? FALLBACK).map(line =>
    line.replaceAll('{E}', bones.eye),
  );

  const lines = [...body];

  // Replace hat line if clawmon has a hat and line 0 is blank
  if (bones.hat !== 'none' && !lines[0]!.trim()) {
    lines[0] = HAT_LINES[bones.hat];
  }

  return lines;
}

export function renderFace(bones: ClawmonBones): string {
  const e = bones.eye;
  switch (bones.species) {
    case 'termikitty': return `=${e}w${e}=`;
    case 'capybrix': return `(${e}oo${e})`;
    case 'owlette': return `(${e})(${e})`;
    case 'drakemaw': return `<${e}~${e}>`;
    case 'spectrox': return `/${e}${e}\\`;
    case 'penguink': return `(${e}>)`;
    default: return `(${e}${e})`;
  }
}
