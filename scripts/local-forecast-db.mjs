import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

export function createLocalForecastDb() {
  const database = new DatabaseSync(":memory:");
  const migrations = new URL("../drizzle/", import.meta.url);
  const { entries } = JSON.parse(readFileSync(new URL("meta/_journal.json", migrations), "utf8"));
  for (const { tag } of entries) {
    database.exec(readFileSync(new URL(`${tag}.sql`, migrations), "utf8"));
  }

  return {
    prepare(sql) {
      const statement = database.prepare(sql);
      function bind(...values) {
        return {
          async first() { return statement.get(...values) ?? null; },
          run() { return statement.run(...values); },
        };
      }
      return { ...bind(), bind };
    },
    async batch(statements) {
      database.exec("BEGIN");
      try {
        const results = statements.map((statement) => statement.run());
        database.exec("COMMIT");
        return results;
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },
    close() { database.close(); },
  };
}
