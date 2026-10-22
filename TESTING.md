<!-- The five removed sports and their identified saved local data are deleted by the one-time startup purge (2026-10-22); no retention. -->
# Live Scoring Testing Guide - Sprint 2 E2E Testing

## Phase A Completed ✓
✅ Animation Enhancement (Haptic feedback, Confetti, Set won notifications)
✅ Draft Saving (Save in-progress matches, Resume functionality)

## Current Sprint: E2E Testing All 14 Sports
Testing all sports end-to-end to catch bugs before Phase C (Tennis Enhancement) and Phase D (Polish)

## New Features to Test (Phase A)

### 1. Haptic Feedback (Mobile)
- Short pulse (50ms) on point/goal scored
- Double pulse on set won (50ms, 100ms, 50ms)
- Victory pattern on match completion (5x 100ms pulses)
- Feature detection (works only if navigator.vibrate exists)

### 2. Confetti Animation
- Triggers on match completion (when score is not 0-0)
- 50 colored confetti pieces falling
- 3.5 second duration
- Respects prefers-reduced-motion setting

### 3. Set Won Notification (Sets-based sports only)
- Blue popup overlay showing "{Team} wins Set {N}!"
- 1.5 second duration
- Scale animation (popup effect)

### 4. Draft Saving
- "Save Draft" button appears after first score change
- Saves current state: sets/scores, currentSet/innings, history
- Match status becomes 'in-progress'
- Resume button shows "▶ Resume Match" in blue

### 5. Resume Functionality
- Restores exact state: scores, set/innings, history
- Undo history restored (can undo actions from before draft save)
- Continues seamlessly from where user left off

---

## Test Scenarios

### Test 1: Volleyball Tournament (Best-of-5, 25 points)

**Setup:**
1. Navigate to http://localhost:5173/volleyball/tournament
2. Create new tournament with 4 teams
3. Tournament will generate 6 matches (round-robin)

**Test Match 1: Complete match via tap-to-score**
1. Click "Enter Score" on Match 1
2. Verify full-screen scoring interface loads
3. Tap Team 1 card 25 times, Team 2 card 23 times
4. Verify Set 1 completes at 25-23
5. Verify auto-advance to Set 2
6. Score Set 2: 23-25 (Team 2 wins)
7. Verify auto-advance to Set 3
8. Score Set 3: 25-22 (Team 1 wins)
9. Score Set 4: 22-25 (Team 2 wins)
10. Score Set 5 (decider): 15-13 (Team 1 wins)
11. Verify match completes (no Set 6 starts)
12. Click "Save & Return"
13. Verify match shows "Completed" badge
14. Verify standings update correctly (Team 1: 3 sets won, Team 2: 2 sets won)

**Expected set history:**
- Set 1: 25-23
- Set 2: 23-25
- Set 3: 25-22
- Set 4: 22-25
- Set 5: 15-13 (decider uses 15 points, not 25)

**Test Match 2: Undo functionality**
1. Click "Enter Score" on Match 2
2. Score to 10-5 in Set 1
3. Click Undo 3 times
4. Verify score returns to 7-5
5. Continue to complete Set 1: 25-20
6. Verify auto-advance to Set 2
7. Score Set 2 to 20-15
8. Undo across set boundary (undo until Set 1 reopens)
9. Verify Set 1 score shows correctly and is editable
10. Cancel and discard changes
11. Verify match score was not saved

**Test Match 3: Edit existing match**
1. Enter and save Match 3: 25-20, 25-18 (2-0)
2. Return to tournament view
3. Click "Edit Score" on Match 3
4. Verify existing scores load correctly
5. Verify currentSet = 1 (Set 2)
6. Verify Set 2 is marked as completed (tap-to-score blocked)
7. Click Undo to reopen Set 2
8. Modify score to 25-19
9. Save & Return
10. Verify updated score persists

**Test Match 4: Save incomplete match**
1. Enter Match 4: Set 1: 25-21, Set 2: 15-10 (in progress)
2. Click "Save & Return"
3. Verify match shows "In Progress" badge
4. Click "Edit Score"
5. Verify loads at Set 2 with score 15-10
6. Verify tap-to-score works (Set 2 not marked as completed)
7. Complete Set 2: 25-10
8. Complete Set 3: 25-15
9. Save & Return
10. Verify match shows "Completed" badge

---

### Test 2: Badminton Tournament (Best-of-3, 21 points, cap at 30)

**Setup:**
1. Navigate to http://localhost:5173/badminton/tournament
2. Create new tournament with 4 teams

