declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): Statement;
    close(): void;
  }

  export class Statement {
    run(...args: (string | number | null)[]): {
      lastInsertRowid: number;
      changes: number;
    };
    all(...args: (string | number | null)[]): Record<string, unknown>[];
    get(...args: (string | number | null)[]): Record<string, unknown> | undefined;
  }
}
