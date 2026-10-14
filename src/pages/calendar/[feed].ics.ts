import type { APIRoute, GetStaticPaths } from "astro";
import { getEvents, getGames, getTeams } from "../../lib/data";
import { icsFeed } from "../../lib/calendar";

export const getStaticPaths: GetStaticPaths = async () => {
  const teams = await getTeams();
  return [{ params: { feed: "all" } }, { params: { feed: "events" } }, ...teams.map((t) => ({ params: { feed: t.slug } }))];
};

export const GET: APIRoute = async ({ params }) => {
  const [games, events, teams] = await Promise.all([getGames(), getEvents(), getTeams()]);
  const team = teams.find((t) => t.slug === params.feed);
  const body = params.feed === "events"
    ? icsFeed("East View Soccer Events", [], events)
    : team
      ? icsFeed(`East View ${team.name}`, games.filter((g) => g.team.slug === team.slug),
          events.filter((e) => e.teams.some((t) => t.slug === team.slug)))
      : icsFeed("East View Soccer (All Teams)", games, events);
  return new Response(body, { headers: { "Content-Type": "text/calendar; charset=utf-8" } });
};
