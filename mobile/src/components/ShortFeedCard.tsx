import { useEffect, useRef, useState } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { Video, ResizeMode, type AVPlaybackStatus } from "expo-av";
import { LinearishScrim } from "./Scrim";
import { IconButton } from "./IconButton";
import { Icon } from "../icons";
import { mediaUrl } from "../api";
import { colors, font, radii, space } from "../theme";
import type { ContentItem } from "../types";

type Props = {
  item: ContentItem;
  height: number;
  active: boolean;
  bookmarked: boolean;
  onOpen: () => void;
  onToggleBookmark: () => void;
  onShare: () => void;
  onProgress?: (seconds: number) => void;
};

export function ShortFeedCard({
  item,
  height,
  active,
  bookmarked,
  onOpen,
  onToggleBookmark,
  onShare,
  onProgress,
}: Props) {
  const videoRef = useRef<Video | null>(null);
  const [paused, setPaused] = useState(false);
  const isVideo = item.contentType === "VIDEO";
  const labels = [...(item.categories ?? []), ...(item.tags ?? [])].slice(0, 3);

  useEffect(() => {
    let cancelled = false;
    async function sync() {
      if (!videoRef.current) return;
      if (active && !paused && isVideo) await videoRef.current.playAsync();
      else await videoRef.current.pauseAsync();
      if (cancelled) return;
    }
    void sync();
    return () => {
      cancelled = true;
    };
  }, [active, paused, isVideo]);

  return (
    <View style={[styles.card, { height }]}>
      {isVideo ? (
        <Video
          ref={videoRef}
          style={StyleSheet.absoluteFill}
          source={{ uri: mediaUrl(item.contentId) }}
          resizeMode={ResizeMode.COVER}
          isLooping
          shouldPlay={active && !paused}
          isMuted={false}
          onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
            if (!status.isLoaded || status.positionMillis == null) return;
            onProgress?.(status.positionMillis / 1000);
          }}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.courseSurface]}>
          <Icon name="course" size={64} color={colors.feedMuted} />
          <Text style={styles.courseHint}>Playlist · tap to open</Text>
        </View>
      )}

      <LinearishScrim />

      <Pressable
        style={styles.tapZone}
        onPress={() => {
          if (isVideo) setPaused((value) => !value);
          else onOpen();
        }}
      />

      {paused && isVideo ? (
        <View style={styles.pauseBadge} pointerEvents="none">
          <Icon name="play" size={40} color={colors.feedText} />
        </View>
      ) : null}

      <View style={styles.bottom}>
        <View style={styles.copy}>
          <View style={styles.badgeRow}>
            {labels.map((label) => (
              <View key={`${label.slug}-${label.name}`} style={styles.labelChip}>
                <Text style={styles.labelChipText}>{label.name}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.meta} numberOfLines={2}>
            Save, share, or keep watching. Progress saves quietly while you scroll.
          </Text>
          <Pressable style={styles.openBtn} onPress={onOpen}>
            <Text style={styles.openBtnText}>{isVideo ? "Watch now" : "Open playlist"}</Text>
            <Icon name="continue" size={16} color={colors.accentInk} />
          </Pressable>
        </View>

        <View style={styles.rail}>
          <IconButton
            icon={bookmarked ? "bookmarkActive" : "bookmark"}
            label={bookmarked ? "Saved" : "Save"}
            tone="light"
            active={bookmarked}
            onPress={onToggleBookmark}
          />
          <IconButton icon="share" label="Share" tone="light" onPress={onShare} />
          <IconButton icon="play" label="Watch" tone="light" onPress={onOpen} />
        </View>
      </View>
    </View>
  );
}

export function feedPageHeight(tabBarHeight = 64): number {
  return Dimensions.get("window").height - tabBarHeight;
}

const styles = StyleSheet.create({
  card: {
    width: Dimensions.get("window").width,
    backgroundColor: colors.videoBg,
    overflow: "hidden",
  },
  courseSurface: {
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
    backgroundColor: colors.videoBg,
  },
  courseHint: { color: colors.feedMuted, fontSize: 14, fontFamily: font.medium, fontWeight: "600" },
  tapZone: { ...StyleSheet.absoluteFillObject },
  pauseBadge: {
    position: "absolute",
    alignSelf: "center",
    top: "42%",
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: space.lg,
    paddingBottom: space.xl,
    gap: space.md,
  },
  copy: { flex: 1, gap: space.sm, paddingRight: space.sm },
  badgeRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space.sm },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  badgeText: { color: colors.accentInk, fontSize: 12, fontFamily: font.bold, fontWeight: "700" },
  labelChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  labelChipText: { color: colors.feedText, fontSize: 11, fontFamily: font.bold, fontWeight: "700" },
  title: { color: colors.feedText, fontSize: 22, lineHeight: 30, fontFamily: font.display },
  meta: { color: colors.feedMuted, fontSize: 13, lineHeight: 18, fontFamily: font.body },
  openBtn: {
    marginTop: space.sm,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.pill,
  },
  openBtnText: { color: colors.accentInk, fontSize: 13, fontFamily: font.bold, fontWeight: "700" },
  rail: { gap: space.lg, paddingBottom: space.sm },
});
