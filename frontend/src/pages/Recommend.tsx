import { useState, useEffect, useRef, useCallback } from "react";
import client from "../api/client";
import { Icon } from "../components/days/Icon";
import { useMockDate } from "../hooks/useMockDate";

interface MusicItem {
  title: string;
  artist: string;
  reason: string;
  query: string;
  artworkUrl: string | null;
  previewUrl: string | null;
}

const LEVELS = [
  { level: 1, min: 1   },
  { level: 2, min: 5   },
  { level: 3, min: 15  },
  { level: 4, min: 30  },
  { level: 5, min: 50  },
  { level: 6, min: 100 },
];

const CATEGORIES = [
  { id: "music",  label: "음악", sublabel: "AI 플레이리스트",    img: "/recommend/음악.png",  unlockLevel: 1 },
  { id: "book",   label: "도서", sublabel: "AI 도서 추천",       img: "/recommend/도서.png",  unlockLevel: 2 },
  { id: "movie",  label: "영화", sublabel: "AI 영화 추천",       img: "/recommend/영화.png",  unlockLevel: 3 },
  { id: "travel", label: "여행", sublabel: "AI 여행지 추천",     img: "/recommend/여행.png",  unlockLevel: 4 },
  { id: "friend", label: "친구", sublabel: "취향 기반 친구 매칭", img: "/recommend/친구.png",  unlockLevel: 5 },
  { id: "lover",  label: "연인", sublabel: "AI 연인 매칭",       img: "/recommend/연인.png",  unlockLevel: 6 },
];

const MUSIC_LIST = [
  { id: 1, title: "Gravity",              artist: "John Mayer",        mood: "차분한",     color: "#E8D4B0" },
  { id: 2, title: "Skinny Love",          artist: "Bon Iver",          mood: "감성적인",   color: "#B0C8E8" },
  { id: 3, title: "Bloom",               artist: "The Paper Kites",   mood: "포근한",     color: "#C8E8B0" },
  { id: 4, title: "마음이 외로워지면",     artist: "아이유",             mood: "위로가 되는", color: "#E8C8B0" },
  { id: 5, title: "Holocene",            artist: "Bon Iver",          mood: "서정적인",   color: "#B0E8D4" },
  { id: 6, title: "Lua",                 artist: "Bright Eyes",       mood: "내면적인",   color: "#D0B0E8" },
  { id: 7, title: "한 페이지가 될 수 있게", artist: "DAY6",             mood: "설레는",     color: "#E8B0C8" },
];

const COMING_SOON: Record<string, { desc: string }> = {
  book:   { desc: "AI가 일기 속 감정과 관심사를 분석해\n딱 맞는 책을 골라드릴 거예요." },
  movie:  { desc: "오늘의 기분에 어울리는 영화를\nAI가 추천해드릴 예정이에요." },
  travel: { desc: "일기에서 발견한 나만의 취향으로\n여행지를 추천해드릴 거예요." },
  friend: { desc: "비슷한 감성의 Days 사용자와\n연결해드릴 준비를 하고 있어요." },
  lover:  { desc: "가장 잘 맞는 상대를 찾을 수 있도록\n신중하게 준비 중이에요." },
};

function computeLevel(count: number) {
  let current = { level: 0, min: 0 };
  for (const l of LEVELS) {
    if (count >= l.min) current = l;
  }
  return current;
}

function computeNext(count: number) {
  return LEVELS.find((l) => count < l.min) ?? null;
}

