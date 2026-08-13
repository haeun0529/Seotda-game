// ===== 카드 & 덱 =====
// 카드 = { number: 1~10, isGwang: true/false }
// 1,3,8은 두 장 중 한 장이 광
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

// ===== 낼 카드 결정 =====
// 손패가 같은 숫자(개인 땡)면 무조건 2장 다 냄. 아니면 選択(외부에서 결정된 카드 하나)
function resolvePlayed(hand, chosenCard) {
  if (hand[0].number === hand[1].number) {
    return [hand[0], hand[1]]; // 개인 땡, 강제로 둘 다
  }
  return [chosenCard]; // 일반적으로는 1장 선택
}

// ===== 개인 땡 점수 =====
function personalDdangScore(number) {
  return number * 10; // 1땡=10, ..., 10땡(장땡)=100
}

// ===== 라운드 판정 =====
// plays: [{ id, hand: [c1,c2], played: [card] 또는 [card,card] }]
function judgeRound(plays) {
  // 1. 개인 땡 낸 사람 분리 (2장 낸 사람)
  const personalDdang = plays.filter(p => p.played.length === 2);
  const singlePlays = plays.filter(p => p.played.length === 1);

  // 2. 싱글 플레이어들 중 같은 숫자가 겹치는 사람들 찾기 (1vs1 땡, 광보다 우선)
  const numberGroups = {};
  singlePlays.forEach(p => {
    const n = p.played[0].number;
    if (!numberGroups[n]) numberGroups[n] = [];
    numberGroups[n].push(p);
  });

  const duels = Object.values(numberGroups).filter(g => g.length === 2);
  const duelPlayerIds = new Set(duels.flat().map(p => p.id));

  // 각 결투는 "남은 카드"(hand 중 안 낸 카드)의 끗수로 승부
  const duelResults = duels.map(([p1, p2]) => {
    const remain1 = p1.hand.find(c => c !== p1.played[0]);
    const remain2 = p2.hand.find(c => c !== p2.played[0]);
    const v1 = getKkeutValue(remain1, remain2);
    const v2 = getKkeutValue(remain2, remain1);
    return v1 >= v2 ? p1 : p2; // 동률 처리는 추후 보완 필요
  });

  // 3. 결투에 안 낀 나머지 싱글 플레이어들 (광 체크 대상)
  const rest = singlePlays.filter(p => !duelPlayerIds.has(p.id));
  const gwangPlayers = rest.filter(p => p.played[0].isGwang);
  const nonGwangPlayers = rest.filter(p => !p.played[0].isGwang);

  let restWinner = null;

  if (gwangPlayers.length === 1) {
    // 광 1명 → 결과 뒤집힘: 나머지 중 최저 숫자가 승리
    restWinner = [...nonGwangPlayers].sort((a, b) => a.played[0].number - b.played[0].number)[0];
  } else if (gwangPlayers.length === 2) {
    // 광 2명 → 1광>3광>8광 순으로 1vs1 (광땡 예외는 별도 체크 필요)
    const order = { 1: 3, 3: 2, 8: 1 };
    restWinner = gwangPlayers.sort((a, b) => order[b.played[0].number] - order[a.played[0].number])[0];
  } else if (gwangPlayers.length === 3) {
    // 광 3명 → 광 안 낸 나머지 2명이 승부 (일반 숫자 비교)
    restWinner = [...nonGwangPlayers].sort((a, b) => b.played[0].number - a.played[0].number)[0];
  } else {
    // 광 없음 → 그냥 숫자 제일 높은 사람
    restWinner = [...rest].sort((a, b) => b.played[0].number - a.played[0].number)[0];
  }

  // 4. 개인 땡 점수 반영 (다른 결과들과 어떻게 최종 비교되는지는 별도 규칙 필요)
  const ddangScores = personalDdang.map(p => ({
    player: p,
    score: personalDdangScore(p.played[0].number),
  }));

  return {
    duelResults,   // 1vs1 땡 승자들
    restWinner,    // 광/일반 로직 승자
    ddangScores,   // 개인 땡 점수들
  };
}

// 남은 카드의 끗수/특수조합(알리,독사 등) 계산 - 미완성, 별도 정의 필요
function getKkeutValue(myRemain, opponentRemain) {
  // TODO: 알리/독사/구삥/장삥/세육 판정 추가
  return myRemain.number;
}