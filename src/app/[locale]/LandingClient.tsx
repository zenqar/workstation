'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter, Link } from '@/i18n/routing';

// Import landing components
import BorderGlow from '@/components/landing/BorderGlow';
import SoftAurora from '@/components/landing/SoftAurora';
import GhostCursor from '@/components/landing/GhostCursor';
import LaserFlow from '@/components/landing/LaserFlow';
import ElectricBorder from '@/components/landing/ElectricBorder';
import GlassSurface from '@/components/landing/GlassSurface';
import VariableProximity from '@/components/landing/VariableProximity';
import ScrollReveal from '@/components/landing/ScrollReveal';
import DashboardMockup from '@/components/landing/DashboardMockup';
import DecryptedText from '@/components/landing/DecryptedText';
import AIChatBot from '@/components/layout/AIChatBot';

// Import CSS
import '@/app/[locale]/landing.css';

const copy = {
  en: {
    dir: 'ltr',
    nav: { features: 'Features', verify: 'Verify', workflow: 'Workflow', free: 'Free', faq: 'FAQ', start: 'Start free' },
    heroKicker: 'Zenqar finance operating layer',
    heroTitle: 'Get control of your business !',
    heroBody: 'Zenqar helps modern businesses run invoicing, bookkeeping workflows, reporting, and team coordination in one focused experience.',
    heroChips: ['Invoices', 'Bookkeeping', 'Cash flow', 'Reporting', 'Team access'],
    proof: ['Clear workflow', 'Secure collaboration', 'Fast visibility'],
    heroBadges: ['live cash flow', 'invoice status', 'team visibility'],
    poweredBy: 'Powered by',
    brands: ['Cloudflare', 'Supabase', 'Google', 'OpenAI', 'Zenqar'],
    featuresEyebrow: 'Best features',
    featuresTitle: 'The parts of finance work that users notice immediately.',
    featuresBody: 'Each section is designed to communicate value quickly, clearly, and with strong visual attention.',
    featureCards: [
      ['Fast invoicing', 'Create polished invoices, track status instantly, and stay on top of payments without extra tools.'],
      ['Secure financial workspace', 'Bring transactions, expenses, reporting, and contacts into one clear and controlled workspace.'],
      ['Decision-ready reporting', 'See the numbers that matter in a layout built to help you act quickly and confidently.']
    ],
    chatEyebrow: 'Secure communication',
    chatTitle: 'Keep invoice conversations close to the work.',
    chatBody: 'Follow up with clients, confirm approvals, and keep important context attached to payments and invoices instead of losing it across disconnected channels.',
    contactsTitle: 'Contacts',
    secureChatTitle: 'Secure chat',
    secureChatBody: 'Keep invoice discussions and approvals in one place.',
    encrypted: 'Encrypted',
    contacts: [
      ['Dilan Hassan', 'Invoice follow-up'],
      ['Finance Team', 'Internal updates'],
      ['Northstar Studio', 'Payment status'],
      ['Operations', 'Approvals']
    ],
    messages: [
      'Can you confirm invoice INV-1044 for Northstar Studio?',
      'Approved. Please send the payment reminder today.',
      'Invoice approved — reminder sent — payment expected today'
    ],
    verifyEyebrow: 'Invoice verification',
    verifyTitle: 'Make invoice checking obvious and easy.',
    verifyBody: 'Give customers and partners a clear way to verify invoice authenticity. You can later connect this button to your own verification route.',
    verifyInput: 'Enter invoice number',
    verifyBtn: 'Verify invoice',
    workflowEyebrow: 'How it works',
    workflowTitle: 'Built to turn complex finance work into a clear path.',
    workflow: [
      ['1', 'Create your workspace', 'Add your company details, roles, and finance structure in a simple setup flow.'],
      ['2', 'Send invoices and track status', 'Issue invoices, follow payments, and verify progress without switching systems.'],
      ['3', 'Stay in control every day', 'Use one clean dashboard for cash flow, reporting, conversations, and operations.']
    ],
    pricingEyebrow: 'Access',
    pricingTitle: 'One plan. Free.',
    pricingBody: 'Keep the offer simple, clear, and easy to act on.',
    pricingName: 'Zenqar Free',
    pricingItems: ['Invoicing and tracking', 'Clear dashboard experience', 'Secure team workflow', 'Invoice verification entry point', 'Modern product interface'],
    faqEyebrow: 'FAQ',
    faqTitle: 'Questions about the app',
    faqs: [
      ['What can I do with Zenqar?', 'Zenqar is designed for invoicing, bookkeeping workflows, cash flow visibility, reporting, expense awareness, and team collaboration in one place.'],
      ['Can I verify invoices?', 'Yes. The landing page includes a prominent Verify invoice action so you can later connect it to your preferred verification route.'],
      ['Does Zenqar support secure communication?', 'Yes. Zenqar is positioned as a secure business workspace where teams can coordinate around invoices, approvals, and finance operations.'],
      ['Can my team use it together?', 'Yes. Zenqar supports team access so finance, operations, and leadership can work together with role-aware visibility.'],
      ['Is it free?', 'YES !'],
      ['What powers Zenqar?', 'The landing page highlights a modern stack with Cloudflare, Supabase, Google, OpenAI, and Zenqar.']
    ],
    finalTitle: 'Bring finance work into focus.',
    finalBody: 'Launch with Zenqar and give users a cleaner way to manage invoices, communication, verification, and visibility.'
  },
  ar: {
    dir: 'rtl',
    nav: { features: 'المزايا', verify: 'التحقق', workflow: 'الخطوات', free: 'مجاني', faq: 'الأسئلة', start: 'ابدأ مجانًا' },
    heroKicker: 'طبقة تشغيل Zenqar المالية',
    heroTitle: 'احصل على السيطرة على عملك !',
    heroBody: 'يساعد Zenqar الشركات الحديثة على إدارة الفواتير وسير عمل مسك الدفاتر والتقارير وتنسيق الفريق في تجربة واحدة مركزة.',
    heroChips: ['الفواتير', 'مسك الدفاتر', 'التدفق النقدي', 'التقارير', 'صلاحيات الفريق'],
    proof: ['سير عمل واضح', 'تعاون آمن', 'رؤية سريعة'],
    heroBadges: ['تدفق نقدي مباشر', 'حالة الفاتورة', 'رؤية الفريق'],
    poweredBy: 'مدعوم بواسطة',
    brands: ['Cloudflare', 'Supabase', 'Google', 'OpenAI', 'Zenqar'],
    featuresEyebrow: 'أفضل المزايا',
    featuresTitle: 'الأجزاء من العمل المالي التي يلاحظها المستخدم فورًا.',
    featuresBody: 'كل قسم مصمم لإظهار القيمة بسرعة ووضوح وباهتمام بصري قوي.',
    featureCards: [
      ['فواتير سريعة', 'أنشئ فواتير احترافية وتابع الحالة فورًا وابقَ على اطلاع بالمدفوعات دون أدوات إضافية.'],
      ['مساحة مالية آمنة', 'اجمع المعاملات والمصروفات والتقارير وجهات الاتصال في مساحة واحدة واضحة ومضبوطة.'],
      ['تقارير جاهزة للقرار', 'شاهد الأرقام المهمة في واجهة تساعدك على التصرف بسرعة وثقة.']
    ],
    chatEyebrow: 'تواصل آمن',
    chatTitle: 'اجعل محادثات الفواتير قريبة من العمل.',
    chatBody: 'تابع مع العملاء وأكد الموافقات واحتفظ بالسياق المهم مرتبطًا بالمدفوعات والفواتير بدلًا من ضياعه في قنوات متفرقة.',
    contactsTitle: 'جهات الاتصال',
    secureChatTitle: 'دردشة آمنة',
    secureChatBody: 'احتفظ بنقاشات الفواتير والموافقات في مكان واحد.',
    encrypted: 'مشفّر',
    contacts: [
      ['ديلان حسن', 'متابعة فاتورة'],
      ['فريق المالية', 'تحديثات داخلية'],
      ['نورث ستار ستوديو', 'حالة الدفع'],
      ['العمليات', 'الموافقات']
    ],
    messages: [
      'هل يمكنك تأكيد الفاتورة INV-1044 الخاصة بـ Northstar Studio؟',
      'تمت الموافقة. يرجى إرسال تذكير الدفع اليوم.',
      'تم اعتماد الفاتورة — أُرسل التذكير — الدفع متوقع اليوم'
    ],
    verifyEyebrow: 'التحقق من الفاتورة',
    verifyTitle: 'اجعل فحص الفاتورة واضحًا وسهلًا.',
    verifyBody: 'امنح العملاء والشركاء طريقة واضحة للتحقق من صحة الفاتورة. يمكنك لاحقًا ربط هذا الزر بمسار التحقق الخاص بك.',
    verifyInput: 'أدخل رقم الفاتورة',
    verifyBtn: 'تحقق من الفاتورة',
    workflowEyebrow: 'كيف يعمل',
    workflowTitle: 'مصمم لتحويل العمل المالي المعقد إلى مسار واضح.',
    workflow: [
      ['1', 'أنشئ مساحة عملك', 'أضف تفاصيل الشركة والأدوار والهيكل المالي في إعداد بسيط.'],
      ['2', 'أرسل الفواتير وتابع الحالة', 'أصدر الفواتير وتابع المدفوعات والتحقق دون تبديل الأنظمة.'],
      ['3', 'ابقَ مسيطرًا كل يوم', 'استخدم لوحة واحدة واضحة للتدفق النقدي والتقارير والمحادثات والعمليات.']
    ],
    pricingEyebrow: 'الوصول',
    pricingTitle: 'خطة واحدة. مجانية.',
    pricingBody: 'اجعل العرض بسيطًا وواضحًا وسهل التنفيذ.',
    pricingName: 'Zenqar مجاني',
    pricingItems: ['إصدار وتتبع الفواتير', 'تجربة لوحة تحكم واضحة', 'سير عمل جماعي آمن', 'نقطة دخول للتحقق من الفاتورة', 'واجهة منتج حديثة'],
    faqEyebrow: 'الأسئلة',
    faqTitle: 'أسئلة حول التطبيق',
    faqs: [
      ['ماذا يمكنني أن أفعل مع Zenqar؟', 'تم تصميم Zenqar للفواتير وسير عمل مسك الدفاتر ورؤية التدفق النقدي والتقارير ومتابعة المصروفات وتعاون الفريق في مكان واحد.'],
      ['هل يمكنني التحقق من الفواتير؟', 'نعم. تتضمن الصفحة إجراء تحقق واضح من الفاتورة بحيث يمكنك لاحقًا ربطه بمسار التحقق الذي تفضله.'],
      ['هل يدعم Zenqar التواصل الآمن؟', 'نعم. يتم تقديم Zenqar كمساحة عمل آمنة للشركات حيث يمكن للفرق التنسيق حول الفواتير والموافقات والعمليات المالية.'],
      ['هل يستطيع فريقي استخدامه معًا؟', 'نعم. يدعم Zenqar وصول الفريق بحيث تعمل المالية والعمليات والإدارة معًا وفق صلاحيات مناسبة.'],
      ['هل هو مجاني؟', 'YES !'],
      ['ما الذي يشغل Zenqar؟', 'توضح الصفحة بنية حديثة تعتمد على Cloudflare وSupabase وGoogle وOpenAI وZenqar.']
    ],
    finalTitle: 'ضع العمل المالي تحت التركيز.',
    finalBody: 'ابدأ مع Zenqar وامنح المستخدمين طريقة أنظف لإدارة الفواتير والتواصل والتحقق والرؤية.'
  },
  ku: {
    dir: 'rtl',
    nav: { features: 'تایبەتمەندییەکان', verify: 'پشتڕاستکردنەوە', workflow: 'کارگەڕ', free: 'خۆڕایی', faq: 'پرسیارە باوەکان', start: 'بەخۆڕایی دەستپێبکە' },
    heroKicker: 'چینی کارپێکردنی دارایی Zenqar',
    heroTitle: 'کۆنترۆڵی بیزنەسەکەت بەدەست بهێنە !',
    heroBody: 'Zenqar یارمەتیدەری کۆمپانیا مۆدێرنەکانە بۆ بەڕێوەبردنی فاکتور و کارگێڕی ژمێریاری و ڕاپۆرت و هاوکاری تیم لە یەک ئەزموونی ڕێکوپێکدا.',
    heroChips: ['فاکتور', 'ژمێریاری', 'جۆگەی پارە', 'ڕاپۆرت', 'دەسەڵاتی تیم'],
    proof: ['کارگێڕی ڕوون', 'هاوکاری پارێزراو', 'بینینی خێرا'],
    heroBadges: ['جۆگەی پارەی ڕاستەوخۆ', 'دۆخی فاکتور', 'بینینی تیم'],
    poweredBy: 'پشتیوانی کراوە لەلایەن',
    brands: ['Cloudflare', 'Supabase', 'Google', 'OpenAI', 'Zenqar'],
    featuresEyebrow: 'باشترین تایبەتمەندییەکان',
    featuresTitle: 'ئەو بەشانەی کاری دارایی کە بەکارهێنەر زوو تێدەگات.',
    featuresBody: 'هەر بەشێک بۆ پیشاندانی نرخ بە خێرایی و ڕوونی و سەرنجڕاکێشی باش دروست کراوە.',
    featureCards: [
      ['فاکتورکردنی خێرا', 'فاکتوری جوان دروست بکە، دۆخەکەی یەکسەر ببینە و بەبێ ئامرازی زیادە لەسەر پارەدانەکان ئاگاداربە.'],
      ['شوێنی دارایی پارێزراو', 'مامەڵە و خەرجی و ڕاپۆرت و پەیوەندییەکان لە یەک شوێنی ڕوون و ڕێکخراودا کۆبکەوە.'],
      ['ڕاپۆرتی ئامادەی بڕیار', 'ئەو ژمارانە ببینە کە گرنگن لە دیزاینێکدا کە یارمەتیت دەدات بە خێرایی و دڵنیایی بڕیار بدەیت.']
    ],
    chatEyebrow: 'پەیوەندی پارێزراو',
    chatTitle: 'گفتوگۆی فاکتور نزیک لە کارەکە بپارێزە.',
    chatBody: 'لەگەڵ کڕیاران بەردەوام بە، ڕەزامەندی پشتڕاست بکە و زانیاری گرنگ بە فاکتور و پارەدانەوەکانەوە پەیوەست بپارێزە.',
    contactsTitle: 'پەیوەندییەکان',
    secureChatTitle: 'چاتی پارێزراو',
    secureChatBody: 'گفتوگۆی فاکتور و ڕەزامەندیەکان لە یەک شوێندا بپارێزە.',
    encrypted: 'کۆدکراو',
    contacts: [
      ['دیلان حەسەن', 'بەدواداچوونی فاکتور'],
      ['تیمی دارایی', 'نوێکاری ناوخۆ'],
      ['Northstar Studio', 'دۆخی پارەدان'],
      ['کارگێڕی', 'ڕەزامەندیەکان']
    ],
    messages: [
      'دەتوانیت فاکتوری INV-1044 بۆ Northstar Studio پشتڕاست بکەیت؟',
      'پەسەند کرا. تکایە ئەمڕۆ یاداوری پارەدان بنێرە.',
      'فاکتور پەسەند کرا — یاداوری نێردرا — چاوەڕوانی پارەدان دەکرێت'
    ],
    verifyEyebrow: 'پشتڕاستکردنەوەی فاکتور',
    verifyTitle: 'پشکنینی فاکتور ئاسان و ڕوون بکە.',
    verifyBody: 'ڕێگایەکی ڕوون بدە بە کڕیار و هاوبەشەکان بۆ پشتڕاستکردنەوەی دروستی فاکتور. دواتر دەتوانیت ئەم دوگمەیە بە ڕێڕەوی خۆت ببەستیت.',
    verifyInput: 'ژمارەی فاکتور بنووسە',
    verifyBtn: 'فاکتور پشتڕاست بکە',
    workflowEyebrow: 'چۆنیەتی کارکردن',
    workflowTitle: 'بۆ گۆڕینی کاری داراییی ئاڵۆز بۆ ڕێگایەکی ڕوون دروست کراوە.',
    workflow: [
      ['1', 'شوێنی کارەکەت دروست بکە', 'زانیاری کۆمپانیا و ڕۆڵ و شێوازی دارایی لە دانانێکی سادەدا زیاد بکە.'],
      ['2', 'فاکتور بنێرە و دۆخەکە ببینە', 'فاکتور دەربکە و پارەدان و پشتڕاستکردنەوە بەبێ گۆڕینی سیستەم ببینە.'],
      ['3', 'هەموو ڕۆژێک کۆنترۆڵ بەدەست بگرە', 'یەک داشبۆردی ڕوون بەکاربهێنە بۆ جۆگەی پارە و ڕاپۆرت و چات و کارگێڕی.']
    ],
    pricingEyebrow: 'دەستگەیشتن',
    pricingTitle: 'یەک پلانی خۆڕایی.',
    pricingBody: 'پێشکەشەکە سادە و ڕوون و ئاسان بۆ دەستپێکردن بکه.',
    pricingName: 'Zenqar خۆڕایی',
    pricingItems: ['فاکتور و بەدواداچوون', 'ئەزموونی داشبۆردی ڕوون', 'کارگێڕی پارێزراوی تیم', 'شوێنی چوونەژوورەوەی پشتڕاستکردنەوەی فاکتور', 'ڕووکارێکی مۆدێرنی بەرهەم'],
    faqEyebrow: 'پرسیارە باوەکان',
    faqTitle: 'پرسیارەکان دەربارەی ئەپ',
    faqs: [
      ['لە Zenqar چی دەتوانم بکەم؟', 'Zenqar بۆ فاکتور و کارگێڕی ژمێریاری و بینینی جۆگەی پارە و ڕاپۆرت و خەرجی و هاوکاری تیم لە یەک شوێندا دیزاین کراوە.'],
      ['دەتوانم فاکتور پشتڕاست بکەم؟', 'بەڵێ. لەم پەیجەدا دوگمەیەکی دیار بۆ پشتڕاستکردنەوەی فاکتور هەیە کە دواتر دەتوانیت بە ڕێڕەوی خۆت ببەستیت.'],
      ['ئایا Zenqar پەیوەندی پارێزراو پشتگیری دەکات؟', 'بەڵێ. Zenqar وەک شوێنێکی پارێزراوی بیزنەس پیشان دەدرێت بۆ هاوکاری تیم لەسەر فاکتور و ڕەزامەندی و کارە دارایییەکان.'],
      ['ئایا تیمەکەم دەتوانێت پێکەوە بەکاریبهێنێت؟', 'بەڵێ. Zenqar دەسەڵاتی تیم پشتگیری دەکات بۆ ئەوەی دارایی و کارگێڕی و بەڕێوەبەرایەتی پێکەوە کار بکەن.'],
      ['ئایا خۆڕاییە؟', 'YES !'],
      ['چی Zenqar کارپێدەکات؟', 'لە پەیجەکەدا ستاکێکی مۆدێرن پیشان دراوە وەک Cloudflare و Supabase و Google و OpenAI و Zenqar.']
    ],
    finalTitle: 'کاری دارایی بخه‌ ناو فوکەسەوە.',
    finalBody: 'بە Zenqar دەستپێبکە و ڕێگایەکی پاکتر بدە بە بەکارهێنەران بۆ بەڕێوەبردنی فاکتور و پەیوەندی و پشتڕاستکردنەوە و بینین.'
  },
  et: {
    dir: 'ltr',
    nav: { features: 'Funktsioonid', verify: 'Kinnita', workflow: 'Töövoog', free: 'Tasuta', faq: 'KKK', start: 'Alusta tasuta' },
    heroKicker: 'Zenqar finantstöötluse kiht',
    heroTitle: 'Võta kontroll oma äri üle !',
    heroBody: 'Zenqar aitab kaasaegsetel ettevõtetel hallata arveid, raamatupidamise töövoogusid, aruandlust ja meeskonna koordineerimist ühes fokuseeritud kogemuses.',
    heroChips: ['Arved', 'Raamatupidamine', 'Rahavoog', 'Aruandlus', 'Meeskonna ligipääs'],
    proof: ['Selge töövoog', 'Turvaline koostöö', 'Kiire nähtavus'],
    heroBadges: ['reaalne rahavoog', 'arve olek', 'meeskonna nähtavus'],
    poweredBy: 'Toetatud',
    brands: ['Cloudflare', 'Supabase', 'Google', 'OpenAI', 'Zenqar'],
    featuresEyebrow: 'Parimad funktsioonid',
    featuresTitle: 'Finantstöö osad, mida kasutajad koheselt märkavad.',
    featuresBody: 'Iga sektsioon on loodud väärtuse kiireks, selgeks ja visuaalselt köitvaks edastamiseks.',
    featureCards: [
      ['Kiire arveldamine', 'Loo lihvitud arveid, jälgi olekut koheselt ja püsi maksetega kursis ilma lisatööriistadeta.'],
      ['Turvaline finantstööruum', 'Too tehingud, kulud, aruandlus ja kontaktid ühte selgesse ja kontrollitud tööruumi.'],
      ['Otsustusvalmis aruandlus', 'Näe numbreid, mis loevad, kujunduses, mis aitab sul kiiresti ja kindlalt tegutseda.']
    ],
    chatEyebrow: 'Turvaline suhtlus',
    chatTitle: 'Hoiame arvevestlused töö lähedal.',
    chatBody: 'Suhtle klientidega, kinnita heakskiite ja hoia oluline kontekst maksete ja arvetega seotud, selle asemel et kaotada see erinevatesse kanalitesse.',
    contactsTitle: 'Kontaktid',
    secureChatTitle: 'Turvaline vestlus',
    secureChatBody: 'Hoia arvearutelud ja heakskiidud ühes kohas.',
    encrypted: 'Krüpteeritud',
    contacts: [
      ['Dilan Hassan', 'Arve järelkontroll'],
      ['Finantstiim', 'Sisesed uuendused'],
      ['Northstar Studio', 'Makse olek'],
      ['Operatsioonid', 'Heakskiidud']
    ],
    messages: [
      'Kas sa saad kinnitada arve INV-1044 Northstar Studio jaoks?',
      'Kinnitatud. Palun saada makse meeldetuletus täna.',
      'Arve kinnitatud — meeldetuletus saadetud — makse oodatud täna'
    ],
    verifyEyebrow: 'Arve kinnitamine',
    verifyTitle: 'Muuda arve kontrollimine ilmselgeks ja lihtsaks.',
    verifyBody: 'Anna klientidele ja partneritele selge viis arve ehtsuse kontrollimiseks. Saate selle hiljem ühendada oma kinnitusmarsruudiga.',
    verifyInput: 'Sisesta arve number',
    verifyBtn: 'Kinnita arve',
    workflowEyebrow: 'Kuidas see töötab',
    workflowTitle: 'Loodud keerulise finantstöö muutmiseks selgeks teeks.',
    workflow: [
      ['1', 'Loo oma tööruum', 'Lisa oma ettevõtte andmed, rollid ja finantsstruktuur lihtsas seadistusprotsessis.'],
      ['2', 'Saada arveid ja jälgi olekut', 'Väljasta arveid, jälgi makseid ja kinnita edenemist süsteeme vahetamata.'],
      ['3', 'Püsi kontrolli all iga päev', 'Kasuta ühte puhast armatuurlauda rahavoo, aruandluse, vestluste ja operatsioonide jaoks.']
    ],
    pricingEyebrow: 'Ligipääs',
    pricingTitle: 'Üks plaan. Tasuta.',
    pricingBody: 'Hoiame pakkumise lihtsa, selge ja kergesti tegutsetavana.',
    pricingName: 'Zenqar Tasuta',
    pricingItems: ['Arveldamine ja jälgimine', 'Selge armatuurlaua kogemus', 'Turvaline meeskonna töövoog', 'Arve kinnitamise sisenemispunkt', 'Moodne toote liides'],
    faqEyebrow: 'KKK',
    faqTitle: 'Küsimused rakenduse kohta',
    faqs: [
      ['Mida saan Zenqariga teha?', 'Zenqar on loodud arveldamiseks, raamatupidamise töövoogudeks, rahavoo nähtavuseks, aruandluseks ja meeskonna koostööks ühes kohas.'],
      ['Kas saan arveid kinnitada?', 'Jah. Maandumisleht sisaldab silmapaistvat arve kinnitamise toimingut, mille saad hiljem ühendada oma kinnitusmarsruudiga.'],
      ['Kas Zenqar toetab turvalist suhtlust?', 'Jah. Zenqar on positsioneeritud turvalise äritööruumina, kus meeskonnad saavad koordineerida arveid, heakskiite ja finantsoperatsioone.'],
      ['Kas minu meeskond saab seda koos kasutada?', 'Jah. Zenqar toetab meeskonna ligipääsu, nii et finants-, operatsioonide- ja juhtkond saavad töötada koos rolliteadliku nähtavusega.'],
      ['Kas see on tasuta?', 'JAH !'],
      ['Mis Zenqari toidab?', 'Maandumisleht tõstab esile moodsat tehnoloogiapaketti: Cloudflare, Supabase, Google, OpenAI ja Zenqar.']
    ],
    finalTitle: 'Too finantstöö fookusesse.',
    finalBody: 'Alusta Zenqariga ja anna kasutajatele puhtam viis arveldamise, suhtluse, kinnitamise ja nähtavuse haldamiseks.'
  }
}

