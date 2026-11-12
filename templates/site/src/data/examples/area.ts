import type { SiteInput } from '../../lib/site.ts';

// Variant "area": serves a zone with no storefront -> LocalBusiness with areaServed and no address (ADR-0035).
export default {
  $comment:
    'FICTITIOUS example business for the template, invented: not a real client. Every name, phone, zone and ' +
    'question is made up. In a client site this data comes from the confirmed brief.',
  site: { url: 'https://gota-firme.example', aiCrawlers: 'allow' },
  exampleNotice: 'Sitio de ejemplo de la plantilla: el negocio y sus datos son ficticios.',
  name: 'Plomería Gota Firme',
  tagline: 'Arreglos de plomería a domicilio, con presupuesto antes de empezar.',
  about:
    'Atendemos pérdidas, destapaciones e instalaciones en casas y comercios. Vamos a domicilio dentro de nuestra zona y pasamos el presupuesto antes de tocar nada.',
  phone: {
    display: '+54 11 0000-1111',
    e164: '+541100001111',
    whatsapp: true,
    source: 'ejemplo: formulario del brief',
    confirmed: true,
  },
  email: { address: 'turnos@gota-firme.example', source: 'ejemplo: formulario del brief', confirmed: true },
  hours: [
    {
      label: 'Lunes a sábados',
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      opens: '08:00',
      closes: '18:00',
      source: 'ejemplo: formulario del brief',
      confirmed: true,
    },
    { label: 'Domingos', days: ['Sunday'], source: 'ejemplo: formulario del brief', confirmed: true },
  ],
  areaServed: [
    { name: 'Barrio Inventado Norte', source: 'ejemplo: formulario del brief', confirmed: true },
    { name: 'Barrio Inventado Sur', source: 'ejemplo: formulario del brief', confirmed: true },
  ],
  // Only an unconfirmed question: the site must show no FAQ section and emit no FAQPage (FR-009).
  faq: [
    {
      question: '¿Atienden urgencias de noche?',
      answer: 'Respuesta pendiente de confirmar por el cliente.',
      source: 'ejemplo: borrador del brief',
      confirmed: false,
    },
  ],
  image: { alt: 'Ilustración de herramientas de plomería sobre una mesa de trabajo' },
} satisfies SiteInput;
