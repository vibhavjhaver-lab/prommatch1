import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { ProfileInputSchema, moderateText, isAllowed } from "@prommatch/core";
import { getUploadUrl, confirmUpload } from "../../lib/storage.js";
import { protectedProcedure, router } from "../trpc.js";

export const profileRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.profile.findUnique({
      where: { userId: ctx.session.user.id },
      include: { user: { select: { photos: { orderBy: { order: "asc" } } } } },
    });
  }),

  update: protectedProcedure.input(ProfileInputSchema).mutation(async ({ ctx, input }) => {
    const bioCheck = moderateText(input.bio ?? "");
    if (!isAllowed(bioCheck)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "bio_moderation_blocked" });
    }
    for (const p of input.prompts) {
      const check = moderateText(p);
      if (!isAllowed(check)) throw new TRPCError({ code: "BAD_REQUEST", message: "prompt_moderation_blocked" });
    }

    return ctx.db.profile.upsert({
      where: { userId: ctx.session.user.id },
      create: { userId: ctx.session.user.id, ...input, prompts: input.prompts },
      update: { ...input, prompts: input.prompts },
    });
  }),

  /** Returns a presigned PUT URL; the client uploads directly to S3/MinIO. */
  uploadPhotoUrl: protectedProcedure
    .input(z.object({ contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic"]) }))
    .mutation(async ({ ctx, input }) => {
      return getUploadUrl(ctx.session.user.id, input.contentType);
    }),

  /** Called after the client's PUT succeeds: strips EXIF, re-encodes, creates the pending Photo row. */
  confirmPhoto: protectedProcedure
    .input(z.object({ key: z.string(), order: z.number().int().min(0).max(3) }))
    .mutation(async ({ ctx, input }) => {
      const { finalKey, thumbKey } = await confirmUpload(input.key);
      return ctx.db.photo.create({
        data: { userId: ctx.session.user.id, key: finalKey, thumbKey, order: input.order, status: "PENDING" },
      });
    }),

  reorderPhotos: protectedProcedure
    .input(z.object({ orderedIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.$transaction(
        input.orderedIds.map((id, index) =>
          ctx.db.photo.updateMany({ where: { id, userId: ctx.session.user.id }, data: { order: index } }),
        ),
      );
      return { ok: true };
    }),

  deletePhoto: protectedProcedure.input(z.object({ photoId: z.string() })).mutation(async ({ ctx, input }) => {
    const { count } = await ctx.db.photo.deleteMany({ where: { id: input.photoId, userId: ctx.session.user.id } });
    if (count === 0) throw new TRPCError({ code: "NOT_FOUND" });
    return { ok: true };
  }),
});
