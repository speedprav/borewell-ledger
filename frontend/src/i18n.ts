// i18n.ts - Simple dictionary-based i18n
// English: complete. Hindi & Gujarati: navigation, buttons, statuses, key labels.
// Falls back to English for missing keys.

import type { Language } from './types'

type Dict = Record<string, string>

const en: Dict = {
  // Navigation
  'nav.home': 'Home',
  'nav.map': 'Map',
  'nav.add': 'Add Reading',
  'nav.wells': 'My Wells',
  'nav.alerts': 'Alerts',
  'nav.assistant': 'AI Assistant',
  'nav.plan': 'Water-Saving Plan',
  'nav.community': 'Community',
  'nav.settings': 'Settings',
  'nav.about': 'About',

  // Statuses
  'status.NORMAL': 'Normal',
  'status.WATCH': 'Watch',
  'status.CRITICAL': 'Critical',
  'status.NOT_ENOUGH_DATA': 'Not enough data',

  // Owner types
  'owner.society': 'Housing Society',
  'owner.farm': 'Farm',
  'owner.other': 'Other',

  // Roles
  'role.society': 'Society Manager',
  'role.farm': 'Farmer',
  'role.officer': 'Water Officer / Panchayat',
  'role.ngo': 'NGO / Volunteer',

  // Common actions
  'action.save': 'Save',
  'action.cancel': 'Cancel',
  'action.retry': 'Retry',
  'action.submit': 'Submit',
  'action.view': 'View Details',
  'action.add_reading': 'Add Reading',
  'action.ask_ai': 'Ask AI',
  'action.get_plan': 'Get Water-Saving Plan',
  'action.mark_seen': 'Mark as Seen',
  'action.mark_resolved': 'Mark Resolved',
  'action.run_analysis': 'Run Analysis Now',
  'action.export_csv': 'Export CSV',
  'action.download_pdf': 'Download PDF',
  'action.explore_demo': 'Explore Demo Data',
  'action.get_started': 'Get Started',

  // Labels
  'label.depth': 'Depth',
  'label.rate': 'Decline Rate',
  'label.peer_median': 'Peer Median',
  'label.last_reading': 'Last Reading',
  'label.status': 'Status',
  'label.locality': 'Locality',
  'label.source': 'Source',
  'label.pump_depth': 'Pump Depth',
  'label.dryout': 'Dry-out Estimate',
  'label.peer_count': 'Nearby Wells',
  'label.readings_count': 'Readings',

  // Demo
  'demo.badge': 'Demo data',
  'demo.notice': 'This screen contains simulated demo data, labeled for transparency.',

  // Welcome
  'welcome.tagline': 'Know your groundwater before it runs dry.',
  'welcome.subtitle': 'Track borewell levels, compare with nearby wells, and get early warnings.',

  // Errors
  'error.load_failed': 'Failed to load data',
  'error.submit_failed': 'Submission failed',
  'error.network': 'Network error. Check your connection.',

  // Offline
  'offline.banner': 'You are offline. Readings will be saved and submitted when you reconnect.',

  // AI
  'ai.disclaimer': 'AI analysis is for guidance only. Consult a qualified hydrogeologist or water authority for decisions.',
  'ai.template_notice': '⚠️ Template advice — AI unavailable. Suggestions based on fixed rules.',
  'ai.thinking': 'Thinking…',
  'ai.chat_placeholder': 'Ask about your borewell…',

  // Analysis
  'analysis.what_happening': 'What is Happening',
  'analysis.possible_reasons': 'Possible Reasons',
  'analysis.confidence': 'How Sure Are We',
  'analysis.next_steps': 'Suggested Next Steps',

  // Units
  'unit.m': 'm',
  'unit.ft': 'ft',
  'unit.mpm': 'm/month',
  'unit.km': 'km',
  'unit.months': 'months',
}

