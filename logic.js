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
function evaluateCombo(numA, numB) {
  const [m1, m2] = [numA, numB].sort((a, b) => a - b);

  if (m1 === 1 && m2 === 2) return { rank: 1, name: '알리' };
  if (m1 === 1 && m2 === 4) return { rank: 2, name: '독사' };
  if (m1 === 1 && m2 === 9) return { rank: 3, name: '구삥' };
  if (m1 === 1 && m2 === 10) return { rank: 4, name: '장삥' };
  if (m1 === 4 && m2 === 6) return { rank: 5, name: '세육' };

  const sum = (m1 + m2) % 10;
  if (sum === 9) return { rank: 6, name: '갑오', tiebreak: sum };
  if (sum === 0) return { rank: 8, name: '망통', tiebreak: sum };
  return { rank: 7, name: `${sum}끗`, tiebreak: sum };
}

function compareCombo(comboA, comboB) {
  if (comboA.rank !== comboB.rank) return comboA.rank < comboB.rank ? 1 : -1; // rank 작을수록 승
  const ta = comboA.tiebreak ?? 0;
  const tb = comboB.tiebreak ?? 0;
  return ta === tb ? 0 : (ta > tb ? 1 : -1);
}

// ----- 최종 승자 판정 -----
// plays: [{ id, hand: [c1,c2], played: [card] 또는 [card,card] }]
// 우선순위: 1vs1 결투 > 광 (인원수별) > 값 비교 (개인 땡 포함)
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
  const numberGroups = {};
  singlePlays.forEach(p => {
    const n = p.played[0].number;
    (numberGroups[n] ??= []).push(p);
  });
  const duels = Object.values(numberGroups).filter(g => g.length === 2);

  if (duels.length > 0) {
    // 결투 승자(들)만 라운드 승자. 나머지(개인 땡 포함) 전부 자동 아웃
    return duels.map(([p1, p2]) => {
      const remain1 = p1.hand.find(c => c !== p1.played[0]);
      const remain2 = p2.hand.find(c => c !== p2.played[0]);
      const combo1 = evaluateCombo(p1.played[0].number, remain1.number);
      const combo2 = evaluateCombo(p2.played[0].number, remain2.number);
      return compareCombo(combo1, combo2) >= 0 ? p1 : p2;
    });
  }

  // 2. 결투 없으면 광 개수로 승부 방향 결정 (개인 땡에 섞인 광 카드도 카운트에 포함됨)
  const gwangEntries = allEntries.filter(e => e.isGwang);
  const nonGwangEntries = allEntries.filter(e => !e.isGwang);

  if (gwangEntries.length === 1) {
    // 광 1명 → 결과 뒤집힘: 나머지 전체(개인 땡 포함) 중 값이 가장 낮은 사람 승리
    return [nonGwangEntries.sort((a, b) => a.value - b.value)[0].player];
  }
  if (gwangEntries.length === 2) {
    // 둘 중 하나가 "땡에 섞인 광"(광땡)이면, 땡 쪽은 자동 패배 → 나머지 lone 광이 승리
    const ddangGwang = gwangEntries.find(e => e.player.played.length === 2);
    const loneGwang = gwangEntries.find(e => e.player.played.length === 1);
    if (ddangGwang && loneGwang) {
      return [loneGwang.player];
    }
    // 둘 다 낱장 광이면 1광 > 3광 > 8광 순으로 1vs1
    const order = { 1: 3, 3: 2, 8: 1 };
    return [gwangEntries.sort((a, b) => order[b.value] - order[a.value])[0].player];
  }
  if (gwangEntries.length === 3) {
    // 광 3명 → 값 비교 없이 광 안 낸 나머지 전원이 공동 승리
    return nonGwangEntries.map(e => e.player);
  }

  // 3. 광도 없으면 값이 가장 높은 사람 승리 (개인 땡이면 값이 커서 자연스럽게 유리)
  return [allEntries.sort((a, b) => b.value - a.value)[0].player];
}

// ----- 테스트 -----
const deck = createDeck();
console.log('총 카드 수:', deck.length);

const hands = dealHands(deck, 5);
console.log('플레이어별 손패:', hands);