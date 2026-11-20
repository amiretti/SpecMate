// FICTITIOUS fixture (AC-3): markup, comment openers, ampersands, quotes and backslashes in the name, the
// description and a FAQ answer. The build must succeed, escape them everywhere, and keep them intact in JSON-LD.
import { readExample } from '../../lib/build.mjs';

export const ADVERSARIAL = {
  name: 'Horno </script><script>alert(1)</script> & "Cía" <!--',
  tagline: 'Pan </script> <!-- comentario --> & facturas \\ "comillas" </SCRIPT >',
  answer: 'Sí </script><script>alert(1)</script> <!-- & -->   fin',
};

const data = readExample('address');
data.brief.name.text = ADVERSARIAL.name;
data.brief.tagline.text = ADVERSARIAL.tagline;
data.brief.faq = [
  {
    question: '¿Pregunta con <b>marcado</b> & más?',
    answer: ADVERSARIAL.answer,
    source: 'fixture',
    confirmedBy: 'fixture: inventado, 2026-01-01',
  },
];
export default data;
