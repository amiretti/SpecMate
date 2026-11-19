// schema.org graph of the site (FR-003, ADR-0035 "Negocios sin dirección"), built only from the validated Site:
// - confirmed address -> LocalBusiness with address (and areaServed if also confirmed);
// - service area and no address -> LocalBusiness with areaServed;
// - neither -> Organization with url and contactPoint.
// Never aggregateRating or review (constitution XI); geo only with a confirmed address and confirmed coordinates
// (US-14 FR-009). FAQPage only with confirmed questions; sameAs only with confirmed https profiles. Telephone is the
// phone, or the WhatsApp number when it is the only one (US-14 plan decision 3); email only when confirmed.
import { type Address, type Hours, pageUrl, type Site } from './site.ts';

type Node = Record<string, unknown>;

function openingHours(hours: Hours[]): Node[] {
  return hours.flatMap((h) =>
    h.opens && h.closes
      ? [{ '@type': 'OpeningHoursSpecification', dayOfWeek: h.days, opens: h.opens, closes: h.closes }]
      : [],
  );
}

function postalAddress({ street, locality, region, postalCode, country }: Address): Node {
  return {
    '@type': 'PostalAddress',
    streetAddress: street,
    addressLocality: locality,
    ...(region === undefined ? {} : { addressRegion: region }),
    ...(postalCode === undefined ? {} : { postalCode }),
    addressCountry: country,
  };
}

/** telephone and email of the business, each only when confirmed. */
function contactFields({ contact }: Site): Node {
  const telephone = (contact.phone ?? contact.whatsapp)?.e164;
  return {
    ...(telephone === undefined ? {} : { telephone }),
    ...(contact.email === undefined ? {} : { email: contact.email }),
  };
}

function businessNode(site: Site, imageUrl: string): Node {
  const home = pageUrl(site, '/');
  const hours = openingHours(site.hours);
  const common: Node = {
    '@id': `${home}#negocio`,
    name: site.name,
    description: site.tagline,
    url: home,
    image: imageUrl,
    ...(site.profiles.length > 0 ? { sameAs: site.profiles } : {}),
  };

  if (!site.address && site.areaServed.length === 0) {
    return {
      '@type': 'Organization',
      ...common,
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        ...contactFields(site),
        ...(hours.length > 0 ? { hoursAvailable: hours } : {}),
      },
    };
  }

  return {
    '@type': 'LocalBusiness',
    ...common,
    ...contactFields(site),
    ...(hours.length > 0 ? { openingHoursSpecification: hours } : {}),
    ...(site.address ? { address: postalAddress(site.address) } : {}),
    ...(site.address && site.geo
      ? { geo: { '@type': 'GeoCoordinates', latitude: site.geo.latitude, longitude: site.geo.longitude } }
      : {}),
    ...(site.areaServed.length > 0 ? { areaServed: site.areaServed } : {}),
  };
}

/** The single JSON-LD graph of the home page. `imageUrl` is the absolute URL of the Open Graph image. */
export function buildSchema(site: Site, imageUrl: string): Node {
  const graph: Node[] = [businessNode(site, imageUrl)];
  if (site.faq.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${pageUrl(site, '/')}#preguntas`,
      mainEntity: site.faq.map(({ question, answer }) => ({
        '@type': 'Question',
        name: question,
        acceptedAnswer: { '@type': 'Answer', text: answer },
      })),
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}
