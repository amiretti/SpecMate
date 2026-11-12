// FICTITIOUS example business for the template. Not a real client: every name, phone and
// address below is invented. In a client site this data comes from the confirmed brief.
export const business = {
  name: 'Panadería El Horno Azul',
  tagline: 'Pan de masa madre horneado cada mañana en el barrio.',
  about:
    'Somos una panadería de barrio que hornea en tandas chicas: pan de masa madre, facturas y budines. Usamos harinas de molinos cercanos y fermentaciones largas.',
  hours: [
    { days: 'Lunes a viernes', time: '7:00 a 20:00' },
    { days: 'Sábados', time: '8:00 a 14:00' },
    { days: 'Domingos', time: 'Cerrado' },
  ],
  address: 'Calle Ficticia 123, Ciudad de Ejemplo',
  phoneDisplay: '+54 11 0000-0000',
  phoneE164: '+541100000000',
  whatsapp: '541100000000',
  email: 'hola@example.com',
  image: {
    alt: 'Ilustración de panes recién horneados sobre un mostrador de madera',
  },
} as const;
