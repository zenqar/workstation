import type { Locale } from '@/i18n/routing';

export type LandingSeo = {
  title: string;
  description: string;
  keywords: string[];
  features: string[];
};

export const landingSeo: Record<Locale, LandingSeo> = {
  en: {
    title: 'Zenqar — Free Invoicing and Bookkeeping Software',
    description: 'Free invoicing and bookkeeping software for modern businesses. Track expenses, cash flow, payments, contacts, reports, AI document scans, voice messages, and one-to-one calls in one secure workspace.',
    keywords: ['free bookkeeping software', 'free invoicing software', 'expense tracking', 'cash flow dashboard', 'invoice scanner', 'small business accounting', 'voice messages for business'],
    features: ['Invoice creation and verification', 'Expense and payment tracking', 'Cash flow reporting', 'Private business text and voice messages', 'One-to-one voice calls', 'AI-assisted document scanning'],
  },
  ar: {
    title: 'Zenqar — برنامج مجاني للفوترة ومسك الدفاتر',
    description: 'برنامج مجاني للفوترة ومسك الدفاتر للشركات الحديثة. تابع المصروفات والتدفق النقدي والمدفوعات والتقارير ومسح المستندات بالذكاء الاصطناعي والرسائل والمكالمات الصوتية في مساحة آمنة واحدة.',
    keywords: ['برنامج فواتير مجاني', 'برنامج مسك دفاتر مجاني', 'تتبع المصروفات', 'التدفق النقدي', 'مسح الفواتير بالذكاء الاصطناعي', 'محاسبة الشركات الصغيرة'],
    features: ['إنشاء الفواتير والتحقق منها', 'تتبع المصروفات والمدفوعات', 'تقارير التدفق النقدي', 'رسائل أعمال نصية وصوتية خاصة', 'مكالمات صوتية فردية', 'مسح المستندات بمساعدة الذكاء الاصطناعي'],
  },
  ku: {
    title: 'Zenqar — نەرمەکالای خۆڕایی بۆ فاکتور و ژمێریاری',
    description: 'نەرمەکالای خۆڕایی بۆ فاکتور و ژمێریاریی کۆمپانیا مۆدێرنەکان. خەرجی و جۆگەی پارە و پارەدان و ڕاپۆرت و سکانی زیرەکی بەڵگە و پەیام و پەیوەندی دەنگی لە یەک شوێنی پارێزراودا بەڕێوەببە.',
    keywords: ['نەرمەکالای فاکتوری خۆڕایی', 'ژمێریاری خۆڕایی', 'بەدواداچوونی خەرجی', 'جۆگەی پارە', 'سکانی فاکتور بە زیرەکی دەستکرد'],
    features: ['دروستکردن و پشتڕاستکردنەوەی فاکتور', 'بەدواداچوونی خەرجی و پارەدان', 'ڕاپۆرتی جۆگەی پارە', 'پەیامی نووسراو و دەنگی تایبەتی بازرگانی', 'پەیوەندی دەنگی یەک-بە-یەک', 'سکانی بەڵگە بە یارمەتی زیرەکی دەستکرد'],
  },
  et: {
    title: 'Zenqar — tasuta arveldamise ja raamatupidamise tarkvara',
    description: 'Tasuta arveldamise ja raamatupidamise tarkvara tänapäevastele ettevõtetele. Halda kulusid, rahavoogu, makseid, aruandeid, AI-dokumendiskannimist, häälsõnumeid ja üks-ühele kõnesid ühes turvalises tööruumis.',
    keywords: ['tasuta raamatupidamistarkvara', 'tasuta arveldustarkvara', 'kulude jälgimine', 'rahavoo juhtpaneel', 'AI arveskanner', 'väikeettevõtte raamatupidamine'],
    features: ['Arvete loomine ja kontrollimine', 'Kulude ja maksete jälgimine', 'Rahavoo aruandlus', 'Privaatsed äriteksti- ja häälsõnumid', 'Üks-ühele häälkõned', 'AI-abiga dokumendiskannimine'],
  },
};

export function getLandingSeo(locale: string): LandingSeo {
  return landingSeo[locale as Locale] || landingSeo.en;
}
