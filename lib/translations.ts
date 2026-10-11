/**
 * Centralized translation dictionary.
 * Structured to easily support Urdu (RTL) or other locales in the future.
 */

export type Locale = 'en' | 'ur';

export interface AppDictionary {
  dir: 'ltr' | 'rtl';
  myLinks: {
    title: string;
    subtitle: string;
    noLinks: string;
    opens: string;
    downloads: string;
    lastActivity: string;
    lastOpened: string;
    lastDownloaded: string;
    never: string;
    timeLeft: string;
    expired: string;
    copyLink: string;
    copied: string;
    remove: string;
    privacyNotice: string;
    toastOpened: string;
    freeTierNotice: string;
    premiumHistoryBadge: string;
  };
  quickPaste: {
    title: string;
    subtitle: string;
    pairingCode: string;
    scanToPaste: string;
    waitingForText: string;
    waitingSubtitle: string;
    receivedText: string;
    copyText: string;
    copiedText: string;
    openUrl: string;
    historyTitle: string;
    clearHistory: string;
    noHistory: string;
    sessionExpiryNotice: string;
    newSession: string;
    phoneTitle: string;
    phoneSubtitle: string;
    enterCodePrompt: string;
    pastePlaceholder: string;
    sendButton: string;
    sending: string;
    sentSuccess: string;
    pasteClipboard: string;
    charCount: string;
    connectToPc: string;
    receivedToast: string;
  };
  features: {
    ephemeralTitle: string;
    ephemeralDesc: string;
    p2pTitle: string;
    p2pDesc: string;
    cloudTitle: string;
    cloudDesc: string;
  };
}

