/**
 * Centralized UUID v7 generator. Spec §13 cardinal rule #4 — never auto-int,
 * never v4 random for primary keys (B-tree index degradation at scale).
 */
import { v7 as uuidv7 } from 'uuid';

export const newId = (): string => uuidv7();