export function Recommend() {
  const today = useMockDate();
  const [count, setCount] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  // 음악 추천 캐시 & 상태
  const [musicCache, setMusicCache] = useState<MusicItem[] | null>(null);
  const [musicLoading, setMusicLoading] = useState(false);
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadMusic = useCallback(async () => {
    if (musicCache) return; // 캐시 있으면 재호출 안 함
    setMusicLoading(true);
    try {
      const recRes = await client.get("/recommend/songs?limit=7");
      const items: { title: string; artist: string; reason: string; query: string }[] =
        recRes.data.items ?? [];

      // iTunes 병렬 호출
      const itunesResults = await Promise.all(
        items.map((item) =>
          client
            .get(`/music/search?term=${encodeURIComponent(item.query)}&limit=1`)
            .then((r) => r.data.results?.[0] ?? null)
            .catch(() => null)
        )
      );

      const merged: MusicItem[] = items.map((item, i) => ({
        ...item,
        artworkUrl: itunesResults[i]?.artworkUrl100 ?? null,
        previewUrl: itunesResults[i]?.previewUrl ?? null,
      }));

      setMusicCache(merged);
    } catch {
      setMusicCache([]);
    } finally {
      setMusicLoading(false);
    }
  }, [musicCache]);

  const handlePlayToggle = (idx: number, previewUrl: string) => {
    if (playingIdx === idx) {
      audioRef.current?.pause();
      setPlayingIdx(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(previewUrl);
      audio.onended = () => setPlayingIdx(null);
      audio.play();
      audioRef.current = audio;
      setPlayingIdx(idx);
    }
  };

  const closeSheet = () => {
    audioRef.current?.pause();
    setPlayingIdx(null);
    setActiveId(null);
  };

  useEffect(() => {
    client
      .get(`/calendar?month=${today.slice(0, 7)}`)
      .then((res) => setCount((res.data.entries ?? []).length))
      .catch(() => setCount(0));
  }, [today]);

  const diaryCount = count ?? 0;
  const currentLevel = computeLevel(diaryCount);
  const nextLevel = computeNext(diaryCount);
  const nextUnlockCat = CATEGORIES.find((c) => c.unlockLevel === currentLevel.level + 1);
  const progressPercent = nextLevel
    ? Math.min(((diaryCount - currentLevel.min) / (nextLevel.min - currentLevel.min)) * 100, 100)
    : 100;

  const activeCat = CATEGORIES.find((c) => c.id === activeId);

  return (
    <>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "20px 16px 48px",
          gap: 20,
          animation: "days-fade-in 500ms var(--ease-out) both",
        }}
      >
        {/* 헤더 */}
        <div style={{ animation: "days-rise 360ms var(--ease-out) both" }}>
          <h1 style={{ font: "700 26px/1.25 var(--font-sans)", color: "var(--sage-ink)", letterSpacing: "-0.02em", margin: 0 }}>
            나를 위한 추천
          </h1>
          <p style={{ font: "400 14px/1.5 var(--font-sans)", color: "var(--ink-meta)", margin: "6px 0 0" }}>
            일기가 쌓일수록 AI가 나를 더 잘 알아가요
          </p>
        </div>

        {/* 레벨 카드 */}
        <div
          style={{
            background: "var(--paper-pure)",
            borderRadius: "var(--r-5)",
            border: "1px solid var(--line-faint)",
            padding: "20px",
            boxShadow: "var(--shadow-card)",
            animation: "days-rise 380ms var(--ease-out) 60ms both",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
            <div>
              <div style={{ font: "800 30px/1 var(--font-sans)", color: "var(--sage-ink)", letterSpacing: "-0.03em" }}>
                {currentLevel.level > 0 ? `Lv.${currentLevel.level}` : "Lv.0"}
              </div>
            </div>
            <div style={{ font: "500 12px/1 var(--font-sans)", color: "var(--ink-meta)", background: "var(--sage-wash)", borderRadius: "var(--r-pill)", padding: "6px 12px", marginTop: 2 }}>
              일기 {count === null ? "…" : diaryCount}개
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
            {LEVELS.map((l, i) => (
              <div key={l.level} style={{ display: "flex", alignItems: "center", flex: i < LEVELS.length - 1 ? 1 : 0 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0, background: currentLevel.level >= l.level ? "var(--sage-leaf)" : "var(--line)", transition: "background 400ms var(--ease-soft)" }} />
                {i < LEVELS.length - 1 && (
                  <div style={{ flex: 1, height: 2, borderRadius: 999, background: currentLevel.level > l.level ? "var(--sage-leaf)" : "var(--line-faint)", transition: "background 500ms" }} />
                )}
              </div>
            ))}
          </div>

          <div style={{ height: 6, background: "var(--line-faint)", borderRadius: 999, overflow: "hidden", marginBottom: 12 }}>
            <div style={{ height: "100%", width: `${progressPercent}%`, background: "var(--sage-leaf)", borderRadius: 999, transition: "width 800ms var(--ease-out)" }} />
          </div>

          {nextLevel && nextUnlockCat ? (
            <div style={{ font: "400 13px/1.4 var(--font-sans)", color: "var(--ink-meta)" }}>
              <strong style={{ color: "var(--sage-ink)", fontWeight: 600 }}>{nextLevel.min - diaryCount}개</strong>{" "}
              더 쓰면{" "}
              <strong style={{ color: "var(--sage-ink)", fontWeight: 600 }}>{nextUnlockCat.label} 추천</strong>이 열려요
            </div>
          ) : (
            <div style={{ font: "600 13px/1.4 var(--font-sans)", color: "var(--sage-leaf)" }}>모든 기능 해제 완료 🎉</div>
          )}
        </div>

        {/* 카테고리 그리드 */}
        <div style={{ animation: "days-rise 380ms var(--ease-out) 120ms both" }}>
          <div style={{ font: "600 12px/1 var(--font-sans)", color: "var(--ink-hint)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12, paddingLeft: 2 }}>
            탐색하기
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {CATEGORIES.map((cat, i) => {
              const isUnlocked = currentLevel.level >= cat.unlockLevel;
              const unlockThreshold = LEVELS.find((l) => l.level === cat.unlockLevel);
              return (
                <div
                  key={cat.id}
                  style={{
                    position: "relative",
                    borderRadius: 22,
                    aspectRatio: "1",
                    overflow: "hidden",
                    cursor: isUnlocked ? "pointer" : "default",
                    animation: `days-pop 400ms var(--ease-soft) ${140 + i * 60}ms both`,
                    background: "#BDD0E4",
                  }}
                  onClick={() => {
                    if (!isUnlocked) return;
                    setActiveId(cat.id);
                    if (cat.id === "music") loadMusic();
                  }}
                >
                  <img src={cat.img} alt={cat.label} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: isUnlocked ? "none" : "grayscale(0.7) brightness(0.55)", transition: "filter var(--dur-2) var(--ease-out)" }} />
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "32px 14px 14px", background: "linear-gradient(to bottom, transparent, rgba(10,20,40,0.55))" }}>
                    <div style={{ font: "700 15px/1.2 var(--font-sans)", color: "#fff", letterSpacing: "-0.01em" }}>{cat.label}</div>
                    <div style={{ font: "400 11px/1.3 var(--font-sans)", color: "rgba(255,255,255,0.68)", marginTop: 2 }}>{cat.sublabel}</div>
                  </div>
                  {!isUnlocked && (
                    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.28)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.16)", border: "1.5px solid rgba(255,255,255,0.38)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon name="lock" size={18} color="rgba(255,255,255,0.95)" />
                      </div>
                      <div style={{ font: "600 11px/1.5 var(--font-sans)", color: "rgba(255,255,255,0.82)", textAlign: "center" }}>
                        일기 {unlockThreshold?.min}개<br />달성 시 해제
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 바텀 시트 딤 */}
      {activeId && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, animation: "days-fade-in 200ms both" }}
          onClick={closeSheet}
        />
      )}

      {/* 바텀 시트 */}
      {activeId && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "100%",
            maxWidth: 480,
            background: "var(--paper-pure)",
            borderRadius: "24px 24px 0 0",
            zIndex: 201,
            maxHeight: "80dvh",
            overflowY: "auto",
            animation: "sheet-up 280ms var(--ease-out) both",
          }}
        >
          {/* 이미지 배너 */}
          <div style={{ position: "relative", height: 160, background: "#BDD0E4", overflow: "hidden", flexShrink: 0 }}>
            <img
              src={activeCat?.img}
              alt={activeCat?.label}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.05), rgba(0,0,0,0.5))" }} />
            <button
              onClick={closeSheet}
              style={{ position: "absolute", top: 14, right: 14, background: "rgba(255,255,255,0.22)", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", backdropFilter: "blur(4px)" }}
            >
              <Icon name="close" size={16} color="#fff" />
            </button>
            <div style={{ position: "absolute", bottom: 16, left: 20 }}>
              <div style={{ font: "700 22px/1.2 var(--font-sans)", color: "#fff", letterSpacing: "-0.02em" }}>
                {activeCat?.label} 추천
              </div>
              <div style={{ font: "400 12px/1.4 var(--font-sans)", color: "rgba(255,255,255,0.75)", marginTop: 3 }}>
                {activeCat?.sublabel}
              </div>
            </div>
          </div>

          {/* 본문 */}
          <div style={{ padding: "20px 16px 40px" }}>
            {activeId === "music" ? (
              <>
                <p style={{ font: "400 13px/1.5 var(--font-sans)", color: "var(--ink-meta)", margin: "0 0 14px" }}>
                  일기의 감정과 키워드를 바탕으로 선곡했어요
                </p>

                {musicLoading ? (
                  /* 로딩 스켈레톤 */
                  <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < 4 ? "1px solid var(--line-faint)" : "none" }}>
                        <div style={{ width: 44, height: 44, borderRadius: 10, background: "var(--line-faint)", flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ height: 14, borderRadius: 6, background: "var(--line-faint)", width: "60%" }} />
                          <div style={{ height: 12, borderRadius: 6, background: "var(--line-faint)", width: "40%", marginTop: 6 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (musicCache ?? []).length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "var(--ink-meta)", font: "400 14px/1.6 var(--font-sans)" }}>
                    취향 프로필을 먼저 작성해 주세요
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {(musicCache ?? []).map((song, i) => (
                      <div
                        key={i}
                        style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < (musicCache ?? []).length - 1 ? "1px solid var(--line-faint)" : "none" }}
                      >
                        {/* 앨범 아트 */}
                        <div style={{ width: 48, height: 48, borderRadius: 10, background: "var(--sage-wash)", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {song.artworkUrl
                            ? <img src={song.artworkUrl} alt={song.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <Icon name="music" size={20} color="var(--sage-leaf)" stroke={1.5} />
                          }
                        </div>

                        {/* 곡 정보 */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ font: "600 14px/1.2 var(--font-sans)", color: "var(--sage-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{song.title}</div>
                          <div style={{ font: "400 12px/1.3 var(--font-sans)", color: "var(--ink-meta)", marginTop: 2 }}>{song.artist}</div>
                          <div style={{ font: "400 11px/1.4 var(--font-sans)", color: "var(--ink-hint)", marginTop: 3 }}>{song.reason}</div>
                        </div>

                        {/* 재생 버튼 */}
                        {song.previewUrl && (
                          <button
                            onClick={() => handlePlayToggle(i, song.previewUrl!)}
                            style={{ flexShrink: 0, width: 34, height: 34, borderRadius: "50%", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: playingIdx === i ? "var(--sage-leaf)" : "var(--sage-wash)", transition: "background 200ms" }}
                          >
                            <Icon name={playingIdx === i ? "close" : "arrow-right"} size={15} color={playingIdx === i ? "#fff" : "var(--sage-forest)"} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <p style={{ font: "400 12px/1.5 var(--font-sans)", color: "var(--ink-hint)", textAlign: "center", marginTop: 16, marginBottom: 0 }}>
                  일기를 더 쓸수록 추천이 정교해져요
                </p>
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, paddingTop: 8, paddingBottom: 8, textAlign: "center" }}>
                <div style={{ font: "700 18px/1.3 var(--font-sans)", color: "var(--sage-ink)", letterSpacing: "-0.02em" }}>곧 만나요!</div>
                <p style={{ font: "400 14px/1.7 var(--font-sans)", color: "var(--ink-meta)", margin: 0, whiteSpace: "pre-line" }}>
                  {COMING_SOON[activeId]?.desc}
                </p>
                <div style={{ font: "500 12px/1 var(--font-sans)", color: "var(--ink-hint)", background: "var(--sage-wash)", borderRadius: "var(--r-pill)", padding: "8px 18px" }}>
                  업데이트 예정
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
