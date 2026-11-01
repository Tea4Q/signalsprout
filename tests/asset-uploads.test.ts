import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadExternalImage, uploadVideo } from "@/services/content/assetService";

const uploadMocks = vi.hoisted(() => ({
  requestPermissions: vi.fn(),
  launchImageLibrary: vi.fn(),
  manipulate: vi.fn(),
  storageUpload: vi.fn(),
  insertSingle: vi.fn(),
  publicUrl: vi.fn(),
}));

vi.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: uploadMocks.requestPermissions,
  launchImageLibraryAsync: uploadMocks.launchImageLibrary,
}));

vi.mock("expo-image-manipulator", () => ({
  Action: {},
  SaveFormat: { JPEG: "jpeg" },
  manipulateAsync: uploadMocks.manipulate,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: uploadMocks.storageUpload,
        getPublicUrl: uploadMocks.publicUrl,
      }),
    },
    from: () => ({
      insert: () => ({
        select: () => ({
          single: uploadMocks.insertSingle,
        }),
      }),
    }),
  },
}));

function mockImagePicker(asset: Record<string, unknown>) {
  uploadMocks.requestPermissions.mockResolvedValue({ status: "granted" });
  uploadMocks.launchImageLibrary.mockResolvedValue({
    canceled: false,
    assets: [asset],
  });
}

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("asset uploads", () => {
  it("resizes, uploads, and records an external image", async () => {
    mockImagePicker({ uri: "file:///photo.png", width: 4000, height: 2000 });
    uploadMocks.manipulate.mockResolvedValue({
      uri: "file:///photo-resized.jpg",
      width: 1920,
      height: 960,
    });
    uploadMocks.storageUpload.mockResolvedValue({ error: null });
    uploadMocks.insertSingle.mockResolvedValue({
      data: { id: "asset-1" },
      error: null,
    });
    uploadMocks.publicUrl.mockReturnValue({ data: { publicUrl: "https://assets.test/photo.jpg" } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      blob: async () => new Blob(["image"]),
    }));
    vi.spyOn(Date, "now").mockReturnValue(123);

    const result = await uploadExternalImage("workspace-1", "brand-1");

    expect(uploadMocks.manipulate).toHaveBeenCalledWith(
      "file:///photo.png",
      [{ resize: { width: 1920 } }],
      { compress: 0.82, format: "jpeg" },
    );
    expect(uploadMocks.storageUpload).toHaveBeenCalledWith(
      "workspace-1/brand-1/123_upload.jpg",
      expect.any(Blob),
      { contentType: "image/jpeg", upsert: false },
    );
    expect(uploadMocks.insertSingle).toHaveBeenCalled();
    expect(result).toMatchObject({
      asset_id: "asset-1",
      width: 1920,
      height: 960,
      public_url: "https://assets.test/photo.jpg",
    });
  });

  it("does not launch the picker without library permission or after cancellation", async () => {
    uploadMocks.requestPermissions.mockResolvedValue({ status: "denied" });
    await expect(uploadExternalImage("workspace-1", "brand-1"))
      .rejects.toThrow("Permission to access photo library was denied.");
    expect(uploadMocks.launchImageLibrary).not.toHaveBeenCalled();

    uploadMocks.requestPermissions.mockResolvedValue({ status: "granted" });
    uploadMocks.launchImageLibrary.mockResolvedValue({ canceled: true, assets: [] });
    await expect(uploadExternalImage("workspace-1", "brand-1"))
      .rejects.toThrow("No image selected.");
    expect(uploadMocks.storageUpload).not.toHaveBeenCalled();
  });

  it("stops an image upload when storage rejects it", async () => {
    mockImagePicker({ uri: "file:///photo.jpg", width: 800, height: 600 });
    uploadMocks.manipulate.mockResolvedValue({
      uri: "file:///photo-resized.jpg",
      width: 800,
      height: 600,
    });
    const error = new Error("storage unavailable");
    uploadMocks.storageUpload.mockResolvedValue({ error });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      blob: async () => new Blob(["image"]),
    }));

    await expect(uploadExternalImage("workspace-1", "brand-1")).rejects.toBe(error);
    expect(uploadMocks.insertSingle).not.toHaveBeenCalled();
  });

  it("rejects oversized Instagram videos before uploading", async () => {
    mockImagePicker({
      uri: "file:///long-video.mp4",
      duration: 91_000,
      width: 1920,
      height: 1080,
    });
    await expect(uploadVideo("workspace-1", "brand-1"))
      .rejects.toThrow("Instagram Reels requires 90 seconds or less");
    expect(uploadMocks.storageUpload).not.toHaveBeenCalled();
  });

  it("uploads supported video and rejects files above the 500 MB limit", async () => {
    mockImagePicker({
      uri: "file:///clip.mp4",
      duration: 30_000,
      width: 1280,
      height: 720,
      mimeType: "video/mp4",
    });
    uploadMocks.storageUpload.mockResolvedValue({ error: null });
    uploadMocks.insertSingle.mockResolvedValue({
      data: { id: "video-1" },
      error: null,
    });
    uploadMocks.publicUrl.mockReturnValue({ data: { publicUrl: "https://assets.test/clip.mp4" } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      blob: async () => new Blob(["video"]),
    }));

    await expect(uploadVideo("workspace-1", "brand-1")).resolves.toMatchObject({
      asset_id: "video-1",
      fileName: "clip.mp4",
      durationMs: 30_000,
    });
    expect(uploadMocks.storageUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^workspace-1\/brand-1\/\d+_video\.mp4$/),
      expect.any(Blob),
      { contentType: "video/mp4", upsert: false },
    );

    vi.resetAllMocks();
    mockImagePicker({
      uri: "file:///huge.mp4",
      duration: 10_000,
      width: 1280,
      height: 720,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      blob: async () => ({ size: 500 * 1024 * 1024 + 1 } as Blob),
    }));

    await expect(uploadVideo("workspace-1", "brand-1"))
      .rejects.toThrow("exceeds the 500 MB upload limit");
    expect(uploadMocks.storageUpload).not.toHaveBeenCalled();
  });
});
