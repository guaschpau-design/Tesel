// A search along the old Turia riverbed in Valencia: a sector being searched by a team, a meeting
// point, a first-aid post and a closed path, what each member carries, a medical SOS acknowledged
// by a teammate and a report of it, and the team's chat. Everyone keeps to the riverbed's park,
// open ground with paths. It is the operation the site's screenshots show; Ana, the coordinator,
// is the browser. The team writes in Spanish, or in English for the English site (ADR-0143).

import { ShapeStyleCode, SymbolCode } from '@tesel/protocol';
import type { Scenario } from '@tesel/scenario';

/** The languages the team can write in: those of the site. */
export type TuriaLanguage = 'es' | 'en';

/** Everything the team writes, in each language. */
const WORDS = {
  es: {
    description: 'Búsqueda en el antiguo cauce del Turia, en Valencia, con un SOS médico.',
    sector: 'Sector 2',
    meetingPoint: 'Punto de encuentro',
    firstAid: 'Puesto sanitario',
    closedPath: 'Paso cortado',
    team: 'Norte',
    task: 'Batir el sector 2',
    luis: 'Empiezo el sector 2 por el puente. Sin novedad.',
    carmen: 'Puesto sanitario montado junto a la pasarela.',
    sos: 'Torcedura, no puedo apoyar el pie',
    jordi: 'Voy hacia Marta, llego en 4 minutos.',
    report: 'Torcedura de tobillo junto al puente',
    ana: 'Reagrupamos en el punto de encuentro en 30 minutos',
  },
  en: {
    description: 'A search in the old Turia riverbed, in Valencia, with a medical SOS.',
    sector: 'Sector 2',
    meetingPoint: 'Meeting point',
    firstAid: 'First-aid post',
    closedPath: 'Path closed',
    team: 'North',
    task: 'Sweep sector 2',
    luis: 'Starting sector 2 from the bridge. All clear.',
    carmen: 'First-aid post set up by the footbridge.',
    sos: 'Sprained ankle, I can’t put weight on my foot',
    jordi: 'Heading to Marta, there in 4 minutes.',
    report: 'Sprained ankle by the bridge',
    ana: 'Regroup at the meeting point in 30 minutes',
  },
} as const;

/** What Ana, the coordinator in the browser, tells the team (tools/simulator/src/screenshots.ts). */
export function anasMessage(language: TuriaLanguage): string {
  return WORDS[language].ana;
}

export const turia = turiaIn('es');
export const turiaInEnglish = turiaIn('en');

function turiaIn(language: TuriaLanguage): Scenario {
  const words = WORDS[language];
  return {
    name: language === 'es' ? 'turia' : 'turia-en',
    description: words.description,
    center: { lat: 39.4781, lon: -0.3745 },
    duration: 360,
    members: [
      {
        alias: 'Luis',
        route: [
          { lat: 39.4801, lon: -0.3731 },
          { lat: 39.4796, lon: -0.3716 },
        ],
        speed: 0.5,
      },
      { alias: 'Jordi', route: [{ lat: 39.4766, lon: -0.3768 }] },
      { alias: 'Carmen', route: [{ lat: 39.4799, lon: -0.3786 }] },
      { alias: 'Marta', route: [{ lat: 39.4771, lon: -0.3714 }], hidden: true },
    ],
    steps: [
      ...(
        [
          ['Luis', 'rescue', ['rope', 'radio', 'light'], 91],
          ['Jordi', 'volunteer', ['light', 'water'], 64],
          ['Carmen', 'medical', ['first-aid', 'stretcher'], 78],
          ['Marta', 'volunteer', ['water'], 55],
        ] as const
      ).map(([by, profile, equipment, battery]) => ({
        at: 0,
        by,
        action: { type: 'state', profile, status: 'active', battery, equipment } as const,
      })),
      {
        at: 0,
        by: 'Luis',
        action: {
          type: 'shape',
          id: 'sector-2',
          style: ShapeStyleCode.SEARCH_ASSIGNED,
          label: words.sector,
          geometry: {
            kind: 'polygon',
            points: [
              { lat: 39.4797, lon: -0.3744 },
              { lat: 39.4791, lon: -0.3699 },
              { lat: 39.4763, lon: -0.3703 },
              { lat: 39.4767, lon: -0.3749 },
            ],
          },
        },
      },
      {
        at: 5,
        by: 'Carmen',
        action: {
          type: 'marker',
          id: 'meeting-point',
          symbol: SymbolCode.MEETING_POINT,
          label: words.meetingPoint,
          where: { lat: 39.4794, lon: -0.3763 },
        },
      },
      {
        at: 10,
        by: 'Carmen',
        action: {
          type: 'marker',
          id: 'first-aid',
          symbol: SymbolCode.MEDICAL_POST,
          label: words.firstAid,
          where: { lat: 39.4787, lon: -0.3786 },
        },
      },
      {
        at: 15,
        by: 'Luis',
        action: {
          type: 'marker',
          id: 'closed-path',
          symbol: SymbolCode.BLOCKED_ROAD,
          label: words.closedPath,
          where: { lat: 39.4779, lon: -0.3727 },
        },
      },
      {
        at: 20,
        by: 'Luis',
        action: {
          type: 'team',
          id: 'north',
          name: words.team,
          colour: 'blue',
          members: ['Luis', 'Jordi'],
        },
      },
      {
        at: 25,
        by: 'Luis',
        action: {
          type: 'task',
          id: 'sector-2-task',
          text: words.task,
          assignee: 'north',
          place: { kind: 'object', id: 'sector-2' },
        },
      },
      {
        at: 55,
        by: 'Luis',
        action: { type: 'task-status', of: 'sector-2-task', status: 'in-progress' },
      },
      {
        at: 60,
        by: 'Luis',
        action: { type: 'chat', text: words.luis },
      },
      {
        at: 120,
        by: 'Carmen',
        action: { type: 'chat', text: words.carmen },
      },
      {
        at: 300,
        by: 'Marta',
        action: {
          type: 'sos',
          id: 'marta',
          kind: 'medical',
          text: words.sos,
        },
      },
      { at: 330, by: 'Jordi', action: { type: 'ack', of: 'marta' } },
      {
        at: 340,
        by: 'Jordi',
        action: { type: 'chat', text: words.jordi },
      },
      {
        at: 350,
        by: 'Carmen',
        action: {
          type: 'report',
          incident: 'medical',
          hazards: [],
          access: 'clear',
          casualties: { red: null, yellow: 1, green: null, black: null },
          resources: ['ambulance'],
          note: words.report,
        },
      },
    ],
  };
}
