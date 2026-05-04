/**
 * Ambient type declarations for @ez-corp/ez-search.
 *
 * The package ships without TypeScript declaration files. These declarations
 * capture the programmatic API surface observed in the distributed JS files.
 */
declare module "@ez-corp/ez-search" {
  export class EzSearchError extends Error {
    readonly code: string;
    readonly suggestion?: string;
    constructor(code: string, message: string, suggestion?: string);
  }

  export interface IndexResult {
    fileCount: number;
    chunkCount: number;
  }

  export interface QueryHit {
    file: string;
    text: string;
    score: number;
  }

  export interface QueryResult {
    code: QueryHit[];
    text: QueryHit[];
    image: QueryHit[];
  }

  export interface StatusResult {
    fileCount: number;
    chunkCount?: number;
    lastIndexed?: string;
    staleFileCount?: number;
    indexSizeBytes?: number;
    storagePath?: string;
  }

  export interface IndexOptions {
    ignore?: boolean;
    type?: string;
    clear?: boolean;
  }

  export interface QueryOptions {
    topK?: number;
    dir?: string;
    threshold?: number;
    type?: string;
    mode?: "hybrid" | "semantic" | "keyword";
    autoIndex?: boolean;
    projectDir?: string;
  }

  export interface StatusOptions {
    ignore?: boolean;
    projectDir?: string;
  }

  export function index(
    targetPath: string,
    options?: IndexOptions
  ): Promise<IndexResult>;

  export function query(
    text: string,
    options?: QueryOptions
  ): Promise<QueryResult>;

  export function status(options?: StatusOptions): Promise<StatusResult>;
}
