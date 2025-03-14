import { categoriesRouter } from '@/modules/categories/server/procedures';
import { commentReactionsRouter } from '@/modules/comment-reactions/procedures';
import { commentsRouter } from '@/modules/comments/server/procedures';
import { searchRouter } from '@/modules/search/server/procedures';
import { studioRouter } from '@/modules/studio/server/procedures';
import { subscriptionsRouter } from '@/modules/subscriptions/server/procedures';
import { suggestionsRouter } from '@/modules/suggestions/server/procedures';
import { videoReactionsRouter } from '@/modules/video-reactions/procedures';
import { videoViewsRouter } from '@/modules/video-views/procedures';
import { videosRouter } from '@/modules/videos/server/procedures';
import { createTRPCRouter } from '../server/init';
import { playlistsRouter } from '@/modules/playlists/server/procedures';
import { usersRouter } from '@/modules/users/server/procedures';

export const appRouter = createTRPCRouter({
  categories: categoriesRouter,
  studio: studioRouter,
  users: usersRouter,
  videos: videosRouter,
  videoViews: videoViewsRouter,
  videoReactions: videoReactionsRouter,
  subsciptions: subscriptionsRouter,
  comments: commentsRouter,
  commentReactions: commentReactionsRouter,
  suggestions: suggestionsRouter,
  search: searchRouter,
  playlists: playlistsRouter
});

export type AppRouter = typeof appRouter;
