import { beforeEach, describe, expect, it, vi } from "vitest";
import { MeService } from "../src/me/me.service";

const ownerId = "owner-1";

function query<T>(value: T) {
  return { exec: vi.fn().mockResolvedValue(value) };
}

describe("MeService", () => {
  const model = {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  };
  let service: MeService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MeService(model as never);
  });

  // Nobody has a preferences document until they change something, so the
  // common case is a miss — and a miss is an answer, not a 404.
  it("answers with the defaults for a person who has never changed anything", async () => {
    model.findOne.mockReturnValue(query(null));

    await expect(service.findPreferences(ownerId)).resolves.toEqual({
      layoutDirection: "down",
    });
    expect(model.findOne).toHaveBeenCalledWith({ ownerId });
  });

  it("reads the stored preference back", async () => {
    model.findOne.mockReturnValue(query({ ownerId, layoutDirection: "right" }));

    await expect(service.findPreferences(ownerId)).resolves.toEqual({
      layoutDirection: "right",
    });
  });

  it("creates the document on the first change and scopes it by owner", async () => {
    model.findOneAndUpdate.mockReturnValue(
      query({ ownerId, layoutDirection: "right" }),
    );

    await expect(
      service.updatePreferences(ownerId, { layoutDirection: "right" }),
    ).resolves.toEqual({ layoutDirection: "right" });
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { ownerId },
      { $set: { layoutDirection: "right" } },
      { new: true, upsert: true },
    );
  });

  // A document written before a preference existed has to answer for it too,
  // which is what lets a patch store only the field it was given.
  it("fills in a preference the stored document predates", async () => {
    model.findOneAndUpdate.mockReturnValue(query({ ownerId }));

    await expect(service.updatePreferences(ownerId, {})).resolves.toEqual({
      layoutDirection: "down",
    });
  });
});
