import HomeMarquee from './HomeMarquee';
import HomePager from './HomePager';
import { useBreakpoint } from './railHooks';

/* Home's animation rail, by screen size. A phone shows one card at a time and a tablet two (a pager
   the visitor can swipe, with dots and a Pause button); a desktop shows the cards as a slow marquee
   that fades out before the headline. Both play the same five cards (cardTimelines.js). */
export default function HomeRail() {
  const size = useBreakpoint();
  return size === 'desktop' ? <HomeMarquee /> : <HomePager per={size === 'tablet' ? 2 : 1} />;
}
