// FICTITIOUS fixture (US-14 AC-2, AC-7): the address example plus two free sections (text and list), a logo for
// light and dark backgrounds, and unconfirmed optional data (an hours entry, a profile, a free section) that must
// not reach the HTML nor the JSON-LD. The section texts carry markup that must come out escaped.
import { readExample } from '../../lib/build.mjs';

const CONFIRMED = 'fixture: cliente inventado, por WhatsApp, 2026-01-01';

export const CONTENT = {
  sections: [
    { id: 'como-funciona', title: 'Cómo funciona <b>hoy</b>', body: 'Pedís antes de las 18 & retirás <i>mañana</i>.' },
    { id: 'que-incluye', title: 'Qué incluye', items: ['Pan <script>alert(1)</script>', 'Facturas & budines'] },
  ],
  logo: {
    light: 'src/assets/examples/logo-claro.svg',
    dark: 'src/assets/examples/logo-oscuro.svg',
    alt: 'Logo inventado de la panadería',
  },
  unconfirmed: {
    hours: { label: 'Feriados', days: ['Sunday'], opens: '09:00', closes: '12:00' },
    profile: 'https://social-cuatro.example/no-confirmado',
    section: { id: 'promociones', title: 'Promociones sin confirmar', body: 'Texto que no debe publicarse.' },
  },
};

const data = readExample('address');
data.brief.sections = [
  ...CONTENT.sections.map((s) => ({ ...s, source: 'fixture', confirmedBy: CONFIRMED })),
  { ...CONTENT.unconfirmed.section, source: 'fixture: borrador' },
];
data.brief.logo = { ...CONTENT.logo, source: 'fixture', confirmedBy: CONFIRMED };
data.brief.hours.push({ ...CONTENT.unconfirmed.hours, source: 'fixture: borrador' });
data.brief.profiles.push({ url: CONTENT.unconfirmed.profile, source: 'fixture: borrador' });
export default data;
