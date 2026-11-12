import type { SiteInput } from '../../lib/site.ts';

// Variant "online": no address and no service area -> Organization with url and contactPoint (ADR-0035).
// Its AI crawler policy is "block" so the example set exercises both values of the setting (FR-006).
export default {
  $comment:
    'FICTITIOUS example business for the template, invented: not a real client. Every name, phone and ' +
    'profile is made up. In a client site this data comes from the confirmed brief.',
  site: { url: 'https://hoja-suelta.example', aiCrawlers: 'block' },
  exampleNotice: 'Sitio de ejemplo de la plantilla: el negocio y sus datos son ficticios.',
  name: 'Encuadernación Hoja Suelta',
  tagline: 'Cuadernos cosidos a mano, con envío a todo el país.',
  about:
    'Hacemos cuadernos y libretas cosidos a mano, por encargo. Vendemos solo en línea: elegís el modelo, lo armamos y lo despachamos por correo.',
  phone: {
    display: '+54 11 0000-2222',
    e164: '+541100002222',
    whatsapp: false,
    source: 'ejemplo: formulario del brief',
    confirmed: true,
  },
  email: { address: 'pedidos@hoja-suelta.example', source: 'ejemplo: formulario del brief', confirmed: true },
  hours: [
    {
      label: 'Lunes a viernes',
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '10:00',
      closes: '17:00',
      source: 'ejemplo: formulario del brief',
      confirmed: true,
    },
  ],
  profiles: [{ url: 'https://social-uno.example/hojasuelta', source: 'ejemplo: brief', confirmed: true }],
  image: { alt: 'Ilustración de cuadernos cosidos a mano apilados sobre una mesa' },
} satisfies SiteInput;