export const dictionaries: Record<Locale, AppDictionary> = {
  en: {
    dir: 'ltr',
    myLinks: {
      title: 'My Active Links & Activity',
      subtitle: 'Real-time opens, downloads, and time remaining for links created on this device.',
      noLinks: 'No active links yet. Upload a file above to generate a tracked link.',
      opens: 'Opens',
      downloads: 'Downloads',
      lastActivity: 'Last Activity',
      lastOpened: 'Opened',
      lastDownloaded: 'Downloaded',
      never: 'No activity yet',
      timeLeft: 'Time Left',
      expired: 'Expired',
      copyLink: 'Copy',
      copied: 'Copied!',
      remove: 'Remove',
      privacyNotice: 'We only count opens, nothing personal is saved.',
      toastOpened: 'Someone opened your link: {name}',
      freeTierNotice: 'Links auto-delete upon expiration.',
      premiumHistoryBadge: 'Live activity tracking',
    },
    quickPaste: {
      title: 'Quick Paste (Phone → PC)',
      subtitle: 'Instantly paste text, clipboard, and links from your phone to PC without files.',
      pairingCode: 'Pairing Code',
      scanToPaste: 'Scan with phone camera to send text or links',
      waitingForText: 'Waiting for phone to send text...',
      waitingSubtitle: 'Keep this screen open on your PC. Scan the QR code or enter the code on your phone.',
      receivedText: 'Received from Phone',
      copyText: 'Copy to Clipboard',
      copiedText: 'Copied!',
      openUrl: 'Open Link',
      historyTitle: 'Session History',
      clearHistory: 'Clear History',
      noHistory: 'No items received yet in this session.',
      sessionExpiryNotice: 'Sessions expire after 30 minutes of inactivity. Messages are never stored permanently.',
      newSession: 'New Code',
      phoneTitle: 'Send to PC',
      phoneSubtitle: 'Paired with PC: {code}',
      enterCodePrompt: 'Enter 6-digit PC Code',
      pastePlaceholder: 'Type or paste text, links, code snippets, or notes (up to 5,000 characters)...',
      sendButton: 'Send to PC',
      sending: 'Sending...',
      sentSuccess: 'Sent to PC instantly!',
      pasteClipboard: 'Paste from Clipboard',
      charCount: '{current} / 5,000 characters',
      connectToPc: 'Connect & Paste',
      receivedToast: 'New text received from phone!',
    },
    features: {
      ephemeralTitle: 'Private & Ephemeral',
      ephemeralDesc: 'Direct browser-to-browser streaming and auto-expiring links. Zero permanent logs, no tracking.',
      p2pTitle: 'Direct P2P Stream',
      p2pDesc: 'Files stream browser-to-browser via QR scan or 6-digit session code at maximum Wi-Fi bandwidth speed.',
      cloudTitle: 'Temporary Cloud Share',
      cloudDesc: 'Share files across remote locations using serverless storage with auto-expiration timers.',
    },
  },
  ur: {
    dir: 'rtl',
    myLinks: {
      title: 'میرے فعال لنکس اور سرگرمی',
      subtitle: 'اس ڈیوائس پر بنائے گئے لنکس کے اوپنز، ڈاؤن لوڈز اور باقی وقت کی لائیو تفصیلات۔',
      noLinks: 'ابھی تک کوئی فعال لنک نہیں ہے۔ اوپر فائل اپ لوڈ کر کے ٹریک شدہ لنک بنائیں۔',
      opens: 'اوپنز',
      downloads: 'ڈاؤن لوڈز',
      lastActivity: 'آخری سرگرمی',
      lastOpened: 'کھولا گیا',
      lastDownloaded: 'ڈاؤن لوڈ کیا گیا',
      never: 'ابھی تک کوئی سرگرمی نہیں',
      timeLeft: 'باقی وقت',
      expired: 'ختم شدہ',
      copyLink: 'کاپی کریں',
      copied: 'کاپی ہو گیا!',
      remove: 'ہٹائیں',
      privacyNotice: 'ہم صرف اوپنز گنتے ہیں، کوئی ذاتی معلومات محفوظ نہیں کی جاتیں۔',
      toastOpened: 'کسی نے آپ کا لنک کھولا ہے: {name}',
      freeTierNotice: 'لنکس کی میعاد ختم ہونے پر خود بخود ختم ہو جاتے ہیں۔',
      premiumHistoryBadge: 'لائیو سرگرمی کی ٹریکنگ',
    },
    quickPaste: {
      title: 'کوئیک پیسٹ (فون سے پی سی)',
      subtitle: 'فائل بھیجے بغیر فون سے کمپیوٹر پر فوری طور پر ٹیکسٹ اور لنکس منتقل کریں۔',
      pairingCode: 'پیئرنگ کوڈ',
      scanToPaste: 'ٹیکسٹ یا لنک بھیجنے کے لیے فون سے کیو آر اسکین کریں',
      waitingForText: 'فون سے ٹیکسٹ آنے کا انتظار ہے...',
      waitingSubtitle: 'پی سی پر یہ اسکرین کھلی رکھیں۔ فون سے کیو آر کوڈ اسکین کریں یا 6 ہندسوں کا کوڈ درج کریں۔',
      receivedText: 'فون سے موصول شدہ',
      copyText: 'کاپی کریں',
      copiedText: 'کاپی ہو گیا!',
      openUrl: 'لنک کھولیں',
      historyTitle: 'سیشن کی ہسٹری',
      clearHistory: 'ہسٹری صاف کریں',
      noHistory: 'اس سیشن میں ابھی تک کوئی ٹیکسٹ موصول نہیں ہوا۔',
      sessionExpiryNotice: '30 منٹ کی غیر موجودگی کے بعد سیشن ختم ہو جاتا ہے۔ کوئی میسج مستقل محفوظ نہیں ہوتا۔',
      newSession: 'نیا کوڈ',
      phoneTitle: 'پی سی کو بھیجیں',
      phoneSubtitle: 'پی سی سے منسلک: {code}',
      enterCodePrompt: '6 ہندسوں کا پی سی کوڈ درج کریں',
      pastePlaceholder: 'ٹیکسٹ، لنک، یا نوٹس لکھیں یا پیسٹ کریں (زیادہ سے زیادہ 5,000 حروف)...',
      sendButton: 'پی سی کو بھیجیں',
      sending: 'بھیجا جا رہا ہے...',
      sentSuccess: 'پی سی کو فوری طور پر بھیج دیا گیا!',
      pasteClipboard: 'کلپ بورڈ سے پیسٹ کریں',
      charCount: '{current} / 5,000 حروف',
      connectToPc: 'منسلک کریں اور پیسٹ کریں',
      receivedToast: 'فون سے نیا ٹیکسٹ موصول ہوا!',
    },
    features: {
      ephemeralTitle: 'محفوظ اور عارضی',
      ephemeralDesc: 'براہ راست براؤزر سے براؤزر منتقلی اور خود کار ختم ہونے والے لنکس۔ کوئی مستقل ریکارڈ نہیں، کوئی ٹریکنگ نہیں۔',
      p2pTitle: 'براہ راست P2P سلسلہ',
      p2pDesc: 'کیو آر کوڈ یا 6 ہندسوں والے کوڈ کے ذریعے زیادہ سے زیادہ رفتار پر فائلیں منتقل کریں۔',
      cloudTitle: 'عارضی کلاؤڈ شیئر',
      cloudDesc: 'خودکار خاتمے والے ٹائمرز کے ساتھ سرور لیس اسٹوریج کے ذریعے دور دراز فائلیں شیئر کریں۔',
    },
  },
};

export function getDictionary(locale: Locale = 'en'): AppDictionary {
  return dictionaries[locale] || dictionaries.en;
}
