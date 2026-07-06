declare module "connect-sqlite3" {
  import { SessionData, Store } from "express-session";

  interface SqliteStoreOptions {
    db?: string;
    dir?: string;
    table?: string;
    concurrentDB?: boolean;
  }

  function createSqliteStore(
    session: (options?: session.SessionOptions) => express.RequestHandler
  ): new (options: SqliteStoreOptions) => Store;

  export = createSqliteStore;
}
