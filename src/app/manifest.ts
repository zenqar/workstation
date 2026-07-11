import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Zenqar — Invoicing and Bookkeeping', short_name: 'Zenqar',
    description: 'Free invoicing, expenses, payments, cash flow, reports, and secure business collaboration.',
    start_url: '/en', display: 'standalone', background_color: '#08080d', theme_color: '#8b5cf6',
    icons: [{ src: '/zenqar-icon.png', sizes: '512x512', type: 'image/png' }],
  };
}