const hi: Dict = {
  'nav.home': 'होम',
  'nav.map': 'नक्शा',
  'nav.add': 'पठन जोड़ें',
  'nav.wells': 'मेरे कुएं',
  'nav.alerts': 'अलर्ट',
  'nav.assistant': 'AI सहायक',
  'nav.plan': 'जल-बचत योजना',
  'nav.community': 'समुदाय',
  'nav.settings': 'सेटिंग',
  'nav.about': 'के बारे में',

  'status.NORMAL': 'सामान्य',
  'status.WATCH': 'ध्यान दें',
  'status.CRITICAL': 'गंभीर',
  'status.NOT_ENOUGH_DATA': 'पर्याप्त डेटा नहीं',

  'owner.society': 'हाउसिंग सोसायटी',
  'owner.farm': 'खेत',
  'owner.other': 'अन्य',

  'role.society': 'सोसायटी प्रबंधक',
  'role.farm': 'किसान',
  'role.officer': 'जल अधिकारी / पंचायत',
  'role.ngo': 'NGO / स्वयंसेवक',

  'action.save': 'सहेजें',
  'action.cancel': 'रद्द करें',
  'action.retry': 'पुनः प्रयास',
  'action.submit': 'जमा करें',
  'action.view': 'विवरण देखें',
  'action.add_reading': 'पठन जोड़ें',
  'action.ask_ai': 'AI से पूछें',
  'action.get_plan': 'जल-बचत योजना प्राप्त करें',
  'action.mark_seen': 'देखा हुआ चिह्नित करें',
  'action.mark_resolved': 'हल हुआ चिह्नित करें',
  'action.run_analysis': 'अभी विश्लेषण चलाएं',
  'action.export_csv': 'CSV निर्यात',
  'action.get_started': 'शुरू करें',
  'action.explore_demo': 'डेमो डेटा देखें',

  'label.depth': 'गहराई',
  'label.rate': 'गिरावट दर',
  'label.status': 'स्थिति',
  'label.locality': 'इलाका',
  'label.last_reading': 'अंतिम पठन',
  'demo.badge': 'डेमो डेटा',
  'offline.banner': 'आप ऑफलाइन हैं। पुनः कनेक्ट होने पर पठन सबमिट किए जाएंगे।',
}

const gu: Dict = {
  'nav.home': 'હોમ',
  'nav.map': 'નકશો',
  'nav.add': 'વાંચન ઉમેરો',
  'nav.wells': 'મારા કૂવા',
  'nav.alerts': 'ચેતવણી',
  'nav.assistant': 'AI સહાયક',
  'nav.plan': 'જળ-બચત યોજના',
  'nav.community': 'સમુદાય',
  'nav.settings': 'સેટિંગ',
  'nav.about': 'વિશે',

  'status.NORMAL': 'સામાન્ય',
  'status.WATCH': 'ધ્યાન આપો',
  'status.CRITICAL': 'ગંભીર',
  'status.NOT_ENOUGH_DATA': 'પૂરતો ડેટા નથી',

  'owner.society': 'હાઉસિંગ સોસાયટી',
  'owner.farm': 'ખેત',
  'owner.other': 'અન્ય',

  'role.society': 'સોસાયટી મેનેજર',
  'role.farm': 'ખેડૂત',
  'role.officer': 'જળ અધિકારી / પંચાયત',
  'role.ngo': 'NGO / સ્વૈચ્છિક સેવક',

  'action.save': 'સાચવો',
  'action.cancel': 'રદ કરો',
  'action.retry': 'ફરી પ્રયાસ',
  'action.submit': 'સબમિટ',
  'action.view': 'વિગત જુઓ',
  'action.add_reading': 'વાંચન ઉમેરો',
  'action.ask_ai': 'AI ને પૂછો',
  'action.get_plan': 'જળ-બચત યોજના મેળવો',
  'action.mark_seen': 'જોવાયેલ ચિહ્નિત કરો',
  'action.mark_resolved': 'ઉકેલ ચિહ્નિત કરો',
  'action.run_analysis': 'અત્યારે વિશ્લેષણ ચલાવો',
  'action.export_csv': 'CSV નિકાસ',
  'action.get_started': 'શરૂ કરો',
  'action.explore_demo': 'ડેમો ડેટા જુઓ',

  'label.depth': 'ઊંડાઈ',
  'label.rate': 'ઘટાડો દર',
  'label.status': 'સ્થિતિ',
  'label.locality': 'વિસ્તાર',
  'label.last_reading': 'છેલ્લું વાંચન',
  'demo.badge': 'ડેમો ડેટા',
  'offline.banner': 'તમે ઑફ‌લાઇન છો. ફરીથી કનેક્ટ થવા પર વાંચન સબમિટ થશે.',
}

const dicts: Record<Language, Dict> = { en, hi, gu }

let currentLang: Language = 'en'

export function setLanguage(lang: Language) {
  currentLang = lang
}

export function t(key: string, lang?: Language): string {
  const l = lang || currentLang
  return dicts[l]?.[key] || dicts['en'][key] || key
}

export function useT(lang: Language) {
  return (key: string) => t(key, lang)
}
