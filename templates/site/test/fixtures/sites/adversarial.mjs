// FICTITIOUS fixture (AC-3): markup, comment openers, ampersands, quotes and backslashes in the name, the
// description and a FAQ answer. The build must succeed, escape them everywhere, and keep them intact in JSON-LD.
import address from '../../../src/data/examples/address.ts';

export const ADVERSARIAL = {
  name: 'Horno </script><script>alert(1)</script> & "Cía" <!--',
  tagline: 'Pan </script> <!-- comentario --> & facturas \\ "comillas" </SCRIPT >',
  answer: 'Sí </script><script>alert(1)</script> <!-- & -->   fin',
};

export default {
  ...address,
  name: ADVERSARIAL.name,
  tagline: ADVERSARIAL.tagline,
  faq: [
    {
      question: '¿Pregunta con <b>marcado</b> & más?',
      answer: ADVERSARIAL.answer,
      source: 'fixture',
      confirmed: true,
    },
  ],
};
