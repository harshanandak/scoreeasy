/* The landing FAQ. GuestLanding renders these in collapsed disclosure rows, and index.html carries the same
   questions and answers word for word as FAQPage JSON-LD (a test keeps the two in step). Every
   answer states only what the shipped app does:
   - scoring needs no account, and every point is saved on the device first (guest scoring);
   - saving finished matches to an account and going live both need a sign in
     (LiveBroadcastBar only publishes for a signed-in scorer);
   - a match stays private until the scorer shares it;
   - the app has no payment or subscription code, so the free answer lists only what is free today.
   The sport list lives in the hero sub-line and the picker, so the FAQ does not repeat it. */
export const LANDING_FAQ = [
  {
    question: 'Do I need an account to score a match?',
    answer: 'No. Pick a sport, tap Start and score. Your matches save on your phone. Sign in only if you want matches saved to your account or a live share link.',
  },
  {
    question: 'Does Score Easy work offline?',
    answer: 'Yes. Scoring runs on your phone and saves every point there first, so a weak signal does not lose one. Saving to your account and live sharing need a connection.',
  },
  {
    question: 'Can friends follow the score live?',
    answer: 'Yes. Sign in, go live on a match and send the link. Friends open the link to follow the score. A match stays private until you share it.',
  },
  {
    question: 'Is Score Easy free?',
    answer: 'Yes. Scoring, tournaments and an account are free.',
  },
];
