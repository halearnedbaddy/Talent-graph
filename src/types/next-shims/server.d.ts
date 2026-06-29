export class NextRequest extends Request {
  constructor(input: Request | string | URL, init?: RequestInit);
  readonly cookies: {
    get(name: string): { name: string; value: string } | undefined;
    getAll(): { name: string; value: string }[];
    set(name: string, value: string): void;
    delete(name: string): void;
    has(name: string): boolean;
  };
  readonly nextUrl: URL & {
    pathname: string;
    search: string;
    searchParams: URLSearchParams;
    basePath: string;
  };
  readonly ip?: string;
  readonly geo?: { city?: string; country?: string; region?: string; latitude?: string; longitude?: string };
  readonly url: string;
}

export class NextResponse<Body = unknown> extends Response {
  constructor(body?: BodyInit | null, init?: ResponseInit);
  readonly cookies: {
    get(name: string): { name: string; value: string } | undefined;
    getAll(): { name: string; value: string }[];
    set(name: string, value: string, options?: Record<string, unknown>): NextResponse<Body>;
    delete(name: string): NextResponse<Body>;
    has(name: string): boolean;
  };
  static json<JsonBody>(body: JsonBody, init?: ResponseInit): NextResponse<JsonBody>;
  static redirect(url: string | URL, init?: number | ResponseInit): NextResponse<unknown>;
  static rewrite(destination: string | URL, init?: ResponseInit): NextResponse<unknown>;
  static next(init?: ResponseInit): NextResponse<unknown>;
}
