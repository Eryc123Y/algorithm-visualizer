/** The input of the two string tables: two strings of 1 to 16 characters. */
import { z } from 'zod';

/** Most characters of a string, so a table has at most 17 rows or columns. */
export const MAX_STRING = 16;

const Text = (description: string) =>
  z.string().min(1).max(MAX_STRING).describe(description);

export const TwoStrings = z.strictObject({
  first: Text('The first string, e.g. "ABCBDAB".'),
  second: Text('The second string, e.g. "BDCABA".'),
});
