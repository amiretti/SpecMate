// FICTITIOUS fixture (AC-4): the address example with another name, phone (with spaces and hyphens) and weekday
// hours. Every new value must reach visible HTML, JSON-LD and metadata; every old value must vanish.
import address from '../../../src/data/examples/address.ts';

export const CHANGED = {
  name: 'Panificadora La Espiga Verde',
  phone: { display: '+54 351 999-88-77', e164: '+543519998877' },
  hours: { opens: '06:30', closes: '21:15', text: '6:30 a 21:15' },
};

export const PREVIOUS = {
  name: address.name,
  phoneDisplay: address.phone.display,
  phoneE164: address.phone.e164,
  hoursText: '7:00 a 20:00',
  opens: address.hours[0].opens,
  closes: address.hours[0].closes,
};

export default {
  ...address,
  name: CHANGED.name,
  phone: { ...address.phone, ...CHANGED.phone },
  hours: [{ ...address.hours[0], opens: CHANGED.hours.opens, closes: CHANGED.hours.closes }, ...address.hours.slice(1)],
};
