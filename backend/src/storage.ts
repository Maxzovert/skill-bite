import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";
import type { AppConfig } from "./config.js";

export const CLOUDINARY_REF_PREFIX = "cloudinary:";

export type SaveVideoOptions = {
  categorySlug?: string;
};

export interface MediaStorage {
  saveVideo(contentId: string, bytes: Buffer, options?: SaveVideoOptions): Promise<string>;
  read(reference: string): Promise<Buffer>;
  moveVideo(fromReference: string, contentId: string, categorySlug: string): Promise<string>;
  deleteVideo(reference: string): Promise<void>;
}

export type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder: string;
};

export function categoryFolderSlug(input?: string): string {
  const raw = (input ?? "uncategorized").trim().toLowerCase();
  const slug = raw.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "uncategorized";
}

function localVideoPath(categorySlug: string, contentId: string): string {
  return path.join(categoryFolderSlug(categorySlug), contentId, "video.bin").replaceAll("\\", "/");
}

function assertInsideRoot(root: string, reference: string): string {
  const rootPath = path.resolve(root);
  const target = path.resolve(rootPath, reference);
  const relative = path.relative(rootPath, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("invalid reference");
  }
  return target;
}

export function localMediaStorage(root: string): MediaStorage {
  return {
    async saveVideo(contentId: string, bytes: Buffer, options?: SaveVideoOptions): Promise<string> {
      const reference = localVideoPath(options?.categorySlug ?? "uncategorized", contentId);
      const target = path.join(root, reference);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, bytes);
      return reference;
    },
    async read(reference: string): Promise<Buffer> {
      return readFile(assertInsideRoot(root, reference));
    },
    async moveVideo(fromReference: string, contentId: string, categorySlug: string): Promise<string> {
      const next = localVideoPath(categorySlug, contentId);
      if (fromReference.replaceAll("\\", "/") === next) return next;
      const from = assertInsideRoot(root, fromReference);
      const to = path.join(root, next);
      await mkdir(path.dirname(to), { recursive: true });
      await rename(from, to);
      try {
        await rm(path.dirname(from), { recursive: true, force: true });
      } catch {
        /* best-effort cleanup of empty old folder */
      }
      return next;
    },
    async deleteVideo(reference: string): Promise<void> {
      const target = assertInsideRoot(root, reference);
      await rm(target, { force: true });
      try {
        await rm(path.dirname(target), { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    },
  };
}

export function cloudinaryMediaStorage(config: CloudinaryConfig): MediaStorage {
  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true,
  });

  function publicIdFor(contentId: string, categorySlug?: string): string {
    return `${config.folder}/${categoryFolderSlug(categorySlug)}/${contentId}`.replaceAll(/\/+/g, "/");
  }

  return {
    async saveVideo(contentId: string, bytes: Buffer, options?: SaveVideoOptions): Promise<string> {
      const publicId = publicIdFor(contentId, options?.categorySlug);
      await new Promise<void>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            resource_type: "video",
            public_id: publicId,
            overwrite: true,
            invalidate: true,
          },
          (error, result) => {
            if (error || !result?.public_id) {
              reject(error ?? new Error("Cloudinary upload failed"));
              return;
            }
            resolve();
          },
        );
        stream.end(bytes);
      });
      return `${CLOUDINARY_REF_PREFIX}${publicId}`;
    },
    async read(reference: string): Promise<Buffer> {
      if (!reference.startsWith(CLOUDINARY_REF_PREFIX)) {
        throw new Error("invalid cloudinary reference");
      }
      const publicId = reference.slice(CLOUDINARY_REF_PREFIX.length);
      const url = cloudinary.url(publicId, {
        resource_type: "video",
        secure: true,
        sign_url: true,
      });
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Cloudinary media missing");
      }
      return Buffer.from(await response.arrayBuffer());
    },
    async moveVideo(fromReference: string, contentId: string, categorySlug: string): Promise<string> {
      if (!fromReference.startsWith(CLOUDINARY_REF_PREFIX)) {
        throw new Error("invalid cloudinary reference");
      }
      const fromPublicId = fromReference.slice(CLOUDINARY_REF_PREFIX.length);
      const toPublicId = publicIdFor(contentId, categorySlug);
      if (fromPublicId === toPublicId) return fromReference;
      await cloudinary.uploader.rename(fromPublicId, toPublicId, {
        resource_type: "video",
        overwrite: true,
        invalidate: true,
      });
      return `${CLOUDINARY_REF_PREFIX}${toPublicId}`;
    },
    async deleteVideo(reference: string): Promise<void> {
      if (!reference.startsWith(CLOUDINARY_REF_PREFIX)) return;
      const publicId = reference.slice(CLOUDINARY_REF_PREFIX.length);
      await cloudinary.uploader.destroy(publicId, { resource_type: "video", invalidate: true });
    },
  };
}

export function cloudinaryConfigFromEnv(config: AppConfig): CloudinaryConfig | null {
  const cloudName = config.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = config.CLOUDINARY_API_KEY?.trim();
  const apiSecret = config.CLOUDINARY_API_SECRET?.trim();
  if (!cloudName || !apiKey || !apiSecret) return null;
  return {
    cloudName,
    apiKey,
    apiSecret,
    folder: (config.CLOUDINARY_FOLDER?.trim() || "skillbite").replace(/^\/+|\/+$/g, ""),
  };
}

/** Prefer Cloudinary when credentials are set; keep local reads for older references. */
export function createMediaStorage(config: AppConfig): MediaStorage {
  const local = localMediaStorage(config.MEDIA_ROOT);
  const cloudinaryCfg = cloudinaryConfigFromEnv(config);
  if (!cloudinaryCfg) return local;
  const remote = cloudinaryMediaStorage(cloudinaryCfg);
  return {
    async saveVideo(contentId: string, bytes: Buffer, options?: SaveVideoOptions): Promise<string> {
      return remote.saveVideo(contentId, bytes, options);
    },
    async read(reference: string): Promise<Buffer> {
      if (reference.startsWith(CLOUDINARY_REF_PREFIX)) {
        return remote.read(reference);
      }
      return local.read(reference);
    },
    async moveVideo(fromReference: string, contentId: string, categorySlug: string): Promise<string> {
      if (fromReference.startsWith(CLOUDINARY_REF_PREFIX)) {
        return remote.moveVideo(fromReference, contentId, categorySlug);
      }
      return local.moveVideo(fromReference, contentId, categorySlug);
    },
    async deleteVideo(reference: string): Promise<void> {
      if (reference.startsWith(CLOUDINARY_REF_PREFIX)) {
        await remote.deleteVideo(reference);
        return;
      }
      await local.deleteVideo(reference);
    },
  };
}
