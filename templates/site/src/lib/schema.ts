// schema.org graph of the site (FR-003, ADR-0035 "Negocios sin dirección"), built only from the validated Site:
// - confirmed address -> LocalBusiness with address (and areaServed if also confirmed);
// - service area and no address -> LocalBusiness with areaServed;
// - neither -> Organization with url and contactPoint.
// Never aggregateRating, review or geo (constitution XI). FAQPage only with confirmed questions (FR-009);
// sameAs only with confirmed https profiles (FR-010).
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

function businessNode(site: Site, imageUrl: string): Node {
  const home = pageUrl(site, '/');
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
        telephone: site.phone.e164,
        email: site.email,
        hoursAvailable: openingHours(site.hours),
      },
    };
  }

  return {
    '@type': 'LocalBusiness',
    ...common,
    telephone: site.phone.e164,
    email: site.email,
    openingHoursSpecification: openingHours(site.hours),
    ...(site.address ? { address: postalAddress(site.address) } : {}),
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
