import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import type { CSSProperties } from "react";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));

export type CssVariables = CSSProperties & Record<`--${string}`, string>;