function PoweredBy({ t }: any) {
  return (
    <section className="brand-rail reveal" aria-label="Powered by">
      <p className="brand-rail-label">{t.poweredBy}</p>
      <div className="brand-rail-grid">
        {t.brands.map((brand: string) => (
          <div key={brand} className="brand-pill">{brand}</div>
        ))}
      </div>
    </section>
  )
}

function LanguageToggle({ currentLocale }: { currentLocale: string }) {
  const router = useRouter();
  const items = [['en', 'EN'], ['ar', 'AR'], ['ku', 'KU'], ['et', 'ET']]
  
  return (
    <div className="lang-toggle" aria-label="Language switcher">
      {items.map(([code, label]) => (
        <button 
          key={code} 
          className={`lang-btn ${currentLocale === code ? 'active' : ''}`} 
          onClick={() => router.push('/', { locale: code as any })} 
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function SecureChatMock({ t, lang }: any) {
  const [visibleCount, setVisibleCount] = useState(1)

  useEffect(() => {
    setVisibleCount(1)
    const timers = [setTimeout(() => setVisibleCount(2), 700), setTimeout(() => setVisibleCount(3), 1450)]
    return () => timers.forEach(clearTimeout)
  }, [lang])

  return (
    <div className="chat-ui">
      <aside className="chat-sidebar">
        <div className="chat-side-title">{t.contactsTitle}</div>
        {t.contacts.map(([name, label]: any, i: number) => (
          <div key={name} className={`chat-contact ${i === 0 ? 'active' : ''}`}>
            <span className="chat-avatar">{name.charAt(0)}</span>
            <div>
              <strong>{name}</strong>
              <small>{label}</small>
            </div>
          </div>
        ))}
      </aside>
      <div className="chat-main">
        <div className="chat-main-top">
          <div>
            <div className="chat-side-title">{t.secureChatTitle}</div>
            <p>{t.secureChatBody}</p>
          </div>
          <span className="chat-shield">{t.encrypted}</span>
        </div>
        <div className="chat-bubbles">
          {visibleCount >= 1 && <div className="bubble bubble-left"><DecryptedText text={t.messages[0]} animateOn="view" sequential={true} revealDirection="start" speed={18} className="decrypted-on" encryptedClassName="decrypted-off" /></div>}
          {visibleCount >= 2 && <div className="bubble bubble-right"><DecryptedText text={t.messages[1]} animateOn="view" sequential={true} revealDirection="start" speed={18} className="decrypted-on" encryptedClassName="decrypted-off" /></div>}
          {visibleCount >= 3 && <div className="bubble bubble-left highlight"><DecryptedText text={t.messages[2]} animateOn="view" sequential={true} revealDirection="center" speed={18} className="decrypted-on" encryptedClassName="decrypted-off" /></div>}
        </div>
      </div>
    </div>
  )
}

function VerifyCard({ t }: any) {
  const [code, setCode] = useState('');
  const router = useRouter();

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    router.push(`/verify/${code.trim()}`);
  };

  return (
    <ElectricBorder className="verify-card" color="#8b7dff" borderRadius={28}>
      <div className="verify-card-inner">
        <div>
          <span className="eyebrow">{t.verifyEyebrow}</span>
          <h3>{t.verifyTitle}</h3>
          <p>{t.verifyBody}</p>
        </div>
        <form onSubmit={handleVerify} className="verify-panel">
          <input 
            type="text" 
            className="verify-input" 
            placeholder={t.verifyInput}
            value={code}
            onChange={e => setCode(e.target.value)}
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}
          />
          <button type="submit" className="cta-btn cta-primary verify-btn">{t.verifyBtn}</button>
        </form>
      </div>
    </ElectricBorder>
  )
}

export default function LandingClient() {
  const heroTextRef = useRef(null)
  const locale = useLocale() as keyof typeof copy;
  const t = copy[locale] || copy.en;

  return (
    <div className={`page-shell ${t.dir === 'rtl' ? 'rtl' : ''}`} dir={t.dir}>
      <div className="aurora-layer">
        <SoftAurora speed={0.56} scale={1.5} brightness={1.02} color1="#f7f7f7" color2="#7a4cff" noiseFrequency={2.4} noiseAmplitude={1.0} bandHeight={0.48} bandSpread={1.0} octaveDecay={0.12} layerOffset={0} colorSpeed={0.88} enableMouseInteraction={true} mouseInfluence={0.2} />
      </div>

      <header className="site-header reveal">
        <Link className="brand brand-link" href="/"><img src="/zenqar-wordmark.png" alt="Zenqar" className="brand-wordmark single" /></Link>
        <nav className="hidden md:flex">
          <a href="#features">{t.nav.features}</a>
          <a href="#verify">{t.nav.verify}</a>
          <a href="#workflow">{t.nav.workflow}</a>
          <a href="#pricing">{t.nav.free}</a>
          <a href="#faq">{t.nav.faq}</a>
        </nav>
        <div className="header-actions">
          <LanguageToggle currentLocale={locale} />
          <Link className="header-btn" href="/login">Login</Link>
          <BorderGlow className="mini-glow"><Link className="header-btn primary" href="/signup">{t.nav.start}</Link></BorderGlow>
        </div>
      </header>

      <main id="top">
        <section className="hero reveal">
          <div className="hero-copy" ref={heroTextRef}>
            <div className="hero-kicker"><img src="/zenqar-icon.png" alt="" className="hero-kicker-icon" /><span>{t.heroKicker}</span></div>
            <h1><VariableProximity label={t.heroTitle} className={'hero-variable'} fromFontVariationSettings="'wght' 500, 'opsz' 14" toFontVariationSettings="'wght' 1000, 'opsz' 40" containerRef={heroTextRef} radius={150} falloff='gaussian' /></h1>
            <p>{t.heroBody}</p>
            <div className="chip-row">{t.heroChips.map((chip) => <span key={chip}>{chip}</span>)}</div>
            <div className="cta-row">
              <BorderGlow className="cta-wrap"><Link className="cta-btn cta-primary" href="/signup">{t.nav.start}</Link></BorderGlow>
              <a className="cta-btn verify-cta" href="#verify">{t.verifyBtn}</a>
            </div>
            <div className="proof-points">{t.proof.map((item) => <span key={item}>{item}</span>)}</div>
          </div>

          <div className="hero-visual" id="dashboard">
            <div className="hero-stage">
              <div className="ghost-atmosphere"><GhostCursor color="#b497cf" brightness={1.35} edgeIntensity={0} trailLength={62} inertia={0.55} grainIntensity={0.03} bloomStrength={0.22} bloomRadius={1.1} bloomThreshold={0.02} fadeDelayMs={1100} fadeDurationMs={1600} mixBlendMode="screen" zIndex={1} /></div>
              <div className="beam-column" />
              <div className="hero-dashboard-shell">
                <div className="dashboard-scale-wrap hero-dashboard-mobile-fit">
                  <div className="dashboard-scale">
                    <DashboardMockup />
                  </div>
                </div>
              </div>
              <div className="laser-overlay"><LaserFlow color="#ff79c6" horizontalBeamOffset={0.54} verticalBeamOffset={0.02} flowSpeed={0.28} fogIntensity={0.64} horizontalSizing={0.75} verticalSizing={2.15} style={{ zIndex: 5 }} /></div>
              <div className="hero-badge badge-left">{t.heroBadges[0]}</div>
              <div className="hero-badge badge-right">{t.heroBadges[1]}</div>
              <div className="hero-badge badge-bottom">{t.heroBadges[2]}</div>
            </div>
          </div>
        </section>

        <PoweredBy t={t} />

        <section className="feature-section reveal" id="features">
          <div className="section-heading">
            <span className="eyebrow">{t.featuresEyebrow}</span>
            <ScrollReveal baseOpacity={0.08} enableBlur={true} baseRotation={2} blurStrength={8} containerClassName="heading-reveal-wrap" textClassName="heading-reveal-text">{t.featuresTitle}</ScrollReveal>
            <p>{t.featuresBody}</p>
          </div>
          <div className="feature-grid">
            {t.featureCards.map(([title, body]) => (
              <GlassSurface key={title} className="feature-card" borderRadius={26} backgroundOpacity={0.05} saturation={1.25}>
                <div><h3>{title}</h3><p>{body}</p></div>
              </GlassSurface>
            ))}
          </div>
        </section>

        <section className="chat-section reveal">
          <div className="section-heading split-heading">
            <div>
              <span className="eyebrow">{t.chatEyebrow}</span>
              <ScrollReveal baseOpacity={0.08} enableBlur={true} baseRotation={2} blurStrength={8} containerClassName="heading-reveal-wrap" textClassName="heading-reveal-text left-align">{t.chatTitle}</ScrollReveal>
            </div>
            <p>{t.chatBody}</p>
          </div>
          <SecureChatMock t={t} lang={locale} />
        </section>

        <section className="verify-section reveal" id="verify"><VerifyCard t={t} /></section>

        <section className="workflow-section reveal" id="workflow">
          <div className="section-heading narrow">
            <span className="eyebrow">{t.workflowEyebrow}</span>
            <ScrollReveal baseOpacity={0.08} enableBlur={true} baseRotation={2} blurStrength={8} containerClassName="heading-reveal-wrap" textClassName="heading-reveal-text">{t.workflowTitle}</ScrollReveal>
          </div>
          <div className="workflow-grid workflow-three">
            {t.workflow.map(([num, title, body]) => (
              <BorderGlow key={num} className="workflow-card" animated>
                <div className="workflow-inner"><strong>{num}</strong><h3>{title}</h3><p>{body}</p></div>
              </BorderGlow>
            ))}
          </div>
        </section>

        <section className="pricing-section reveal" id="pricing">
          <div className="section-heading narrow">
            <span className="eyebrow">{t.pricingEyebrow}</span>
            <h2>{t.pricingTitle}</h2>
            <p>{t.pricingBody}</p>
          </div>
          <div className="pricing-grid single-plan">
            <ElectricBorder className="pricing-card featured" color="#ff66d9" borderRadius={28}>
              <div className="pricing-inner">
                <div className="badge">{t.nav.free}</div>
                <h3>{t.pricingName}</h3>
                <div className="price">$0</div>
                <ul>{t.pricingItems.map((item) => <li key={item}>{item}</li>)}</ul>
                <div className="cta-row pricing-cta-row">
                  <Link href="/signup" className="plain-btn">{t.nav.start}</Link>
                  <a href="#verify" className="plain-btn subtle">{t.verifyBtn}</a>
                </div>
              </div>
            </ElectricBorder>
          </div>
        </section>

        <section className="faq-section reveal" id="faq">
          <div className="section-heading narrow">
            <span className="eyebrow">{t.faqEyebrow}</span>
            <h2>{t.faqTitle}</h2>
          </div>
          <div className="faq-grid">
            {t.faqs.map(([q, a]) => (
              <GlassSurface key={q} className="faq-card" borderRadius={20} backgroundOpacity={0.04}>
                <details><summary>{q}</summary><p>{a}</p></details>
              </GlassSurface>
            ))}
          </div>
        </section>

        <section className="final-cta reveal" id="contact">
          <BorderGlow className="final-cta-wrap" animated>
            <div className="final-cta-inner">
              <div><h2>{t.finalTitle}</h2><p>{t.finalBody}</p></div>
              <div className="cta-row compact"><BorderGlow className="cta-wrap"><Link className="cta-btn cta-primary" href="/signup">{t.nav.start}</Link></BorderGlow></div>
            </div>
          </BorderGlow>
        </section>
      </main>
      <AIChatBot />
    </div>
  )
}
