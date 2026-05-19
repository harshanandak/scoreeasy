import { useEffect } from 'react';
import { getTournamentTypeLabel, isPureKnockoutTournament, shouldShowKnockoutStage } from '../../../utils/tournamentDisplay';

function getTabId(tab) {
  return typeof tab === 'string' ? tab : tab.id;
}

export default function useTournamentKnockoutDisplay({
  tournament,
  tab,
  setTab,
  baseTabs = ['matches', 'standings'],
  knockoutTab = 'knockout',
  trailingTabs = ['teams'],
  labelOptions = {},
}) {
  const isPureKnockout = isPureKnockoutTournament(tournament);
  const configuredKnockouts = tournament?.winnerMode === 'knockouts';
  const knockoutTabId = getTabId(knockoutTab);
  const showKnockoutStage = shouldShowKnockoutStage({
    isPureKnockout,
    hasKnockouts: configuredKnockouts,
  });

  useEffect(() => {
    if (isPureKnockout && tab === 'matches') setTab(knockoutTabId);
  }, [isPureKnockout, knockoutTabId, setTab, tab]);

  const tabs = isPureKnockout ? [knockoutTab] : [...baseTabs];
  if (configuredKnockouts && !isPureKnockout) tabs.push(knockoutTab);
  tabs.push(...trailingTabs);

  return {
    hasKnockouts: showKnockoutStage,
    isPureKnockout,
    tabs,
    tournamentTypeLabel: getTournamentTypeLabel({ isPureKnockout, hasKnockouts: configuredKnockouts, ...labelOptions }),
  };
}
