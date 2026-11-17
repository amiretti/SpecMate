import type { SiteInput } from '../../lib/site.ts';

// Variant "address": a business with a public street address -> LocalBusiness with address (ADR-0035).
export default {
  $comment:
    'FICTITIOUS example business for the template, invented: not a real client. Every name, phone, address, ' +
    'profile and question is made up. In a client site this data comes from the confirmed brief.',
  site: { url: 'https://horno-azul.example', aiCrawlers: 'allow' },
  exampleNotice: 'Sitio de ejemplo de la plantilla: el negocio y sus datos son ficticios.',
  name: 'Panadería El Horno Azul',
  tagline: 'Pan de masa madre horneado cada mañana en el barrio.',
  about:
    'Somos una panadería de barrio que hornea en tandas chicas: pan de masa madre, facturas y budines. Usamos harinas de molinos cercanos y fermentaciones largas.',
  phone: {
    display: '+54 11 0000-0000',
    e164: '+541100000000',
    whatsapp: true,
    source: 'ejemplo: formulario del brief',
    confirmed: true,
  },
  email: { address: 'hola@horno-azul.example', source: 'ejemplo: formulario del brief', confirmed: true },
  hours: [
    {
      label: 'Lunes a viernes',
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '07:00',
      closes: '20:00',
      source: 'ejemplo: cartel de la vidriera',
      confirmed: true,
    },
    {
      label: 'Sábados',
      days: ['Saturday'],
      opens: '08:00',
      closes: '14:00',
      source: 'ejemplo: cartel de la vidriera',
      confirmed: true,
    },
    { label: 'Domingos', days: ['Sunday'], source: 'ejemplo: cartel de la vidriera', confirmed: true },
  ],
  address: {
    street: 'Calle Ficticia 123',
    locality: 'Ciudad de Ejemplo',
    region: 'Provincia Inventada',
    postalCode: 'X0000',
    country: 'AR',
    source: 'ejemplo: formulario del brief',
    confirmed: true,
  },
  profiles: [
    { url: 'https://social-uno.example/hornoazul', source: 'ejemplo: brief', confirmed: true },
    { url: 'https://social-dos.example/@hornoazul', source: 'ejemplo: brief', confirmed: true },
    // Unconfirmed on purpose: it must not reach the site (FR-010).
    { url: 'https://social-tres.example/horno-azul-viejo', source: 'ejemplo: búsqueda web', confirmed: false },
  ],
  faq: [
    {
      question: '¿Hacen pedidos para eventos?',
      answer: 'Sí, con 48 horas de anticipación. Escribinos por WhatsApp con la cantidad y la fecha.',
      source: 'ejemplo: respuesta del cliente en el brief',
      confirmed: true,
    },
    {
      question: '¿Tienen pan sin TACC?',
      answer: 'No. Trabajamos con harina de trigo y no podemos garantizar un ambiente libre de gluten.',
      source: 'ejemplo: respuesta del cliente en el brief',
      confirmed: true,
    },
    // Unconfirmed on purpose: it must not reach the HTML nor the FAQPage (FR-009).
    {
      question: '¿Hacen envíos a domicilio?',
      answer: 'Respuesta pendiente de confirmar por el cliente.',
      source: 'ejemplo: borrador del brief',
      confirmed: false,
    },
  ],
  image: { alt: 'Ilustración de panes recién horneados sobre un mostrador de madera' },
  // No third-party origin: everything is served from the site itself (check:origins).
  allowedOrigins: [],
} satisfies SiteInput;
