// Browser stand-ins for the node built-ins lib/national.ts uses. In the
// browser the offline fallback pipeline simply has no nationwide shards
// (existsSync -> false), so only curated cities answer offline; the real
// answers come from /api/ask on the server.
export const existsSync = (): boolean => false;
export const readFileSync = (): never => {
  throw new Error('fs unavailable in the browser');
};
export const gunzipSync = (): never => {
  throw new Error('zlib unavailable in the browser');
};
export const fileURLToPath = (): string => '/';
const path = {
  dirname: (): string => '/',
  resolve: (...p: string[]): string => p.join('/'),
  join: (...p: string[]): string => p.join('/'),
};
export default path;
