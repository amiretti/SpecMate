// FICTITIOUS fixture (AC-4): the address example with another name, phone (with spaces and hyphens, also on
// WhatsApp) and weekday hours. Every new value must reach visible HTML, JSON-LD and metadata; every old one vanish.
import { readExample } from '../../lib/build.mjs';

const address = readExample('address');

export const CHANGED = {
  name: 'Panificadora La Espiga Verde',
  phone: { display: '+54 351 999-88-77', e164: '+543519998877' },
  hours: { opens: '06:30', closes: '21:15', text: '6:30 a 21:15' },
};

export const PREVIOUS = {
  name: address.brief.name.text,
  phoneDisplay: address.brief.contact.phone.display,
  phoneE164: address.brief.contact.phone.e164,
  hoursText: '7:00 a 20:00',
  opens: address.brief.hours[0].opens,
  closes: address.brief.hours[0].closes,
};

const data = readExample('address');
data.brief.name.text = CHANGED.name;
Object.assign(data.brief.contact.phone, CHANGED.phone);
Object.assign(data.brief.contact.whatsapp, CHANGED.phone);
Object.assign(data.brief.hours[0], { opens: CHANGED.hours.opens, closes: CHANGED.hours.closes });
export default data;
