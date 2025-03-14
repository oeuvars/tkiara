import { DEFAULT_LIMIT } from '@/constants';
import { db } from '@/db/drizzle';
import {
  playlist,
  playlistVideo,
  user as users,
  videoReaction as videoReactions,
  video as videos,
  videoView as videoViews,
} from '@/db/schema';
import { baseProcedure, createTRPCRouter, protectedProcedure } from '@/trpc/server/init';
import { TRPCError } from '@trpc/server';
import { and, desc, eq, getTableColumns, lt, or, sql } from 'drizzle-orm';
import { z } from 'zod';

export const playlistsRouter = createTRPCRouter({
  getOne: baseProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ input }) => {
    const { id } = input;

    const [existingPlaylist] = await db.select().from(playlist).where(and(eq(playlist.id, id)))

    if (!existingPlaylist) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Playlist not found" })
    }

    return existingPlaylist
  }),

  remove: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ input, ctx }) => {
    const { id } = input;
    const { id: userId } = ctx.user;

    const [deletedPlaylist] = await db
      .delete(playlist)
      .where(and(
        eq(playlist.id, id),
        eq(playlist.userId, userId)
      ))
      .returning();

    return deletedPlaylist
  }),

  getVideos: baseProcedure
    .input(
      z.object({
        playlistId: z.string().uuid(),
        limit: z.number().min(1).max(100),
        cursor: z
          .object({
            id: z.string().uuid(),
            updatedAt: z.date(),
          })
          .nullish(),
      }),
    )
    .query(async ({ input }) => {
      const { limit, cursor, playlistId } = input;

      const videosFromPlaylist = db.$with('playlist-videos').as(
        db
          .select({
            videoId: playlistVideo.videoId,
          })
          .from(playlistVideo)
          .where(eq(playlistVideo.playlistId, playlistId)),
      );

      const data = await db
        .with(videosFromPlaylist)
        .select({
          ...getTableColumns(videos),
          user: users,
          viewCount: db.$count(videoViews, eq(videoViews.videoId, videos.id)),
          likeCount: db.$count(
            videoReactions,
            and(eq(videoReactions.videoId, videos.id), eq(videoReactions.type, 'like')),
          ),
          dislikeCount: db.$count(
            videoReactions,
            and(eq(videoReactions.videoId, videos.id), eq(videoReactions.type, 'dislike')),
          ),
        })
        .from(videos)
        .innerJoin(users, eq(videos.userId, users.id))
        .innerJoin(videosFromPlaylist, eq(videos.id, videosFromPlaylist.videoId))
        .where(
          and(
            eq(videos.visibility, 'public'),
            cursor
              ? or(
                  lt(videos.updatedAt, cursor.updatedAt),
                  and(eq(videos.updatedAt, cursor.updatedAt), lt(videos.id, cursor.id)),
                )
              : undefined,
          ),
        )
        .orderBy(desc(videos.updatedAt), desc(videos.id))
        .limit(limit + 1);

      const hasMore = data.length > limit;

      const items = hasMore ? data.slice(0, -1) : data;
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore
        ? {
            id: lastItem.id,
            updatedAt: lastItem.updatedAt,
          }
        : null;

      return {
        items,
        nextCursor,
      };
    }),

  getHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100),
        cursor: z
          .object({
            id: z.string().uuid(),
            viewedAt: z.date(),
          })
          .nullish(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { limit, cursor } = input;
      const { id: userId } = ctx.user;

      const viewerVideoViews = db.$with('viewer-video-views').as(
        db
          .select({
            videoId: videoViews.videoId,
            viewedAt: videoViews.updatedAt,
          })
          .from(videoViews)
          .where(eq(videoViews.userId, userId)),
      );

      const data = await db
        .with(viewerVideoViews)
        .select({
          ...getTableColumns(videos),
          user: users,
          viewedAt: viewerVideoViews.viewedAt,
          viewCount: db.$count(videoViews, eq(videoViews.videoId, videos.id)),
          likeCount: db.$count(
            videoReactions,
            and(eq(videoReactions.videoId, videos.id), eq(videoReactions.type, 'like')),
          ),
          dislikeCount: db.$count(
            videoReactions,
            and(eq(videoReactions.videoId, videos.id), eq(videoReactions.type, 'dislike')),
          ),
        })
        .from(videos)
        .innerJoin(users, eq(videos.userId, users.id))
        .innerJoin(viewerVideoViews, eq(videos.id, viewerVideoViews.videoId))
        .where(
          and(
            eq(videos.visibility, 'public'),
            cursor
              ? or(
                  lt(viewerVideoViews.viewedAt, cursor.viewedAt),
                  and(eq(viewerVideoViews.viewedAt, cursor.viewedAt), lt(videos.id, cursor.id)),
                )
              : undefined,
          ),
        )
        .orderBy(desc(viewerVideoViews.viewedAt), desc(videos.id))
        .limit(limit + 1);

      const hasMore = data.length > limit;

      const items = hasMore ? data.slice(0, -1) : data;
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore
        ? {
            id: lastItem.id,
            viewedAt: lastItem.viewedAt,
          }
        : null;

      return {
        items,
        nextCursor,
      };
    }),

  getLiked: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100),
        cursor: z
          .object({
            id: z.string().uuid(),
            likedAt: z.date(),
          })
          .nullish(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { limit, cursor } = input;
      const { id: userId } = ctx.user;

      const viewerVideoReactions = db.$with('viewer-video-reactions').as(
        db
          .select({
            videoId: videoReactions.videoId,
            likedAt: videoReactions.updatedAt,
          })
          .from(videoReactions)
          .where(and(
            eq(videoReactions.userId, userId),
            eq(videoReactions.type, "like")
          )),
      );

      const data = await db
        .with(viewerVideoReactions)
        .select({
          ...getTableColumns(videos),
          user: users,
          likedAt: viewerVideoReactions.likedAt,
          viewCount: db.$count(videoViews, eq(videoViews.videoId, videos.id)),
          likeCount: db.$count(
            videoReactions,
            and(eq(videoReactions.videoId, videos.id), eq(videoReactions.type, 'like')),
          ),
          dislikeCount: db.$count(
            videoReactions,
            and(eq(videoReactions.videoId, videos.id), eq(videoReactions.type, 'dislike')),
          ),
        })
        .from(videos)
        .innerJoin(users, eq(videos.userId, users.id))
        .innerJoin(viewerVideoReactions, eq(videos.id, viewerVideoReactions.videoId))
        .where(
          and(
            eq(videos.visibility, 'public'),
            cursor
              ? or(
                  lt(viewerVideoReactions.likedAt, cursor.likedAt),
                  and(eq(viewerVideoReactions.likedAt, cursor.likedAt), lt(videos.id, cursor.id)),
                )
              : undefined,
          ),
        )
        .orderBy(desc(viewerVideoReactions.likedAt), desc(videos.id))
        .limit(limit + 1);

      const hasMore = data.length > limit;

      const items = hasMore ? data.slice(0, -1) : data;
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore
        ? {
            id: lastItem.id,
            likedAt: lastItem.likedAt,
          }
        : null;

      return {
        items,
        nextCursor,
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1)
      }))
    .mutation( async ({ input, ctx }) => {
      const { name } = input;
      const { id: userId } = ctx.user;

      // TODO: Add playlist custom image
      const [createdPlaylist] = await db
        .insert(playlist)
        .values({
          userId: userId,
          name: name
        })
        .returning();

      if (!createdPlaylist) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Could not create playlist" })
      }

      return createdPlaylist
    }),

  addVideo: protectedProcedure
    .input(
      z.object({
        playlistId: z.string().uuid(),
        videoId: z.string().uuid()
      }))
    .mutation( async ({ input, ctx }) => {
      const { playlistId, videoId } = input;
      const { id: userId } = ctx.user;

      const [existingPlaylist] = await db.select().from(playlist).where(eq(playlist.id, playlistId))

      if (!existingPlaylist) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Playlist not found" })
      }

      if (existingPlaylist.userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Selected playlist does not belong to the user" })
      }

      const [existingVideo] = await db.select().from(videos).where(eq(videos.id, videoId))

      if (!existingVideo) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Video not found" })
      }

      const [existingPlaylistVideo] = await db
        .select()
        .from(playlistVideo)
        .where(
          and(
            eq(playlistVideo.playlistId, playlistId),
            eq(playlistVideo.videoId, videoId),
          )
        )

      if (existingPlaylistVideo) {
        throw new TRPCError({ code: "CONFLICT", message: "Video already exists in the playlist" })
      }

      const [createdPlaylistVideo] = await db
        .insert(playlistVideo)
        .values({
          playlistId: playlistId,
          videoId: videoId
        })
        .returning()

      return createdPlaylistVideo;
    }),

  removeVideo: protectedProcedure
    .input(
      z.object({
        playlistId: z.string().uuid(),
        videoId: z.string().uuid()
      }))
    .mutation( async ({ input, ctx }) => {
      const { playlistId, videoId } = input;
      const { id: userId } = ctx.user;

      const [existingPlaylist] = await db.select().from(playlist).where(eq(playlist.id, playlistId))

      if (!existingPlaylist) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Playlist not found" })
      }

      if (existingPlaylist.userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Selected playlist does not belong to the user" })
      }

      const [existingVideo] = await db.select().from(videos).where(eq(videos.id, videoId))

      if (!existingVideo) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Video not found" })
      }

      const [existingPlaylistVideo] = await db
        .select()
        .from(playlistVideo)
        .where(
          and(
            eq(playlistVideo.playlistId, playlistId),
            eq(playlistVideo.videoId, videoId),
          )
        )

      if (!existingPlaylistVideo) {
        throw new TRPCError({ code: "CONFLICT", message: "Video already exists in the playlist" })
      }

      const [deletedPlaylistVideo] = await db
        .delete(playlistVideo)
        .where(
          and(
            eq(playlistVideo.playlistId, playlistId),
            eq(playlistVideo.videoId, videoId)
          )
        )
        .returning()

      return deletedPlaylistVideo;
    }),

  getMany: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100),
        cursor: z
          .object({
            id: z.string().uuid(),
            updatedAt: z.date(),
          })
          .nullish(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { limit, cursor } = input;
      const { id: userId } = ctx.user;

      const data = await db
        .select({
          ...getTableColumns(playlist),
          videoCount: db.$count(
            playlistVideo,
            eq(playlist.id, playlistVideo.playlistId)
          ),
          user: users,
          thumbnailUrl: sql<string | null>`(
            SELECT v.thumbnail_url
            FROM ${playlistVideo} pv
            JOIN ${videos} v ON v.id = pv.video_id
            WHERE pv.playlist_id = ${playlist.id}
            ORDER BY pv.updated_at DESC
            LIMIT 1
          )`
        })
        .from(playlist)
        .innerJoin(users, eq(playlist.userId, users.id))
        .where(and(
          eq(playlist.userId, userId),
          cursor
            ? or(
                lt(playlist.updatedAt, cursor.updatedAt),
                and(eq(playlist.updatedAt, cursor.updatedAt), lt(playlist.id, cursor.id)),
              )
            : undefined,
        ))
        .orderBy(desc(playlist.updatedAt), desc(playlist.id))
        .limit(limit + 1);

      const hasMore = data.length > limit;

      const items = hasMore ? data.slice(0, -1) : data;
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore
        ? {
            id: lastItem.id,
            updatedAt: lastItem.updatedAt,
          }
        : null;

      return {
        items,
        nextCursor,
      };
    }),

  getManyForVideo: protectedProcedure
    .input(
      z.object({
        videoId: z.string().uuid(),
        limit: z.number().min(1).max(100),
        cursor: z
          .object({
            id: z.string().uuid(),
            updatedAt: z.date(),
          })
          .nullish(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { limit, cursor, videoId } = input;
      const { id: userId } = ctx.user;

      const data = await db
        .select({
          ...getTableColumns(playlist),
          videoCount: db.$count(
            playlistVideo,
            eq(playlist.id, playlistVideo.playlistId)
          ),
          containsVideo: videoId ? sql<boolean>`(SELECT EXISTS (
            SELECT 1
            FROM ${playlistVideo} pv
            WHERE pv.playlist_id = ${playlist.id} AND pv.video_id = ${videoId}
          ))` : sql<boolean>`false`
        })
        .from(playlist)
        .innerJoin(users, eq(playlist.userId, users.id))
        .where(and(
          eq(playlist.userId, userId),
          cursor
            ? or(
                lt(playlist.updatedAt, cursor.updatedAt),
                and(eq(playlist.updatedAt, cursor.updatedAt), lt(playlist.id, cursor.id)),
              )
            : undefined,
        ))
        .orderBy(desc(playlist.updatedAt), desc(playlist.id))
        .limit(limit + 1);

      const hasMore = data.length > limit;

      const items = hasMore ? data.slice(0, -1) : data;
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore
        ? {
            id: lastItem.id,
            updatedAt: lastItem.updatedAt,
          }
        : null;

      return {
        items,
        nextCursor,
      };
    }),
});
