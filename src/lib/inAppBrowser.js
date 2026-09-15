/**
 * Détection des navigateurs intégrés aux apps (Messenger, Facebook, Instagram…).
 *
 * Ces « webviews » cassent la connexion Google : la pop-up y est interdite et la
 * redirection perd le sessionStorage entre l'aller et le retour, ce qui finit
 * sur la page Firebase « Unable to process request due to missing initial
 * state ». Plutôt que d'essayer, on demande d'ouvrir l'app dans un vrai
 * navigateur.
 */

const IN_APP_BROWSERS = [
  { name: 'Messenger', test: /FB_IAB\/Orca|FBAN\/Messenger|Messenger/i },
  { name: 'Facebook', test: /FBAN|FBAV|FB_IAB|FB4A|FBIOS/i },
  { name: 'Instagram', test: /Instagram/i },
  { name: 'WhatsApp', test: /WhatsApp/i },
  { name: 'Snapchat', test: /Snapchat/i },
  { name: 'TikTok', test: /TikTok|musical_ly|BytedanceWebview/i },
  { name: 'LinkedIn', test: /LinkedInApp/i },
  { name: 'Twitter', test: /Twitter/i },
  { name: 'Line', test: /\bLine\//i },
  // Webview Android générique (« ; wv) » dans le user-agent).
  { name: null, test: /; wv\)/i }
];

const detectOs = (ua) => {
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  return null;
};

/**
 * @param {string} [ua] user-agent, par défaut celui du navigateur courant
 * @returns {{ inApp: boolean, name: string|null, os: 'android'|'ios'|null }}
 */
export function detectInAppBrowser(ua = typeof navigator === 'undefined' ? '' : navigator.userAgent) {
  const os = detectOs(ua);
  const match = IN_APP_BROWSERS.find(({ test }) => test.test(ua));
  if (!match) return { inApp: false, name: null, os };
  return { inApp: true, name: match.name, os };
}

/**
 * Lien Android `intent://` qui demande au système d'ouvrir l'adresse dans le
 * navigateur par défaut, hors de la webview. Sur iPhone, il n'existe pas
 * d'équivalent : il faut passer par le menu de l'app (« Ouvrir dans Safari »).
 */
export function androidBrowserIntent(url = typeof location === 'undefined' ? '' : location.href) {
  if (!url) return null;
  const { protocol, host, pathname, search, hash } = new URL(url);
  const scheme = protocol.replace(':', '');
  const fallback = encodeURIComponent(url);
  return `intent://${host}${pathname}${search}${hash}#Intent;scheme=${scheme};action=android.intent.action.VIEW;S.browser_fallback_url=${fallback};end`;
}
