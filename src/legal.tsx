const OWNER = 'Dev Prakash Sahu'
const MAIL = 'devprakashsahu348@gmail.com'
export const UPDATED = '14 November 2026'
export const LEGAL: Record<string, { title: string; body: [string, string][] }> = {
  privacy: { title: 'Privacy Policy', body: [
    ['Who we are', `EON is operated by ${OWNER}. Contact: ${MAIL}.`],
    ['What we collect', 'Your name, email address and a bcrypt hash of your password. The code you upload for analysis and the results. Messages you send through the contact form. Security logs of sign-ins and changes.'],
    ['How we use it', 'To run your account, analyse your projects, send password-reset emails and answer your messages. We do not sell your data and we do not use your code to train models.'],
    ['AI guidance', 'If the optional AI Guide uses Google Gemini, the question you type and a short context snippet are sent to Google. Answers are labelled as AI-generated.'],
    ['Service providers', 'Vercel (hosting), Neon (database), Resend (email), Google (optional AI). Each processes data only to provide its service.'],
    ['Retention and your rights', `Delete a project at any time or email ${MAIL} to access, correct or delete your account. We act within 30 days.`],
  ]},
  terms: { title: 'Terms and Conditions', body: [
    ['Agreement', `By using EON you accept these terms with ${OWNER}.`],
    ['Your account', 'Keep your password private. You are responsible for activity under your account and must be 18 or older, or have a guardian\'s permission.'],
    ['Your code', 'You keep all rights in the code you upload. You grant us permission to process it only to provide EON. Upload only code you have the right to use.'],
    ['No guarantee', 'EON reports static checks and a transparent score. A higher score does not prove software is correct or secure. You approve every change and test it yourself before production use.'],
    ['Acceptable use', 'No malware, no attempts to break or overload the service, no uploading other people\'s secrets.'],
    ['Liability', 'The service is provided as is. To the extent allowed by law, we are not liable for indirect or consequential losses.'],
    ['Changes and law', `We may update these terms; the date above shows the latest version. Questions: ${MAIL}.`],
  ]},
  cookies: { title: 'Cookie Policy', body: [
    ['Essential cookie', 'eon_session keeps you signed in. It is HTTP-only, lasts 7 days and is required for the service.'],
    ['Local storage', 'We store your light/dark choice and your cookie-banner answer in your browser. They never leave your device.'],
    ['Analytics', 'No analytics or advertising cookies are set by default. If analytics are added later, this page will be updated and consent requested first.'],
    ['Control', 'Delete cookies in your browser settings. You will be signed out.'],
  ]},
  'payment-terms': { title: 'Payment Terms', body: [
    ['Current pricing', 'EON is free to use today. No payment details are collected.'],
    ['Future paid plans', 'If paid plans are introduced, prices and taxes will be shown before purchase. Payments will be handled by a third-party processor; we never see or store full card numbers.'],
    ['Refunds', 'For any paid plan: cancel before the next renewal to avoid further charges. Refund requests within 7 days of a first purchase are honoured. Email ' + MAIL + '.'],
    ['Changes', 'Price changes apply from the next billing period with 30 days\' notice.'],
  ]},
}
