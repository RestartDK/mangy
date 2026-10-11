import type { PgClientConfig } from "@effect/sql-pg/PgClient";
import { env } from "@mangy/env";
import { Config } from "effect";

/**
 * Where the driver is told the database lives.
 *
 * `url` is parsed with `new URL`, which rejects the standard socket form
 * `postgresql://user@/database?host=/run/postgresql` because it carries no host.
 * A socket is configured the way the driver documents instead: a `host`
 * beginning with `/` is the socket directory. `DATABASE_URL` stays the way to
 * reach a TCP server, which is what local development and Dokploy use.
 */
export const databaseConfig = (): Config.Wrap<PgClientConfig> => {
  const { PGDATABASE, PGHOST, PGPASSWORD, PGPORT, PGUSER } = env;

  if (PGHOST === undefined) {
    const url = env.DATABASE_URL;

    if (url === undefined) {
      throw new Error(
        "Set PGHOST to reach a socket, or DATABASE_URL to reach a TCP server"
      );
    }

    return { url: Config.succeed(url) };
  }

  return {
    host: Config.succeed(PGHOST),
    ...(PGDATABASE === undefined
      ? {}
      : { database: Config.succeed(PGDATABASE) }),
    ...(PGPASSWORD === undefined
      ? {}
      : { password: Config.succeed(PGPASSWORD) }),
    ...(PGPORT === undefined ? {} : { port: Config.succeed(Number(PGPORT)) }),
    ...(PGUSER === undefined ? {} : { username: Config.succeed(PGUSER) }),
  };
};
