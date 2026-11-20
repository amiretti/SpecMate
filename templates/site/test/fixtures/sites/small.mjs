// FICTITIOUS fixture (US-14 AC-6, SC-002): a small business invented for the tests, reachable only by WhatsApp,
// with no hours, no address, no service area and no own domain (a Workers URL). No "Llamar" button.
const CONFIRMED = 'fixture: cliente inventado, por WhatsApp, 2026-01-01';
const datum = (fields) => ({ ...fields, source: 'fixture: conversación inventada', confirmedBy: CONFIRMED });

export const SMALL = {
  url: 'https://tortas-lila.cuenta-inventada.workers.dev',
  whatsapp: { display: '+54 9 11 0000-3333', e164: '+5491100003333' },
};

export default {
  $comment: 'FICTITIOUS business invented for the template tests: not a real client.',
  $schemaVersion: 1,
  brief: {
    exampleNotice: 'Sitio de prueba de la plantilla: el negocio y sus datos son ficticios.',
    site: datum({ url: SMALL.url }),
    name: datum({ text: 'Tortas Lila' }),
    tagline: datum({ text: 'Tortas por encargo, con pedido por WhatsApp.' }),
    about: datum({ text: 'Hacemos tortas por encargo en una cocina chica. Pedís por WhatsApp y coordinamos la entrega.' }),
    contact: { whatsapp: datum(SMALL.whatsapp) },
    image: { alt: 'Ilustración de tortas sobre una mesa' },
    allowedOrigins: [],
  },
};
