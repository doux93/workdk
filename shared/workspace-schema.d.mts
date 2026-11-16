import type { Workspace, FieldConfig } from "../src/workspace";
export function validateWorkspace(value: unknown): value is Workspace;
export function validateFieldConfig(value: unknown): value is FieldConfig;
export function isValidDateValue(value: string): boolean;
export function isValidTimeValue(value: string): boolean;
