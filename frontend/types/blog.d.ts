declare module 'gray-matter' {
  interface GrayMatterFile<T = unknown> {
    data: T;
    content: string;
    excerpt?: string;
    orig: Buffer | string;
  }

  interface Options {
    excerpt?: boolean | ((input: GrayMatterFile) => string);
    excerpt_separator?: string;
    engines?: Record<string, unknown>;
    language?: string;
    delimiters?: string | [string, string];
  }

  function matter<T = Record<string, unknown>>(
    input: string | Buffer,
    options?: Options
  ): GrayMatterFile<T>;

  export = matter;
}

declare module 'remark' {
  export function remark(): {
    use(plugin: unknown, ...options: unknown[]): ReturnType<typeof remark>;
    process(content: string): Promise<{ toString(): string }>;
  };
}

declare module 'remark-html' {
  const html: unknown;
  export default html;
}

declare module 'reading-time' {
  interface ReadingTimeResult {
    text: string;
    minutes: number;
    time: number;
    words: number;
  }

  function readingTime(text: string): ReadingTimeResult;
  export = readingTime;
}