**Test Match 1: Standard match**
1. Enter Score on Match 1
2. Score Set 1: 21-19 (win by 2, completes)
3. Verify auto-advance
4. Score Set 2: 21-17
5. Verify match completes (no Set 3 needed for 2-0)
6. Save & Return
7. Verify standings show correct badminton scoring

**Test Match 2: Deuce and cap logic**
1. Enter Score on Match 2
2. Score Set 1 to 20-20 (deuce)
3. Continue scoring: 21-21, 22-22, 23-23... up to 29-29
4. Score to 30-29
5. Verify Set 1 completes (cap at 30)
6. Verify doesn't require win by 2 at cap
7. Complete Set 2 normally: 21-18
8. Save & Return

**Test Match 3: Three-set thriller**
1. Score Set 1: 21-18 (Team 1)
2. Score Set 2: 19-21 (Team 2)
3. Score Set 3: 21-15 (Team 1)
4. Verify match completes at 2-1
5. Save & Return

---

### Remaining Registered Sports Quick Test Checklist

**Table Tennis** (Best-of-5, 11 pts): http://localhost:5173/table-tennis/tournament
- [ ] Complete match (3-1), test deuce, undo, draft save, resume

**Tennis** (simplified scoring): http://localhost:5173/tennis/tournament
- [ ] Complete match with simplified scoring
- [ ] Note: Full tennis scoring pending Phase C enhancement

**Football** (Goals, draws allowed): http://localhost:5173/football/tournament
- [ ] Score winner (3-1) and draw (2-2)
- [ ] Verify standings: Win=3pts, Draw=1pt, Loss=0pts

**Basketball** (Goals, no draws, +1/+2/+3): http://localhost:5173/basketball/tournament
- [ ] Test quick buttons (+1, +2, +3)
- [ ] Verify draw rejection alert

**Hockey** (Goals, draws allowed): http://localhost:5173/hockey/tournament
- [ ] Score winner and draw
- [ ] Test draft save/resume

**Kabaddi** (Goals, no draws): http://localhost:5173/kabaddi/tournament
- [ ] Score match point-by-point

**Cricket** (2 innings, 10 wickets): http://localhost:5173/cricket/tournament
- [ ] Score complete innings 1
- [ ] Verify auto-advance to innings 2 after 10 wickets
- [ ] Score innings 2, verify target chase
- [ ] Test all extras (wide, no-ball, bye, leg-bye)
- [ ] Test boundaries (4 runs, 6 runs)
- [ ] Test draft save mid-innings
- [ ] Test resume with correct innings restoration

---

## Validation Checks

### Volleyball Validation (25/25/25/25/15 format)
- ✅ Sets 1-4: Minimum 25 points
- ✅ Set 5 (decider): Minimum 15 points
- ✅ All sets: Must win by 2
- ✅ No maximum cap

### Badminton Validation (21/21/21 format)
- ✅ All sets: Minimum 21 points
- ✅ Must win by 2
- ✅ Cap at 30 (30-29 is valid win)

---

## UI/UX Checks

### Layout
- ✅ Top bar: Back button + "Set X of Y" badge
- ✅ Center: Large tap-to-score cards side-by-side
- ✅ Bottom info: Set history (completed sets)
- ✅ Bottom bar: Undo + Cancel + Save & Return

### Interactions
- ✅ Tap entire card to increment score
- ✅ Score animates with score-pop effect
- ✅ Undo button disabled when history empty
- ✅ Unsaved changes warning on Cancel
- ✅ Set completes with visual feedback
- ✅ Auto-advances to next set smoothly

### Responsive
- ✅ Works on mobile (large tap targets)
- ✅ Works on desktop (mouse clicks)
- ✅ Score font scales appropriately

---

## Edge Cases

### Edge Case 1: Long deuce
- Score volleyball set to 40-38
- Verify continues past 25 as long as win-by-2 not met
- Verify completes correctly at 40-38

### Edge Case 2: Badminton cap
- Score to 30-29 → completes immediately
- Score to 29-30 → completes immediately
- Verify doesn't continue to 31

### Edge Case 3: Undo when history empty
- New match, click Undo immediately
- Verify button is disabled
- Verify no error occurs

### Edge Case 4: Cancel with unsaved changes
- Score several points
- Click Cancel
- Verify confirmation prompt
- Click Cancel on prompt → stays in scoring
- Click OK on prompt → returns to tournament

### Edge Case 5: Edit completed match
- Complete and save a match
- Click "Edit Score"
- Verify last set is marked completed
- Verify tap-to-score blocked
- Verify Undo still works
- Undo to reopen set
- Verify tap-to-score now works

