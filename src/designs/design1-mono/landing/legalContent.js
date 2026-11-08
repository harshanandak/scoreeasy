/* The words of the Privacy, Terms and Contact pages.
   Every sentence here must stay true of the code and services (Clerk sign-in, Convex storage,
   Cloudflare hosting, optional Sentry crash reports). When a feature or service changes, change
   the sentence in the same PR. A block is { heading, paragraphs?, items? }. */

export const OPERATOR = 'Harsha Nanda';
export const CONTACT_EMAIL = 'thesouthbrick@gmail.com';
export const LAST_UPDATED = '9 November 2026';

export const pages = {
  privacy: {
    title: 'Privacy',
    lead: `How Score Easy handles your data. Score Easy is run by ${OPERATOR}.`,
    blocks: [
      {
        heading: 'The short version',
        items: [
          'You can score as a guest without an account.',
          'We do not sell your data. We do not use advertising or product-analytics tools.',
          'A match is private to you until you share it, one match at a time.',
          `To delete your Score Easy data from our database, email us at ${CONTACT_EMAIL}.`,
        ],
      },
      {
        heading: 'Who runs Score Easy',
        paragraphs: [
          `Score Easy is run by ${OPERATOR}. In this policy, "we" means ${OPERATOR}.`,
          `Questions, requests and complaints about your data go to ${CONTACT_EMAIL}.`,
        ],
      },
      {
        heading: 'What stays on your device',
        paragraphs: [
          'Matches you score, drafts, history and a few settings are saved in your browser or app storage on your device. This is how scoring works without an account and without a signal.',
          'The same storage holds a queue of live score updates that are waiting to be sent, your choice about sharing live matches, and a random ID that is sent only if you report a shared match.',
          'When you sign in, Clerk also keeps a sign-in session on your device.',
          'Guest matches stay on your device. Data on your device normally stays until you delete it or clear your browser or app data. App updates can remove data for retired sports, and browser or device storage limits can remove it sooner.',
        ],
      },
      {
        heading: 'What we collect when you sign in',
        paragraphs: [
          'Signing in is handled by Clerk. Clerk collects what it needs to sign you in, such as your email address, your name, your profile picture and the sign-in method you choose.',
          'We then store these in our database, which is run by Convex:',
        ],
        items: [
          'your sign-in identifier, email address, display name, profile picture link and join date',
          'the username, role, favourite games and play style you choose when you set up your profile, your first and last names and when you completed profile setup',
        ],
      },
      {
        heading: 'Matches saved to your account',
        paragraphs: [
          'When you are signed in, the app tries to save finished match results to your account. Saving needs a connection and can fail. What is saved depends on the sport and can include duration, format and detailed scores. A saved match holds at least the sport, team names, scores and date.',
          'The team names you use are saved so the app can suggest them to you again. If you tag another user as a player, that link is saved with the match.',
          'Saved matches are private to you. Tagging someone does not let them or anyone else see the match.',
        ],
      },
      {
        heading: 'What is public',
        paragraphs: [
          'Two things can be seen by people other than you.',
        ],
        items: [
          'A match you choose to share live. See the next section.',
          'Your profile card: your username, display name, profile picture and join date. Anyone who knows your username can open it without signing in.',
        ],
        after: [
          'Signed-in users can search usernames. Search results show your username, display name, profile picture and selected role.',
        ],
      },
      {
        heading: 'Sharing a match live',
        paragraphs: [
          'Every new match starts private. A match is shared only when you tap Share live on that match.',
          'When you share, anyone with the link can watch without signing in. They can see the sport, score and status, team names and colours, serve, set or period information, and the scoring events with their times. They cannot see your email, your username or your other matches.',
          'While a shared match is live, it can also appear in the Live list in the app, where anyone can see its team names and score.',
          'Stop sharing needs a connection. Once it succeeds, the link no longer allows access. Shared matches expire 24 hours after our server receives the finished match; finishing offline can delay this.',
          'Stopping or expiry does not delete the match. It stays in our database, private to you, until it is deleted.',
          'Anyone watching can report a shared match. We store the reason and a random ID from their device.',
        ],
      },
      {
        heading: 'Crash reports',
        paragraphs: [
          'Score Easy can send crash reports to Sentry so we can find and fix bugs. A report can include the error, the page address, device and browser type, recent app actions (breadcrumbs) and basic timing. We do not add your name or email to them.',
        ],
      },
      {
        heading: 'Other services we use',
        paragraphs: [
          'These services handle data for us. We do not sell your data to them or to anyone else.',
        ],
        items: [
          'Clerk, for sign-in.',
          'Convex, for the database and live score updates.',
          'Cloudflare, for hosting the app. Like any host, it handles the network requests needed to deliver the app, which include your IP address, and it may keep logs of them.',
          'Sentry, for crash reports.',
          'Google Fonts, to load the fonts the app uses. Loading them sends requests to Google.',
        ],
        after: [
          'These services may store data in other countries. The iOS and Android apps use the same services. They use your phone for sharing and vibration feedback. The iOS and Android apps add no separate tracking tools.',
        ],
      },
      {
        heading: 'How long we keep data',
        paragraphs: [
          'We keep your account data and saved matches for as long as your account exists. We do not delete them automatically.',
          'Data on your device normally stays until you delete it or clear your browser or app data. App updates can remove data for retired sports, and browser or device storage limits can remove it sooner.',
        ],
      },
      {
        heading: 'Deleting your data',
        paragraphs: [
          'On your device, delete a match from History or clear your browser or app data. Deleting a match in the app removes it from that device only. It does not remove a copy saved to your account.',
          `To delete your Score Easy data (saved matches, profile and shared matches) from our database, email us at ${CONTACT_EMAIL}. Send it from the email address on your account.`,
          `You can also email us to ask what data we hold about you or to correct it.`,
        ],
      },
      {
        heading: 'Children',
        paragraphs: [
          'You must be at least 13 to create an account. Do not create an account if you are under 13.',
          'The app does not ask your age. If we learn that an account belongs to a child under 13, we will delete it.',
        ],
      },
      {
        heading: 'Changes to this policy',
        paragraphs: [
          'When we change this policy, we change the date at the top of this page.',
        ],
      },
    ],
  },

  terms: {
    title: 'Terms',
    lead: `The rules for using Score Easy. Score Easy is run by ${OPERATOR}.`,
    blocks: [
      {
        heading: 'Who we are',
        paragraphs: [
          `Score Easy is run by ${OPERATOR}. In these terms, "we" means ${OPERATOR}. You can reach us at ${CONTACT_EMAIL}.`,
          'By using Score Easy you agree to these terms and to the Privacy policy.',
        ],
      },
      {
        heading: 'Using the app',
        paragraphs: [
          'You can score as a guest without an account.',
          'To create an account you must be at least 13. Give accurate details and keep your sign-in safe. You are responsible for what happens under your account.',
        ],
      },
      {
        heading: 'Not an official record',
        paragraphs: [
          'Score Easy is a scorekeeping tool. It is not an official referee or tournament record. Check scores before you share them or rely on them.',
        ],
      },
      {
        heading: 'Your content',
        paragraphs: [
          'Your content is the team names, player names, notes and scores you enter. You keep ownership of it.',
          'You let us store it and show it as the app needs to: to save your matches, sync them to your devices, and show shared matches to the people you share them with.',
          'Do not enter personal details about other people unless you have their permission. Take extra care with the names of children before you share a match live.',
        ],
      },
      {
        heading: 'Sharing live',
        paragraphs: [
          'You decide which matches to share. Anyone with the link can see a shared match, and it can appear in the Live list.',
          'Share only what you have the right to share. You can stop sharing at any time.',
          'We may hide or remove a shared match that breaks these terms.',
        ],
      },
      {
        heading: 'What not to do',
        paragraphs: [
          'Do not use Score Easy to publish content that is abusive, hateful, sexual, unlawful, misleading or spam.',
          'Do not try to break the app, overload it, or reach other people\'s data.',
        ],
      },
      {
        heading: 'Availability',
        paragraphs: [
          'Local scoring is built to keep working without a connection. Sync, sign-in and live sharing need one.',
          'We may change or stop features.',
        ],
      },
      {
        heading: 'No warranty, limited liability',
        paragraphs: [
          'Score Easy is provided as it is, without promises that it will always work or be free of errors.',
          'As far as the law allows, we are not liable for indirect loss, or for lost or wrong match data. Keep your own record of results that matter.',
        ],
      },
      {
        heading: 'Ending your use',
        paragraphs: [
          `You can stop using Score Easy at any time. To delete your Score Easy data (saved matches, profile and shared matches) from our database, email us at ${CONTACT_EMAIL}.`,
          'We may suspend an account that breaks these terms.',
        ],
      },
      {
        heading: 'Changes and law',
        paragraphs: [
          'When we change these terms, we change the date at the top of this page. If you keep using the app after that, you accept the new terms.',
          'These terms are governed by the laws of India.',
        ],
      },
    ],
  },

  contact: {
    title: 'Contact',
    lead: `Score Easy is run by ${OPERATOR}.`,
    blocks: [
      {
        heading: 'Email',
        paragraphs: [
          `For support, privacy questions, data deletion or store review questions, email ${CONTACT_EMAIL}.`,
        ],
      },
      {
        heading: 'Delete your data',
        paragraphs: [
          `To delete your Score Easy data (saved matches, profile and shared matches) from our database, email us at ${CONTACT_EMAIL}. Send it from the email address on your account.`,
        ],
      },
      {
        heading: 'What to include',
        paragraphs: [
          'Your sport, your device, your browser or app version, and the page where the problem happened.',
          'For a scoring bug, add the match format and the last action before the problem.',
        ],
      },
    ],
  },
};
