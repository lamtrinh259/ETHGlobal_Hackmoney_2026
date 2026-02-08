import "server-only";

type SupabaseError = {
  code?: string;
  message: string;
  details?: string;
};

type QueryResult<T> = {
  data: T | null;
  error: SupabaseError | null;
};

type OrderOptions = {
  ascending?: boolean;
};

type TableAction = "select" | "insert" | "update";

class SupabaseTableQuery<T = unknown> implements PromiseLike<QueryResult<T[]>> {
  private action: TableAction = "select";
  private selectColumns: string | null = null;
  private insertPayload: Record<string, unknown> | null = null;
  private updatePayload: Record<string, unknown> | null = null;
  private filters: Array<{ column: string; value: string }> = [];
  private orderClause: string | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly tableName: string
  ) {}

  select(columns = "*"): this {
    this.selectColumns = columns;
    return this;
  }

  insert(payload: Record<string, unknown>): this {
    this.action = "insert";
    this.insertPayload = payload;
    return this;
  }

  update(payload: Record<string, unknown>): this {
    this.action = "update";
    this.updatePayload = payload;
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({
      column,
      value: `eq.${String(value)}`,
    });
    return this;
  }

  order(column: string, options?: OrderOptions): this {
    this.orderClause = `${column}.${options?.ascending ? "asc" : "desc"}`;
    return this;
  }

  async single(): Promise<QueryResult<T>> {
    const result = await this.execute<T[]>();
    if (result.error) {
      return { data: null, error: result.error };
    }

    const rows = result.data ?? [];
    if (rows.length === 0) {
      return {
        data: null,
        error: { code: "PGRST116", message: "No rows returned" },
      };
    }

    return { data: rows[0], error: null };
  }

  async maybeSingle(): Promise<QueryResult<T>> {
    const result = await this.execute<T[]>();
    if (result.error) {
      return { data: null, error: result.error };
    }

    const rows = result.data ?? [];
    if (rows.length === 0) {
      return { data: null, error: null };
    }

    return { data: rows[0], error: null };
  }

  then<TResult1 = QueryResult<T[]>, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult<T[]>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?:
      | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
      | null
  ): Promise<TResult1 | TResult2> {
    return this.execute<T[]>().then(onfulfilled ?? undefined, onrejected ?? undefined);
  }

  private async execute<TReturn>(): Promise<QueryResult<TReturn>> {
    const url = new URL(`${this.baseUrl}/rest/v1/${this.tableName}`);

    if (this.selectColumns) {
      url.searchParams.set("select", this.selectColumns);
    } else if (this.action === "select") {
      url.searchParams.set("select", "*");
    }

    if (this.orderClause) {
      url.searchParams.set("order", this.orderClause);
    }

    for (const filter of this.filters) {
      url.searchParams.append(filter.column, filter.value);
    }

    let method = "GET";
    let body: string | undefined;
    const preferValues: string[] = [];

    if (this.action === "insert") {
      method = "POST";
      body = JSON.stringify(this.insertPayload ?? {});
      preferValues.push(this.selectColumns ? "return=representation" : "return=minimal");
    }

    if (this.action === "update") {
      method = "PATCH";
      body = JSON.stringify(this.updatePayload ?? {});
      preferValues.push(this.selectColumns ? "return=representation" : "return=minimal");
    }

    const headers: Record<string, string> = {
      apikey: this.apiKey,
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (preferValues.length > 0) {
      headers.Prefer = preferValues.join(",");
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      let response: Response;
      try {
        response = await fetch(url.toString(), {
          method,
          headers,
          body,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      let payload: unknown = null;
      if (response.status !== 204) {
        const rawBody = await response.text();
        if (rawBody.trim().length > 0) {
          try {
            payload = JSON.parse(rawBody);
          } catch {
            payload = rawBody;
          }
        }
      }

      if (!response.ok) {
        const err = payload as Partial<SupabaseError> | null;
        return {
          data: null,
          error: {
            code: err?.code,
            message: err?.message || `Supabase request failed (${response.status})`,
            details: err?.details,
          },
        };
      }

      return {
        data: (payload as TReturn) ?? (null as TReturn),
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: {
          message:
            error instanceof Error
              ? error.message
              : "Unknown Supabase REST error",
        },
      };
    }
  }
}

class SupabaseRestClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string
  ) {}

  from<T = unknown>(tableName: string) {
    return new SupabaseTableQuery<T>(this.baseUrl, this.apiKey, tableName);
  }
}

let cachedClient: SupabaseRestClient | null = null;

export function getSupabaseServerClient(): SupabaseRestClient {
  if (cachedClient) {
    return cachedClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)."
    );
  }

  const normalizedUrl = supabaseUrl.endsWith("/")
    ? supabaseUrl.slice(0, -1)
    : supabaseUrl;

  cachedClient = new SupabaseRestClient(normalizedUrl, supabaseServiceRoleKey);
  return cachedClient;
}
