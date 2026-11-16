import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { upsertStudioDraft, updateStudioDraftStatus } from "../../creator/drafts";
import { pickShortVideo } from "../../creator/media";
import { Icon } from "../../icons";
import { contentApi, type Tag } from "../../services/content";
import { useSession } from "../../session";
import { colors, font, radii, space } from "../../theme";
import type { Category } from "../../types";
import { Banner, Button, Field, LoadingState, Screen, Title } from "../../ui";
import type { RootStackParamList } from "../../navigation";

type Props = NativeStackScreenProps<RootStackParamList, "ShortEditor">;

export function ShortEditorScreen({ navigation, route }: Props) {
  const { session, ensurePublisher } = useSession();
  const existingId = route.params.contentId;
  const [contentId, setContentId] = useState(existingId ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sources, setSources] = useState("Original creator material");
  const [keywords, setKeywords] = useState("tutorial, short-form");
  const [tags, setTags] = useState<Tag[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tagId, setTagId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [mediaLabel, setMediaLabel] = useState("");
  const [hasMedia, setHasMedia] = useState(false);
  const [duration, setDuration] = useState(60);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!!existingId);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void ensurePublisher().catch((caught) => {
      setError(caught instanceof Error ? caught.message : "Could not open editor");
      setLoading(false);
    });
  }, [ensurePublisher]);

  useEffect(() => {
    if (!session?.token) return;
    Promise.all([contentApi.tags(session.token), contentApi.categories()])
      .then(([tagResult, categoryResult]) => {
        setTags(tagResult.items);
        setCategories(categoryResult.items);
        if (!tagId && tagResult.items[0]) setTagId(tagResult.items[0].tagId);
        const firstCategory = categoryResult.items.find((item) => item.categoryId && item.slug !== "trending");
        if (!categoryId && !existingId && firstCategory?.categoryId) setCategoryId(firstCategory.categoryId);
      })
      .catch(() => undefined);
  }, [session?.token]);

  useEffect(() => {
    if (!session?.token || !existingId) return;
    contentApi.detail(existingId, session.token)
      .then(async (detail) => {
        setTitle(String(detail.title ?? ""));
        setDescription(String(detail.description ?? ""));
        if (typeof detail.keywords === "string" && detail.keywords) setKeywords(detail.keywords);
        if (typeof detail.sources === "string" && detail.sources) setSources(detail.sources);
        setStatus(String(detail.status ?? "DRAFT"));
        setContentId(existingId);
        setHasMedia(detail.hasMedia === true);
        if (detail.hasMedia === true) setMediaLabel("Uploaded video on file");
        const detailCategories = Array.isArray(detail.categories) ? detail.categories as Array<{ categoryId?: string }> : [];
        const firstCat = detailCategories.find((item) => typeof item.categoryId === "string");
        if (firstCat?.categoryId) setCategoryId(firstCat.categoryId);
        const detailTags = Array.isArray(detail.tags) ? detail.tags as Array<{ tagId?: string }> : [];
        const firstTag = detailTags.find((item) => typeof item.tagId === "string");
        if (firstTag?.tagId) setTagId(firstTag.tagId);
        await upsertStudioDraft(session.userId, {
          contentId: existingId,
          title: String(detail.title ?? existingId),
          status: String(detail.status ?? "DRAFT"),
          kind: "VIDEO",
          updatedAt: new Date().toISOString(),
        });
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load draft"))
      .finally(() => setLoading(false));
  }, [existingId, session?.token, session?.userId]);

  useEffect(() => {
    if (!existingId) setLoading(false);
  }, [existingId]);

  async function run(work: () => Promise<void>) {
    if (!session?.token || !session.userId) return;
    setBusy(true);
    setError("");
    try {
      await ensurePublisher();
      await work();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <Screen>
        <Banner>Sign in to upload shorts.</Banner>
        <Button onPress={() => navigation.goBack()}>Back</Button>
      </Screen>
    );
  }

  if (loading) return <Screen><LoadingState /></Screen>;

  const canEdit = status !== "PUBLISHED";
  const uploadDisabled = busy || !categoryId || !canEdit;

  return (
    <Screen>
      <View style={styles.headerBar}>
        <Title>{contentId ? "Edit short" : "New short"}</Title>
        <Pressable style={styles.back} onPress={() => navigation.goBack()}>
          <Icon name="back" size={20} color={colors.ink} />
          <Text style={styles.backText}>Create</Text>
        </Pressable>
      </View>
      <Text style={styles.sub}>
        Status: {status}. Published shorts are not edited in place — archive, revise, then publish again.
      </Text>
      <Text style={styles.hint}>Video files are stored under the category folder in Cloudinary.</Text>

      <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 40 }}>
        <Field label="Title" value={title} onChangeText={setTitle} />
        <Field label="Description" value={description} onChangeText={setDescription} hint="What the learner will practice in this bite." />
        <Field label="Sources" value={sources} onChangeText={setSources} />
        <Field label="Keywords" value={keywords} onChangeText={setKeywords} hint="Comma-separated topics for search." />

        <Text style={styles.label}>Category (required)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {categories.map((category) => {
            const selected = category.categoryId === categoryId;
            return (
              <Pressable
                key={category.slug}
                style={[styles.chip, selected ? styles.chipOn : null, !canEdit ? styles.chipDisabled : null]}
                disabled={!canEdit}
                onPress={() => {
                  if (category.categoryId) setCategoryId(category.categoryId);
                }}
              >
                <Text style={[styles.chipText, selected ? styles.chipTextOn : null]}>{category.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.label}>Engagement label</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {tags.map((tag) => {
            const selected = tag.tagId === tagId;
            return (
              <Pressable
                key={tag.tagId}
                style={[styles.chip, selected ? styles.chipOn : null, !canEdit ? styles.chipDisabled : null]}
                disabled={!canEdit}
                onPress={() => setTagId(tag.tagId)}
              >
                <Text style={[styles.chipText, selected ? styles.chipTextOn : null]}>{tag.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable
          style={[styles.upload, uploadDisabled ? styles.uploadDisabled : null]}
          disabled={uploadDisabled}
          onPress={() => void run(async () => {
            if (!categoryId) {
              setError("Pick a category before uploading.");
              return;
            }
            const picked = await pickShortVideo();
            if (!picked) return;
            let id = contentId;
            if (!id) {
              const created = await contentApi.createVideo(session.token, {
                title: title || "Untitled short",
                description,
                sources,
                keywords,
                durationSeconds: picked.durationSeconds,
                tagIds: tagId ? [tagId] : [],
                categoryIds: [categoryId],
              });
              id = created.contentId;
              setContentId(id);
              setStatus(created.status);
            } else {
              await contentApi.updateVideo(session.token, id, {
                title: title || "Untitled short",
                description,
                sources,
                keywords,
                categoryIds: [categoryId],
              });
            }
            await contentApi.saveMedia(session.token, id, {
              mimeType: picked.mimeType,
              dataBase64: picked.dataBase64,
              durationSeconds: picked.durationSeconds,
            });
            setDuration(picked.durationSeconds);
            setMediaLabel(picked.fileName);
            setHasMedia(true);
            await upsertStudioDraft(session.userId, {
              contentId: id,
              title: title || "Untitled short",
              status: "DRAFT",
              kind: "VIDEO",
              updatedAt: new Date().toISOString(),
            });
            setMessage("Short video uploaded to the draft.");
          })}
        >
          <Icon name="video" size={22} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.uploadTitle}>{hasMedia || mediaLabel ? "Replace short video" : "Upload short video"}</Text>
            <Text style={styles.uploadMeta}>
              {!categoryId
                ? "Select a category first — files are stored under that folder."
                : mediaLabel || "Pick a short clip from your library (keep it brief)."}
            </Text>
          </View>
        </Pressable>

        <View style={styles.row}>
          <Button
            primary
            disabled={busy || !title.trim() || !canEdit}
            onPress={() => void run(async () => {
              if (!categoryId) {
                setError("Pick a category before saving.");
                return;
              }
              if (contentId) {
                await contentApi.updateVideo(session.token, contentId, {
                  title,
                  description,
                  sources,
                  keywords,
                  categoryIds: [categoryId],
                });
                await upsertStudioDraft(session.userId, {
                  contentId,
                  title,
                  status,
                  kind: "VIDEO",
                  updatedAt: new Date().toISOString(),
                });
                setMessage(hasMedia ? "Draft saved. Category folder updated if you changed it." : "Draft saved.");
                return;
              }
              const created = await contentApi.createVideo(session.token, {
                title,
                description,
                sources,
                keywords,
                durationSeconds: duration,
                tagIds: tagId ? [tagId] : [],
                categoryIds: [categoryId],
              });
              setContentId(created.contentId);
              setStatus(created.status);
              await upsertStudioDraft(session.userId, {
                contentId: created.contentId,
                title,
                status: created.status,
                kind: "VIDEO",
                updatedAt: new Date().toISOString(),
              });
              setMessage("Draft created. Upload the short video next.");
            })}
          >
            Save draft
          </Button>
        </View>

        <Button
          primary
          disabled={busy || !contentId}
          onPress={() => void run(async () => {
            const result = await contentApi.publishVideo(session.token, contentId);
            setStatus(result.status);
            await updateStudioDraftStatus(session.userId, contentId, result.status);
            setMessage("Published. Learners can find this short in Explore.");
          })}
        >
          Publish short
        </Button>

        <Button
          disabled={busy || !contentId || status !== "PUBLISHED"}
          onPress={() => void run(async () => {
            const result = await contentApi.takedown(session.token, contentId);
            setStatus(result.status);
            await updateStudioDraftStatus(session.userId, contentId, result.status);
            setMessage("Archived. Edit the draft, then publish again.");
          })}
        >
          Archive
        </Button>

        {message ? <Banner tone="info">{message}</Banner> : null}
        {error ? <Banner>{error}</Banner> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerBar: { minHeight: 44, justifyContent: "center" },
  back: { position: "absolute", left: 0, top: 0, bottom: 0, flexDirection: "row", alignItems: "center", gap: 6 },
  backText: { color: colors.ink, fontFamily: font.bold, fontWeight: "700" },
  sub: { color: colors.inkMuted, fontSize: 13, fontFamily: font.body, marginTop: -8 },
  hint: { color: colors.inkMuted, fontSize: 12, fontFamily: font.body, marginTop: -8 },
  label: { fontSize: 14, fontFamily: font.medium, fontWeight: "600", color: colors.ink },
  chip: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    justifyContent: "center",
  },
  chipOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  chipDisabled: { opacity: 0.5 },
  chipText: { color: colors.inkMuted, fontFamily: font.bold, fontWeight: "700", fontSize: 13 },
  chipTextOn: { color: colors.accent },
  upload: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    padding: space.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  uploadDisabled: { opacity: 0.55 },
  uploadTitle: { color: colors.ink, fontFamily: font.bold, fontWeight: "700" },
  uploadMeta: { color: colors.inkMuted, fontSize: 12, marginTop: 2 },
  row: { gap: 8 },
});