### Edge Case 6: Old data without 'completed' flag
- Manually create match in localStorage without completed flags
- Edit the match
- Verify sets load as editable
- Complete the match
- Verify saves with completed flags

---

## Regression Testing

### Quick Match (existing feature)
- ✅ Navigate to /volleyball/quick
- ✅ Verify tap-to-score still works
- ✅ Verify no breaking changes

### Tournament Setup
- ✅ Create new tournament
- ✅ Verify match generation works
- ✅ Verify navigation to tournament view

### Statistics Page
- ✅ Complete several matches
- ✅ Navigate to /statistics
- ✅ Verify aggregates display correctly

---

## Performance Testing

### Rapid Tapping
1. Tap Team 1 card as fast as possible 25 times
2. Verify all taps register correctly
3. Verify no duplicate points
4. Verify smooth animation

### Large History
1. Score full 5-set volleyball match (125+ total points)
2. Verify Undo works after 50+ actions
3. Verify no performance degradation

### Multiple Saves
1. Enter match partially, save
2. Edit, continue scoring, save
3. Edit again, modify, save
4. Verify data integrity maintained

---

## Browser Testing

Test on:
- ✅ Chrome (desktop)
- ✅ Firefox (desktop)
- ✅ Safari (iOS)
- ✅ Chrome (Android)

---

## Success Criteria

All of the following must pass:

1. ✅ Can enter complete volleyball match (5 sets) via tap only
2. ✅ Can enter complete badminton match (3 sets) via tap only
3. ✅ Undo reverts last 50+ actions correctly
4. ✅ Auto-advances through sets smoothly
5. ✅ Decider set uses correct point target (volleyball 15, badminton 21)
6. ✅ Badminton caps at 30 points correctly
7. ✅ Saves correctly to tournament state
8. ✅ Standings recalculate properly
9. ✅ Can edit incomplete match and continue
10. ✅ Can edit completed match via undo
11. ✅ Unsaved changes warning works
12. ✅ No console errors during entire flow
13. ✅ Tap targets work well on mobile
14. ✅ Score-pop animation is smooth

---

## Known Issues

None at this time. Bug fixed: match completion now correctly counts only completed sets.

---

## Bug Tracker - Sprint 2

### Critical Bugs (Blocking)
*None found yet*

### High Priority Bugs
*To be filled during testing*

### Medium Priority Bugs
1. **Tennis Simplified Scoring** (Known Issue)
   - Status: Documented, not a bug
   - Impact: Users expecting real tennis scoring (0-15-30-40) will be confused
   - Fix: Phase C - Implement MonoTennisLiveScore.jsx with proper tennis rules
   - Workaround: Document that tennis currently uses simplified scoring

### Low Priority Bugs
*To be filled during testing*

### Fixed Bugs
1. ✅ **Match completion check** - Now correctly counts only completed sets
   - Fixed in: MonoSetsLiveScore.jsx line 164-166
   - Previous issue: Counted all sets where one team was ahead
   - Resolution: Filter by `s.completed` flag

---

## Phase A Feature Validation

### Haptic Feedback Status
- [ ] Tested on iOS Safari
- [ ] Tested on Chrome Android
- [ ] Confirmed feature detection works
- [ ] Confirmed different patterns for different events

### Confetti Status
- [ ] Triggers on match completion
- [ ] Respects reduced-motion preference
- [ ] 3.5 second duration confirmed
- [ ] No memory leaks after multiple matches

### Set Won Notification Status
- [ ] Displays correctly in sets-based sports
- [ ] 1.5 second duration confirmed
- [ ] Animation smooth
- [ ] Doesn't interfere with scoring

### Draft Saving Status
- [ ] Save Draft button appears after first change
- [ ] Draft state persists in localStorage
- [ ] Resume restores exact state
- [ ] History restored correctly (undo works)
- [ ] Works across all 14 sports

---

## Next Steps After Sprint 2

**Current Sprint:** Sprint 2 - E2E Testing (ALL 14 SPORTS) ← YOU ARE HERE

**After Sprint 2 Completes:**
- Option 1: Sprint 3 - Accessibility (WCAG 2.1 AA)
- Option 2: Sprint 4 - Performance Optimization
- Option 3: Phase C - Tennis Enhancement (Full tennis scoring)

**Remaining Plan:**
- Sprint 3: WCAG 2.1 AA Accessibility (6-8 hours)
- Sprint 4: Performance Optimization (4-6 hours)
- Sprint 5: Mobile Device Testing (4-6 hours)
- Sprint 6: Edge Cases & Documentation (6-8 hours)
- Phase C: Tennis Enhancement (8-12 hours)
