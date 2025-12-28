import { Redis } from "@upstash/redis";
import { brotliCompress, brotliDecompress } from "zlib";
import { promisify } from "util";

/** Redis Database uses for caching responses
 * This is a singleton instance that connects to the Redis database using environment variables.
 * It is used to cache responses for faster access and to reduce the load on the GitHub API.
 * The connection is established using the `fromEnv` method, which reads the connection details from
 * the environment variables `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
 */
const client = Redis.fromEnv();

const brotliCompressAsync = promisify(brotliCompress);
const brotliDecompressAsync = promisify(brotliDecompress);

/** Retrieves data from the Redis cache for a given user and repository.
 * @param user - The GitHub username.
 * @param repo - The GitHub repository name.
 * @param optionsKey - Optional suffix for the cache key based on options.
 * @returns A promise that resolves to the cached data or undefined if not found.
 */
export const getFromCache = async (
  user: string,
  repo: string,
  optionsKey: string = "",
): Promise<string | undefined> => {
  const key = `gittomd:${user}:${repo}${optionsKey ? `:${optionsKey}` : ""}`;
  const data: Buffer | null = await client.get(key);
  if (data) {
    try {
      // from base64
      const dataDecoded = Buffer.from(data.toString(), "base64");
      const decompressedData = await brotliDecompressAsync(dataDecoded);
      return decompressedData.toString();
    } catch (error) {
      console.error("Error decompressing data:", error);
      return undefined;
    }
  }
  return undefined;
};

/** Caches data in the Redis database for a given user and repository.
 * @param user - The GitHub username.
 * @param repo - The GitHub repository name.
 * @param data - The data to cache, which will be compressed before storing.
 * @param optionsKey - Optional suffix for the cache key based on options.
 */
export const cacheData = async (
  user: string,
  repo: string,
  data: string,
  optionsKey: string = "",
): Promise<void> => {
  const key = `gittomd:${user}:${repo}${optionsKey ? `:${optionsKey}` : ""}`;
  try {
    const compressedData = await brotliCompressAsync(data);
    // Convert to base64 for storage
    const dataEncoded = Buffer.from(compressedData).toString("base64");
    await client.set(key, dataEncoded, { ex: 3600 }); // Set expiration to 1 hour
    console.log(`Data cached for ${user}/${repo}`);
  } catch (error) {
    console.error("Error compressing data for caching:", error);
  }
};
