// ===================================
// 커스텀 섯다 - 게임 로직 (logic.js)
// ===================================

// ----- 카드 & 덱 -----
// 카드 = { number: 1~10, isGwang: true/false }
// 1, 3, 8은 두 장 중 한 장이 광
function createDeck() {
  const deck = [];
  const gwangNumbers = [1, 3, 8];
  for (let n = 1; n <= 10; n++) {
    deck.push({ number: n, isGwang: false });
    deck.push({ number: n, isGwang: gwangNumbers.includes(n) });
  }
  return deck; // 총 20장
}

function shuffle(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function dealHands(deck, playerCount = 5) {
  const shuffled = shuffle(deck);
  const hands = [];
  for (let i = 0; i < playerCount; i++) {
    hands.push([shuffled[i * 2], shuffled[i * 2 + 1]]);
  }
  return hands; // [[card,card], [card,card], ...]
}

// ----- 낼 카드 결정 -----
// 손패가 같은 숫자(개인 땡)면 무조건 2장 다 냄. 아니면 선택된 카드 하나만 냄
function resolvePlayed(hand, chosenCard) {
  if (hand[0].number === hand[1].number) {
    return [hand[0], hand[1]]; // 개인 땡, 강제로 둘 다
  }
  return [chosenCard]; // 일반적으로는 1장 선택
}

// ----- 조합 판정 (1vs1 결투에서 남은 카드 비교용) -----
// 두 숫자를 조합해서 족보 순위를 매김 (rank 숫자가 작을수록 강함)
// 강한 순서: 알리 > 독사 > 구삥 > 장삥 > 장사 > 세육 > 갑오 > 끗 > 망통
function evaluateCombo(numA, numB) {
  const [m1, m2] = [numA, numB].sort((a, b) => a - b);

  if (m1 === 1 && m2 === 2) return { rank: 1, name: '알리' };
  if (m1 === 1 && m2 === 4) return { rank: 2, name: '독사' };
  if (m1 === 1 && m2 === 9) return { rank: 3, name: '구삥' };
  if (m1 === 1 && m2 === 10) return { rank: 4, name: '장삥' };
  if (m1 === 4 && m2 === 10) return { rank: 5, name: '장사' };
  if (m1 === 4 && m2 === 6) return { rank: 6, name: '세육' };

  const sum = (m1 + m2) % 10;
  if (sum === 9) return { rank: 7, name: '갑오', tiebreak: sum };
  if (sum === 0) return { rank: 9, name: '망통', tiebreak: sum };
  return { rank: 8, name: `${sum}끗`, tiebreak: sum };
}

function compareCombo(comboA, comboB) {
  if (comboA.rank !== comboB.rank) return comboA.rank < comboB.rank ? 1 : -1; // rank 작을수록 승
  const ta = comboA.tiebreak ?? 0;
  const tb = comboB.tiebreak ?? 0;
  return ta === tb ? 0 : (ta > tb ? 1 : -1);
}

// ----- 결투(1vs1 같은 숫자) 찾기 -----
// singlePlays 중 같은 숫자를 낸 두 명씩 묶어서 반환. UI에서 결투 연출에도 재사용
function findDuels(plays) {
  const singlePlays = plays.filter(p => p.played.length === 1);
  const numberGroups = {};
  singlePlays.forEach(p => {
    const n = p.played[0].number;
    (numberGroups[n] ??= []).push(p);
  });
  return Object.values(numberGroups)
    .filter(g => g.length === 2)
    .map(([p1, p2]) => {
      const remain1 = p1.hand.find(c => c !== p1.played[0]);
      const remain2 = p2.hand.find(c => c !== p2.played[0]);
      const combo1 = evaluateCombo(p1.played[0].number, remain1.number);
      const combo2 = evaluateCombo(p2.played[0].number, remain2.number);
      let cmp = compareCombo(combo1, combo2);
      let replay = false;

      if (cmp === 0) {
        // 끗수까지 같으면, 낸 카드+남은 카드를 합쳐 광이 몇 장인지로 재비교
        const gwangCount1 = (p1.played[0].isGwang ? 1 : 0) + (remain1.isGwang ? 1 : 0);
        const gwangCount2 = (p2.played[0].isGwang ? 1 : 0) + (remain2.isGwang ? 1 : 0);
        if (gwangCount1 !== gwangCount2) {
          cmp = gwangCount1 > gwangCount2 ? 1 : -1;
        } else {
          replay = true; // 완전 동률 - 이 둘만 재대결
        }
      }

      const winner = replay ? null : (cmp >= 0 ? p1 : p2);
      return { p1, p2, remain1, remain2, combo1, combo2, winner, replay };
    });
}

// ----- 최종 승자 판정 -----
// plays: [{ id, hand: [c1,c2], played: [card] 또는 [card,card] }]
// 우선순위: 1vs1 결투 > 광 카드 장수 > 값 비교 (개인 땡 포함)
// 반환값: { winners: Player[], replayDuel: {p1,p2} | null }
//   replayDuel이 있으면 그 두 명만 재대결해야 하므로 winners는 빈 배열
function getFinalWinner(plays) {
  const personalDdang = plays.filter(p => p.played.length === 2);
  const singlePlays = plays.filter(p => p.played.length === 1);

  // 모든 참가자를 { player, value, isGwang } 형태로 통일
  // 개인 땡 → 숫자 * 10 (1땡=10 ~ 10땡(장땡)=100), 일반 카드 → 그냥 숫자
  // isGwang은 낸 카드 중 하나라도 광이면 true (땡으로 강제로 낸 카드에 광이 섞인 경우 포함)
  const allEntries = [
    ...personalDdang.map(p => ({
      player: p,
      value: p.played[0].number * 10,
      isGwang: p.played.some(c => c.isGwang),
    })),
    ...singlePlays.map(p => ({ player: p, value: p.played[0].number, isGwang: p.played[0].isGwang })),
  ];

  // 1. 결투(같은 숫자 낸 두 명) 찾기 — 최우선
  //    개인 땡은 숫자당 2장뿐이라 다른 사람과 겹칠 수 없음 → 결투 대상 아님
  const duels = findDuels(plays);

  if (duels.length > 0) {
    const replayDuel = duels.find(d => d.replay);
    if (replayDuel) {
      // 완전 동률 - 이 결투는 재대결. 다른 결투가 있었다면 그쪽 승자는 그대로 인정
      return {
        winners: duels.filter(d => !d.replay).map(d => d.winner),
        replayDuel: { p1: replayDuel.p1, p2: replayDuel.p2 },
      };
    }
    return { winners: duels.map(d => d.winner), replayDuel: null };
  }

  // 2. 결투 없으면 "총 광 카드 장수" 기준으로 승부 방향 결정
  //    (광땡은 혼자 2장을 쓰므로 인원수가 아니라 카드 장수로 세야 함)
  const gwangUnits = plays
    .map(p => ({ player: p, gwangCards: p.played.filter(c => c.isGwang) }))
    .filter(u => u.gwangCards.length > 0);
  const totalGwangCards = gwangUnits.reduce((sum, u) => sum + u.gwangCards.length, 0);
  const nonGwangEntries = allEntries.filter(e => !gwangUnits.some(u => u.player === e.player));

  if (totalGwangCards === 1) {
    // 광 카드 1장 → 결과 뒤집힘: 광 낸 사람 포함 전체(개인 땡도 포함) 중 값이 가장 낮은 사람 승리
    // (광 낸 사람도 자기 카드 숫자값 그대로 비교에 참여함. 예: 1광=1이라 대부분 최저값으로 승리)
    return { winners: [allEntries.sort((a, b) => a.value - b.value)[0].player], replayDuel: null };
  }
  if (totalGwangCards === 2) {
    if (gwangUnits.length === 1) {
      // 진짜 광땡(한 사람이 광 2장 다 냄, 다른 사람은 광 없음) → 그 사람이 그냥 승리
      return { winners: [gwangUnits[0].player], replayDuel: null };
    }
    // 서로 다른 두 사람이 광을 1장씩 냄 → 1광 > 3광 > 8광 순으로 비교
    const order = { 1: 3, 3: 2, 8: 1 };
    return {
      winners: [gwangUnits.sort((a, b) => order[b.gwangCards[0].number] - order[a.gwangCards[0].number])[0].player],
      replayDuel: null,
    };
  }
  if (totalGwangCards === 3) {
    // 분포가 "광땡(2장) + 낱장 광(1장)"이면 예외: 낱장 광 낸 사람이 승리 (광땡은 패배)
    if (gwangUnits.length === 2) {
      const ddangGwangUnit = gwangUnits.find(u => u.gwangCards.length === 2);
      const loneGwangUnit = gwangUnits.find(u => u.gwangCards.length === 1);
      if (ddangGwangUnit && loneGwangUnit) {
        return { winners: [loneGwangUnit.player], replayDuel: null };
      }
    }
    // 그 외 분포(예: 3명이 각자 1장씩)는 광 안 낸 전원 공동 승리
    return { winners: nonGwangEntries.map(e => e.player), replayDuel: null };
  }

  // 3. 광도 없으면 값이 가장 높은 사람 승리 (개인 땡이면 값이 커서 자연스럽게 유리)
  return { winners: [allEntries.sort((a, b) => b.value - a.value)[0].player], replayDuel: null };
}