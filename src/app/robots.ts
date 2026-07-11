import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/en/app/', '/ar/app/', '/ku/app/', '/et/app/', '/en/admin/', '/ar/admin/', '/ku/admin/', '/et/admin/'] },
    sitemap: 'https://zenqar.com/sitemap.xml',
    host: 'https://zenqar.com',
  };
}
