import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import type { AppConfig } from "../src/config.js";
import {
  CLOUDINARY_REF_PREFIX,
  categoryFolderSlug,
  createMediaStorage,
  localMediaStorage,
} from "../src/storage.js";

function baseConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    NODE_ENV: "test",
    PORT: 3000,
    LOG_LEVEL: "error",
    MEDIA_ROOT: "./var/media",
    ACCESS_TOKEN_TTL_SECONDS: 900,
    REFRESH_TOKEN_TTL_SECONDS: 1_209_600,
    SESSION_TTL_SECONDS: 1_209_600,
    AUTH_TOKEN_TTL_SECONDS: 3600,
    ARGON2_MEMORY_COST: 19456,
    ARGON2_TIME_COST: 2,
    ARGON2_PARALLELISM: 1,
    CORS_ORIGINS: "",
    ...overrides,
  };
}

test("categoryFolderSlug normalizes and defaults", () => {
  assert.equal(categoryFolderSlug("Fitness"), "fitness");
  assert.equal(categoryFolderSlug("Soft Skills"), "soft-skills");
  assert.equal(categoryFolderSlug(""), "uncategorized");
  assert.equal(categoryFolderSlug(undefined), "uncategorized");
});

test("createMediaStorage falls back to local when Cloudinary is unset", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "skillbite-storage-"));
  try {
    const storage = createMediaStorage(baseConfig({ MEDIA_ROOT: root }));
    const reference = await storage.saveVideo("content-1", Buffer.from("short-clip"), { categorySlug: "fitness" });
    assert.equal(reference.startsWith(CLOUDINARY_REF_PREFIX), false);
    assert.match(reference, /^fitness\/content-1\/video\.bin$/);
    assert.equal((await storage.read(reference)).toString(), "short-clip");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("localMediaStorage saves under category folder and moves on category change", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "skillbite-storage-"));
  try {
    const storage = localMediaStorage(root);
    const first = await storage.saveVideo("vid-1", Buffer.from("clip"), { categorySlug: "fitness" });
    assert.equal(first, "fitness/vid-1/video.bin");
    const moved = await storage.moveVideo(first, "vid-1", "coding");
    assert.equal(moved, "coding/vid-1/video.bin");
    assert.equal((await storage.read(moved)).toString(), "clip");
    await assert.rejects(() => storage.read(first));
    await storage.deleteVideo(moved);
    await assert.rejects(() => storage.read(moved));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("localMediaStorage rejects path escape on read", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "skillbite-storage-"));
  try {
    const storage = localMediaStorage(root);
    await assert.rejects(() => storage.read("../outside.bin"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
